import axios from 'axios';
import type { IMediaProvider, MediaAsset } from '@vidtoolkits/shared';
import { v4 as uuidv4 } from 'uuid';

export class PexelsProvider implements IMediaProvider {
  readonly name = 'pexels' as const;
  readonly priority = 2;

  constructor(private readonly apiKey?: string) {}

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await axios.get('https://api.pexels.com/v1/search', {
        params: { query: 'test', per_page: 1 },
        headers: { Authorization: this.apiKey },
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async search(keywords: string[], count = 5): Promise<MediaAsset[]> {
    const query = keywords.join(' ');
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: { query, per_page: count, orientation: 'landscape' },
      headers: { Authorization: this.apiKey },
      timeout: 15000,
    });

    const photos = response.data.photos ?? [];
    return photos.slice(0, count).map((photo: PexelsPhoto) => ({
      id: uuidv4(),
      url: photo.url,
      thumbnailUrl: photo.src.medium,
      source: 'pexels' as const,
      sourceId: String(photo.id),
      alt: photo.alt ?? keywords.join(', '),
      width: photo.width,
      height: photo.height,
      attribution: `Pexels — ${photo.photographer}`,
    }));
  }
}

interface PexelsPhoto {
  id: number;
  url: string;
  alt: string;
  width: number;
  height: number;
  src: { medium: string; large: string; original: string };
  photographer: string;
  photographer_url: string;
}