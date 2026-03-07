import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to generate signed URLs for private storage images
 * @param imageUrl - The full public URL or storage path of the image
 * @param bucket - The storage bucket name (default: 'property-images')
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 */
export function useSignedImageUrl(
  imageUrl: string | null | undefined,
  bucket: string = 'property-images',
  expiresIn: number = 3600
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setSignedUrl(null);
      return;
    }

    const getSignedUrl = async () => {
      try {
        // Extract the file path from the full URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file.jpg
        let filePath = imageUrl;
        
        // Check if it's a full URL
        if (imageUrl.includes('/storage/v1/object/')) {
          // Extract path after bucket name
          const bucketPattern = new RegExp(`/object/(?:public|sign)/${bucket}/(.+)$`);
          const match = imageUrl.match(bucketPattern);
          if (match) {
            filePath = match[1];
          } else {
            // Fallback: try to get the path after the last occurrence of bucket name
            const bucketIndex = imageUrl.lastIndexOf(`/${bucket}/`);
            if (bucketIndex !== -1) {
              filePath = imageUrl.substring(bucketIndex + bucket.length + 2);
            }
          }
        }

        // Generate signed URL
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, expiresIn);

        if (error) {
          console.error('Error creating signed URL:', error);
          // Fallback to original URL in case of error
          setSignedUrl(imageUrl);
          return;
        }

        setSignedUrl(data.signedUrl);
      } catch (error) {
        console.error('Error in useSignedImageUrl:', error);
        setSignedUrl(imageUrl);
      }
    };

    getSignedUrl();
  }, [imageUrl, bucket, expiresIn]);

  return signedUrl;
}

/**
 * Utility function to generate signed URL (non-hook version for batch processing)
 */
export async function getSignedImageUrl(
  imageUrl: string,
  bucket: string = 'property-images',
  expiresIn: number = 3600
): Promise<string> {
  if (!imageUrl) return '';

  try {
    let filePath = imageUrl;
    
    if (imageUrl.includes('/storage/v1/object/')) {
      const bucketPattern = new RegExp(`/object/(?:public|sign)/${bucket}/(.+)$`);
      const match = imageUrl.match(bucketPattern);
      if (match) {
        filePath = match[1];
      } else {
        const bucketIndex = imageUrl.lastIndexOf(`/${bucket}/`);
        if (bucketIndex !== -1) {
          filePath = imageUrl.substring(bucketIndex + bucket.length + 2);
        }
      }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return imageUrl;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error in getSignedImageUrl:', error);
    return imageUrl;
  }
}
