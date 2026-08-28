import * as SecureStore from 'expo-secure-store';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '');

/**
 * Universal media uploader to Cloudflare R2 via rehearsalhub-api.
 * Named uploadMedia — previously uploadImageToCloudinary before Cloudinary was replaced with R2.
 */
export const uploadMedia = async (
  fileUri: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image'
): Promise<string> => {
  try {
    const formData = new FormData();
    const ext = fileUri.split('.').pop()?.toLowerCase() || (resourceType === 'image' ? 'jpg' : 'mp3');
    const type = resourceType === 'image' ? 'image/jpeg' : (ext === 'm4a' || ext === 'mp3' || ext === 'wav' || ext === 'aac') ? `audio/${ext}` : `video/${ext}`;
    const name = `upload_${Date.now()}.${ext}`;

    formData.append('file', {
      uri: fileUri,
      type,
      name,
    } as any);

    formData.append('folder', resourceType === 'image' ? 'profile_pictures' : 'audio');

    const token = await SecureStore.getItemAsync('jwt');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!token) {
      throw new Error('Authentication is required to upload media');
    }

    const endpoint = `${BASE_URL}/api/upload`;

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.data?.url || data.url;
  } catch (error) {
    console.error('[Storage] Upload Error:', error);
    throw error;
  }
};

/** @deprecated Use `uploadMedia` instead */
export const uploadImageToCloudinary = uploadMedia;
