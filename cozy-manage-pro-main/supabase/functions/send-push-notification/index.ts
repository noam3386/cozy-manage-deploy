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
  // Import the input keying material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm.buffer as ArrayBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  
  // Derive the key
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
  console.log('[Push] Starting payload encryption...');
  
  // Decode subscriber's public key and auth secret
  const subscriberPublicKey = base64UrlToUint8Array(p256dhKey);
  const subscriberAuth = base64UrlToUint8Array(authSecret);
  
  console.log('[Push] Subscriber public key length:', subscriberPublicKey.length);
  console.log('[Push] Auth secret length:', subscriberAuth.length);
  
  // Generate ephemeral ECDH key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  // Export our public key in raw format
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey)
  );
  console.log('[Push] Server public key length:', serverPublicKeyRaw.length);
  
  // Import subscriber's public key
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  
  // Derive shared secret using ECDH
  const sharedSecretBuffer = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    keyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  console.log('[Push] Shared secret derived, length:', sharedSecret.length);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const encoder = new TextEncoder();
  
  // Step 1: Derive PRK from shared secret using auth as salt
  // PRK = HKDF-Extract(auth_secret, ecdh_secret)
  // Then IKM = HKDF-Expand(PRK, info, 32)
  // Combined: IKM = HKDF(ecdh_secret, auth_secret, info, 32)
  
  // info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfoContent = concatUint8Arrays(
    encoder.encode('WebPush: info\0'),
    subscriberPublicKey,
    serverPublicKeyRaw
  );
  
  // IKM = HKDF(shared_secret, auth_secret, key_info, 32)
  const ikm = await hkdf(
    sharedSecret,
    subscriberAuth,
    keyInfoContent,
    32
  );
  console.log('[Push] IKM derived, length:', ikm.length);
  
  // Step 2: Derive CEK and nonce from IKM using salt
  // CEK = HKDF(ikm, salt, cek_info, 16)
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const cek = await hkdf(
    ikm,
    salt,
    cekInfo,
    16
  );
  console.log('[Push] CEK derived, length:', cek.length);
  
  // Nonce = HKDF(ikm, salt, nonce_info, 12)
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(
    ikm,
    salt,
    nonceInfo,
    12
  );
  console.log('[Push] Nonce derived, length:', nonce.length);
  
  // Prepare plaintext with padding delimiter
  const payloadBytes = encoder.encode(payload);
  // Add delimiter byte (0x02) - indicates last record
  const paddedPayload = concatUint8Arrays(payloadBytes, new Uint8Array([2]));
  
  // Import CEK for AES-GCM
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    cek.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
    encryptionKey,
    paddedPayload.buffer as ArrayBuffer
  );
  const encryptedPayload = new Uint8Array(encryptedBuffer);
  console.log('[Push] Payload encrypted, length:', encryptedPayload.length);
  
  // Create the aes128gcm header
  // Header: salt (16) + rs (4 bytes big-endian) + idlen (1) + keyid (65 for P-256 public key)
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096 in big-endian
  const idlen = new Uint8Array([65]); // Key ID length
  
  const header = concatUint8Arrays(salt, rs, idlen, serverPublicKeyRaw);
  const body = concatUint8Arrays(header, encryptedPayload);
  
  console.log('[Push] Final encrypted body length:', body.length);
  
  return {
    encrypted: body,
    salt: salt,
    publicKey: serverPublicKeyRaw
  };
}

serve(async (req) => {
  console.log('[Push] ========== Function started ==========');
  
  if (req.method === 'OPTIONS') {
    console.log('[Push] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Push] Getting environment variables...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    console.log('[Push] SUPABASE_URL exists:', !!supabaseUrl);
    console.log('[Push] SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);
    console.log('[Push] VAPID_PUBLIC_KEY exists:', !!vapidPublicKey);
    console.log('[Push] VAPID_PRIVATE_KEY exists:', !!vapidPrivateKey);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Push] Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[Push] Missing VAPID keys');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing VAPID configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[Push] Supabase client created');

    console.log('[Push] Parsing request body...');
    const body = await req.json();
    const { userId, title, body: messageBody, data } = body;

    console.log('[Push] Request data:');
    console.log('[Push]   userId:', userId);
    console.log('[Push]   title:', title);
    console.log('[Push]   body:', messageBody);

    if (!userId) {
      console.error('[Push] Missing userId');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's push subscriptions
    console.log('[Push] Fetching subscriptions for user:', userId);
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('[Push] Error fetching subscriptions:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Push] Subscriptions found:', subscriptions?.length || 0);

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No subscriptions found for user');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'לא נמצאה הרשמה להתראות. יש להפעיל התראות תחילה.',
          debug: { userId, subscriptionsFound: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: messageBody,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data,
    });

    console.log('[Push] Payload prepared:', payload.length, 'bytes');

    const results = [];
    const failedSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        console.log('[Push] Processing subscription:', sub.id);
        console.log('[Push] Endpoint:', sub.endpoint?.substring(0, 60));
        
        // Encrypt the payload
        const { encrypted } = await encryptPayload(payload, sub.p256dh, sub.auth);
        
        // Parse the endpoint URL to get the audience (origin)
        const endpointUrl = new URL(sub.endpoint);
        const audience = endpointUrl.origin;
        console.log('[Push] Audience:', audience);

        // Create VAPID JWT
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

        // Parse VAPID public key for signing
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
        console.log('[Push] VAPID token created');

        // Send push notification with encrypted payload
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

        console.log('[Push] Response status:', response.status);

        if (response.ok || response.status === 201) {
          results.push({ success: true, status: response.status });
          console.log('[Push] SUCCESS - notification sent!');
        } else {
          const errorText = await response.text();
          console.log('[Push] Failed:', response.status, errorText);
          results.push({ success: false, status: response.status, error: errorText });
          
          if (response.status === 410 || response.status === 404) {
            failedSubscriptions.push(sub.id);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown';
        console.error('[Push] Exception:', errorMessage);
        if (err instanceof Error && err.stack) {
          console.error('[Push] Stack:', err.stack);
        }
        results.push({ success: false, error: errorMessage });
      }
    }

    // Clean up invalid subscriptions
    if (failedSubscriptions.length > 0) {
      console.log('[Push] Removing', failedSubscriptions.length, 'invalid subscriptions');
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', failedSubscriptions);
    }

    const anySuccess = results.some(r => r.success);
    
    console.log('[Push] Final result:', anySuccess ? 'SUCCESS' : 'FAILED');
    console.log('[Push] Results:', JSON.stringify(results));
    
    return new Response(
      JSON.stringify({ 
        success: anySuccess, 
        results,
        message: anySuccess ? 'התראה נשלחה בהצלחה!' : 'שליחה נכשלה'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Push] FATAL ERROR:', errorMessage);
    console.error('[Push] Stack:', err instanceof Error ? err.stack : 'N/A');
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
