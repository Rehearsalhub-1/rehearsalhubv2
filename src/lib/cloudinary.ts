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
    } else if (ext === 'pdf') {
      mime = 'application/pdf';
    } else if (ext === 'doc' || ext === 'docx') {
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === 'xls' || ext === 'xlsx') {
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === 'txt') {
      mime = 'text/plain';
    } else if (ext === 'm4a' || ext === 'mp3' || ext === 'wav' || ext === 'aac' || ext === 'ogg' || ext === 'opus') {
      mime = `audio/${ext}`;
    } else {
      mime = 'application/octet-stream';
    }

    const filename = `upload_${Date.now()}.${ext}`;

    formData.append('file', {
      uri: fileUri,
      type: mime,
      name: filename,
    } as any);

    const folder = resourceType === 'image'
      ? 'statuses'
      : resourceType === 'video'
      ? 'statuses_video'
      : (ext === 'mp3' || ext === 'm4a' || ext === 'wav' || ext === 'aac')
      ? 'audio'
      : 'documents';

    formData.append('folder', folder);

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
    const rawUrl = data.data?.url || data.url;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes('pub-cb7697578fcc48d3b3aeb70a47eb2f65.r2.dev')) {
      const key = rawUrl.split('pub-cb7697578fcc48d3b3aeb70a47eb2f65.r2.dev/')[1];
      if (key) return `${BASE_URL}/upload/file/${key}`;
    }
    return rawUrl;
  } catch (error) {
    console.error('[Storage] Upload Error:', error);
    throw error;
  }
};

/** @deprecated Use `uploadMedia` instead */
export const uploadImageToCloudinary = uploadMedia;
