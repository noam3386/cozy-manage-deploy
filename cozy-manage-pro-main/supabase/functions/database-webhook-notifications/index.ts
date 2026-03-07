import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Encode Uint8Array to base64url
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Encode string to base64url
function stringToBase64Url(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Concatenate Uint8Arrays
function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// HKDF using Web Crypto API
async function hkdf(
  ikm: Uint8Array, 
  salt: Uint8Array, 
  info: Uint8Array, 
  length: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm.buffer as ArrayBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: salt.buffer as ArrayBuffer,
      info: info.buffer as ArrayBuffer,
      hash: 'SHA-256'
    },
    keyMaterial,
    length * 8
  );
  
  return new Uint8Array(derivedBits);
}

// Encrypt payload for Web Push (RFC 8291 - aes128gcm)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; publicKey: Uint8Array }> {
  const subscriberPublicKey = base64UrlToUint8Array(p256dhKey);
  const subscriberAuth = base64UrlToUint8Array(authSecret);
  
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey)
  );
  
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  
  const sharedSecretBuffer = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    keyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  
  const keyInfoContent = concatUint8Arrays(
    encoder.encode('WebPush: info\0'),
    subscriberPublicKey,
    serverPublicKeyRaw
  );
  
  const ikm = await hkdf(sharedSecret, subscriberAuth, keyInfoContent, 32);
  
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const cek = await hkdf(ikm, salt, cekInfo, 16);
  
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(ikm, salt, nonceInfo, 12);
  
  const payloadBytes = encoder.encode(payload);
  const paddedPayload = concatUint8Arrays(payloadBytes, new Uint8Array([2]));
  
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    cek.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
    encryptionKey,
    paddedPayload.buffer as ArrayBuffer
  );
  const encryptedPayload = new Uint8Array(encryptedBuffer);
  
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
  const idlen = new Uint8Array([65]);
  
  const header = concatUint8Arrays(salt, rs, idlen, serverPublicKeyRaw);
  const body = concatUint8Arrays(header, encryptedPayload);
  
  return { encrypted: body, salt, publicKey: serverPublicKeyRaw };
}

async function sendPushToUser(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  console.log('[Webhook] Sending push to user:', userId);
  
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (error || !subscriptions?.length) {
    console.log('[Webhook] No subscriptions for user:', userId);
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  });

  for (const sub of subscriptions) {
    try {
      const { encrypted } = await encryptPayload(payload, sub.p256dh, sub.auth);
      
      const endpointUrl = new URL(sub.endpoint);
      const audience = endpointUrl.origin;

      const header = { alg: 'ES256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const jwtPayload = {
        aud: audience,
        exp: now + 12 * 60 * 60,
        sub: 'mailto:push@example.com',
      };

      const headerB64 = stringToBase64Url(JSON.stringify(header));
      const payloadB64 = stringToBase64Url(JSON.stringify(jwtPayload));
      const unsignedToken = `${headerB64}.${payloadB64}`;

      const publicKeyBytes = base64UrlToUint8Array(vapidPublicKey);
      const startOffset = publicKeyBytes[0] === 0x04 ? 1 : 0;
      const xBytes = publicKeyBytes.slice(startOffset, startOffset + 32);
      const yBytes = publicKeyBytes.slice(startOffset + 32, startOffset + 64);
      
      const jwk = {
        kty: 'EC',
        crv: 'P-256',
        d: vapidPrivateKey,
        x: uint8ArrayToBase64Url(xBytes),
        y: uint8ArrayToBase64Url(yBytes),
      };

      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
      );

      const vapidToken = `${unsignedToken}.${uint8ArrayToBase64Url(new Uint8Array(signatureBuffer))}`;

      const response = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${vapidToken}, k=${vapidPublicKey}`,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'Content-Length': encrypted.length.toString(),
          'TTL': '86400',
          'Urgency': 'high',
        },
        body: encrypted.buffer as ArrayBuffer,
      });

      console.log('[Webhook] Push sent to', sub.endpoint.substring(0, 50), '- Status:', response.status);

      if (response.status === 410 || response.status === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    } catch (err) {
      console.error('[Webhook] Push error:', err);
    }
  }
}

serve(async (req) => {
  console.log('[Webhook] ========== Database webhook received ==========');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('[Webhook] Payload:', JSON.stringify(body));
    
    const { type, table, record, old_record } = body;
    
    if (type !== 'INSERT' && type !== 'UPDATE') {
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    let usersToNotify: { userId: string; title: string; body: string }[] = [];

    // Handle different tables
    if (table === 'messages') {
      const propertyId = record.property_id;
      const senderType = record.sender_type;
      
      // Get property to find owner
      const { data: property } = await supabase
        .from('properties')
        .select('owner_id, name')
        .eq('id', propertyId)
        .single();

      if (senderType === 'manager') {
        // Notify owner about manager message
        if (property?.owner_id) {
          usersToNotify.push({
            userId: property.owner_id,
            title: 'הודעה חדשה',
            body: `קיבלת הודעה חדשה מהמנהל בנוגע ל${property.name || 'נכס'}`,
          });
        }
      } else if (senderType === 'owner') {
        // Notify all managers
        const { data: managers } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['manager', 'admin']);

        if (managers) {
          for (const manager of managers) {
            usersToNotify.push({
              userId: manager.id,
              title: 'הודעה חדשה',
              body: `הודעה חדשה מבעל נכס - ${property?.name || 'נכס'}`,
            });
          }
        }
      }
    } 
    else if (table === 'issues') {
      if (type === 'INSERT') {
        // Notify managers about new issue
        const { data: managers } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['manager', 'admin']);

        if (managers) {
          for (const manager of managers) {
            usersToNotify.push({
              userId: manager.id,
              title: 'תקלה חדשה',
              body: record.title,
            });
          }
        }
      } else if (type === 'UPDATE' && record.status !== old_record?.status) {
        // Notify owner about status change
        const { data: property } = await supabase
          .from('properties')
          .select('owner_id')
          .eq('id', record.property_id)
          .single();

        if (property?.owner_id) {
          const statusMap: Record<string, string> = {
            'new': 'חדשה',
            'in_progress': 'בטיפול',
            'resolved': 'טופלה',
            'closed': 'נסגרה'
          };
          usersToNotify.push({
            userId: property.owner_id,
            title: 'עדכון סטטוס תקלה',
            body: `"${record.title}" - ${statusMap[record.status] || record.status}`,
          });
        }
      }
    }
    else if (table === 'property_inspections' && type === 'INSERT') {
      // Notify owner about inspection
      const { data: property } = await supabase
        .from('properties')
        .select('owner_id, name')
        .eq('id', record.property_id)
        .single();

      if (property?.owner_id) {
        usersToNotify.push({
          userId: property.owner_id,
          title: 'בדיקת נכס בוצעה',
          body: `בוצעה בדיקה בנכס ${property.name || ''} בתאריך ${record.inspection_date}`,
        });
      }
    }
    else if (table === 'property_cleaning_records' && type === 'INSERT') {
      // Notify owner about cleaning
      const { data: property } = await supabase
        .from('properties')
        .select('owner_id, name')
        .eq('id', record.property_id)
        .single();

      if (property?.owner_id) {
        usersToNotify.push({
          userId: property.owner_id,
          title: 'הנכס נוקה',
          body: `נכס ${property.name || ''} נוקה בתאריך ${record.cleaned_at?.split('T')[0]}`,
        });
      }
    }
    else if (table === 'arrivals_departures' && type === 'INSERT') {
      const typeHeb = record.type === 'arrival' ? 'הגעה' : 'עזיבה';
      
      // Notify owner
      const { data: property } = await supabase
        .from('properties')
        .select('owner_id')
        .eq('id', record.property_id)
        .single();

      if (property?.owner_id) {
        usersToNotify.push({
          userId: property.owner_id,
          title: `${typeHeb} חדשה נרשמה`,
          body: `תאריך: ${record.date}`,
        });
      }

      // Notify managers
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['manager', 'admin']);

      if (managers) {
        for (const manager of managers) {
          usersToNotify.push({
            userId: manager.id,
            title: `${typeHeb} חדשה התקבלה`,
            body: `תאריך: ${record.date}`,
          });
        }
      }
    }
    else if (table === 'service_requests' && type === 'INSERT') {
      const typeMap: Record<string, string> = {
        'cleaning': 'ניקיון',
        'laundry': 'כביסה',
        'maintenance': 'תחזוקה',
        'supplies': 'ציוד'
      };

      // Notify managers
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['manager', 'admin']);

      if (managers) {
        for (const manager of managers) {
          usersToNotify.push({
            userId: manager.id,
            title: 'בקשת שירות חדשה',
            body: `סוג: ${typeMap[record.type] || record.type}`,
          });
        }
      }
    }

    // Send notifications
    console.log('[Webhook] Users to notify:', usersToNotify.length);
    
    for (const notification of usersToNotify) {
      await sendPushToUser(
        supabase,
        notification.userId,
        notification.title,
        notification.body,
        vapidPublicKey,
        vapidPrivateKey
      );
    }

    return new Response(
      JSON.stringify({ success: true, notified: usersToNotify.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
