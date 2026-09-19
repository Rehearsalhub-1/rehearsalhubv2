import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { BASE_URL } from './apiClient';

/**
 * Universal media uploader to Cloudflare R2 via rehearsalhub-api.
 * Uses FileSystem.uploadAsync for native multipart file streaming (with XHR fallback)
 * to bypass Expo's Winter fetch 'Unsupported FormDataPart implementation' bug.
 */
export const uploadMedia = async (
  fileUri: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image'
): Promise<string> => {
  try {
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

    const folder = isAudio
      ? 'audio'
      : resourceType === 'image' || (isImage && resourceType !== 'video')
      ? 'statuses'
      : resourceType === 'video' || isVideo
      ? 'statuses_video'
      : 'documents';

    const token = await SecureStore.getItemAsync('jwt');
    const endpoint = `${BASE_URL}/upload`;

    let data: any;

    try {
      // Primary: FileSystem.uploadAsync (native streaming uploader, bypasses Winter fetch bug)
      const uploadResult = await FileSystem.uploadAsync(endpoint, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        parameters: {
          folder,
        },
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed (${uploadResult.status}): ${uploadResult.body}`);
      }

      data = JSON.parse(uploadResult.body);
    } catch (fsErr) {
      console.warn('[Storage] FileSystem.uploadAsync fallback to XHR:', fsErr);
      // Fallback: XMLHttpRequest (native RCTNetworking multipart uploader)
      data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              resolve({ url: xhr.responseText });
            }
          } else {
            reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network request failed'));
        xhr.ontimeout = () => reject(new Error('Upload request timed out'));
        xhr.timeout = 180000;

        const formData = new FormData();
        formData.append('file', {
          uri: fileUri,
          type: mime,
          name: filename,
        } as any);
        formData.append('folder', folder);
        xhr.send(formData);
      });
    }

    const rawUrl = data?.data?.url || data?.url;
    if (rawUrl && typeof rawUrl === 'string') {
      if (rawUrl.startsWith('/upload/file') || rawUrl.startsWith('upload/file')) {
        const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
        return `${BASE_URL}${cleanPath}`;
      }
      if (rawUrl.includes('pub-cb7697578fcc48d3b3aeb70a47eb2f65.r2.dev')) {
        const key = rawUrl.split('pub-cb7697578fcc48d3b3aeb70a47eb2f65.r2.dev/')[1];
        if (key) return `${BASE_URL}/upload/file/${key}`;
      }
    }
    return rawUrl || '';
  } catch (error) {
    console.error('[Storage] Upload Error:', error);
    throw error;
  }
};

/** @deprecated Use `uploadMedia` instead */
export const uploadImageToCloudinary = uploadMedia;
