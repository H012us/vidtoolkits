import axios from 'axios';
import type { IMediaProvider, MediaAsset } from '@vidtoolkits/shared';
import { v4 as uuidv4 } from 'uuid';

export class UnsplashProvider implements IMediaProvider {
  readonly name = 'unsplash' as const;
  readonly priority = 3;

  constructor(private readonly accessKey?: string) {}

  async isAvailable(): Promise<boolean> {
    if (!this.accessKey) return false;
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: 'test', per_page: 1 },
      headers: { Authorization: `Client-ID ${this.accessKey}` },
      timeout: 5000,
    });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    return true;
  }

  async search(keywords: string[], count = 5): Promise<MediaAsset[]> {
    const query = keywords.join(' ');
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query, per_page: count, orientation: 'landscape' },
      headers: { Authorization: `Client-ID ${this.accessKey}` },
      timeout: 15000,
    });

    const results = response.data.results ?? [];
    return results.slice(0, count).map((photo: UnsplashPhoto) => ({
      id: uuidv4(),
      url: photo.links.html,
      thumbnailUrl: photo.urls.thumb,
      source: 'unsplash' as const,
      sourceId: photo.id,
      alt: photo.alt_description ?? keywords.join(', '),
      width: photo.width,
      height: photo.height,
      attribution: `Unsplash — ${photo.user.name}`,
    }));
  }
}

interface UnsplashPhoto {
  id: string;
  urls: { thumb: string; small: string; regular: string; full: string };
  alt_description: string | null;
  width: number;
  height: number;
  links: { html: string };
  user: { name: string; username: string };
}