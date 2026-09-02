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
    let ext = (fileUri.split('.').pop() || '').toLowerCase();
    if (!ext || ext.length > 5 || ext.includes('/') || ext.includes('?')) {
      ext = resourceType === 'image' ? 'jpg' : resourceType === 'video' ? 'mp4' : 'mp3';
    }
    let mime = 'image/jpeg';
    if (resourceType === 'image') {
      mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    } else if (resourceType === 'video') {
      mime = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    } else {
      mime = (ext === 'm4a' || ext === 'mp3' || ext === 'wav' || ext === 'aac') ? `audio/${ext}` : 'audio/mpeg';
    }

    const filename = `upload_${Date.now()}.${ext}`;

    formData.append('file', {
      uri: fileUri,
      type: mime,
      name: filename,
    } as any);

    formData.append('folder', resourceType === 'image' ? 'statuses' : resourceType === 'video' ? 'statuses_video' : 'audio');

    const token = await SecureStore.getItemAsync('jwt');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const endpoint = `${BASE_URL}/upload`;

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
