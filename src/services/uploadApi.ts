import { authApi } from './authApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface UploadProgressCallback {
  (percentage: number): void;
}

export const uploadApi = {
  // Inspect video duration via HTML5 Video element before uploading
  async checkVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        reject(new Error('Failed to read video file metadata'));
      };
      video.src = URL.createObjectURL(file);
    });
  },

  async getSignature(): Promise<{ signature: string; timestamp: number; cloudName: string; apiKey: string; folder: string }> {
    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/upload/signature`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Failed to obtain secure upload signature');
    }
    return await res.json();
  },

  async uploadFileToCloudinary(
    file: File,
    resourceType: 'image' | 'video' | 'auto',
    onProgress?: UploadProgressCallback
  ): Promise<{ secure_url: string; public_id: string; duration?: number }> {
    try {
      const sigData = await this.getSignature();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sigData.apiKey);
      formData.append('timestamp', String(sigData.timestamp));
      formData.append('signature', sigData.signature);
      formData.append('folder', sigData.folder);

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${resourceType}/upload`;

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', cloudinaryUrl);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            resolve({
              secure_url: data.secure_url,
              public_id: data.public_id,
              duration: data.duration,
            });
          } else {
            let message = `Cloudinary upload failed (${xhr.status})`;
            try {
              const errorBody = JSON.parse(xhr.responseText);
              message = errorBody.error?.message || message;
            } catch {
            }
            reject(new Error(message));
          }
        };

        xhr.onerror = () => reject(new Error('Cloudinary network error'));
        xhr.send(formData);
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('Upload failed');
    }
  },

  async publishTrack(trackData: {
    title: string;
    artist: string;
    album?: string;
    coverUrl?: string;
    audioUrl: string;
    duration: number;
    genre?: string;
    cloudinaryPublicId?: string;
  }) {
    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/upload/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(trackData),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to publish track');
    }
    return body;
  },

  async publishVideo(videoData: {
    caption: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration: number;
    audioTrackTitle?: string;
    audioArtist?: string;
    hashtags?: string[];
    cloudinaryPublicId?: string;
  }) {
    // ENFORCE 90s LIMIT AGAIN ON CLIENT BEFORE DISPATCH
    if (videoData.duration > 90) {
      const mins = Math.floor(videoData.duration / 60);
      const secs = Math.floor(videoData.duration % 60).toString().padStart(2, '0');
      throw new Error(`Your video is ${mins}:${secs} (${Math.round(videoData.duration)}s). Videos must be 90 seconds or shorter.`);
    }

    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/upload/video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(videoData),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to publish video');
    }
    return body;
  },
};
