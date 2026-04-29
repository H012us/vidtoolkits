import axios from 'axios';
import type { IMediaProvider, MediaAsset } from '@vidtoolkits/shared';
import { v4 as uuidv4 } from 'uuid';

export class PixabayProvider implements IMediaProvider {
  readonly name = 'pixabay' as const;
  readonly priority = 1;

  constructor(private readonly apiKey?: string) {}

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await axios.get('https://pixabay.com/api/', {
        params: { key: this.apiKey, q: 'test', per_page: 1 },
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async search(keywords: string[], count = 5): Promise<MediaAsset[]> {
    const query = keywords.join(' ');
    const response = await axios.get('https://pixabay.com/api/', {
      params: {
        key: this.apiKey,
        q: query,
        image_type: 'photo',
        orientation: 'horizontal',
        per_page: count,
        safesearch: 'true',
      },
      timeout: 15000,
    });

    const hits = response.data.hits ?? [];
    return hits.slice(0, count).map((hit: PixabayHit) => ({
      id: uuidv4(),
      url: hit.pageURL,
      thumbnailUrl: hit.preURL ?? hit.webformatURL,
      source: 'pixabay' as const,
      sourceId: String(hit.id),
      alt: hit.tags ?? keywords.join(', '),
      width: hit.imageWidth,
      height: hit.imageHeight,
      attribution: `Pixabay — ${hit.user}`,
    }));
  }
}

interface PixabayHit {
  id: number;
  pageURL: string;
  previewURL: string;
  webformatURL: string;
  fullHDURL: string;
  imageWidth: number;
  imageHeight: number;
  tags: string;
  user: string;
  preURL?: string;
}