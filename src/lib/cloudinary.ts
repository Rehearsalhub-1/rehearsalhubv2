import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from './apiClient';

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

    const isAudio = ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'opus', 'flac'].includes(ext);
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || resourceType === 'image';
    const isVideo = ['mp4', 'mov', 'webm', 'mkv', 'm4v'].includes(ext) || (resourceType === 'video' && !isAudio);

    let mime = 'application/octet-stream';
    if (isAudio) {
      mime = ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;
    } else if (isImage) {
      mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    } else if (isVideo) {
      mime = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    } else if (ext === 'pdf') {
      mime = 'application/pdf';
    } else if (ext === 'doc' || ext === 'docx') {
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === 'xls' || ext === 'xlsx') {
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === 'txt') {
      mime = 'text/plain';
    }

    const filename = `upload_${Date.now()}.${ext}`;

    formData.append('file', {
      uri: fileUri,
      type: mime,
      name: filename,
    } as any);

    const folder = isAudio
      ? 'audio'
      : resourceType === 'image' || (isImage && resourceType !== 'video')
      ? 'statuses'
      : resourceType === 'video' || isVideo
      ? 'statuses_video'
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
