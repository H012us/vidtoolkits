import { MediaAsset } from '../types/VideoProject.js';

export interface IMediaProvider {
  readonly name: ProviderName;
  readonly priority: number;

  search(keywords: string[], count: number): Promise<MediaAsset[]>;
  isAvailable(): Promise<boolean>;
}

export type ProviderName = 'pixabay' | 'pexels' | 'unsplash';

export interface MediaSearchOptions {
  count?: number;
  minWidth?: number;
  minHeight?: number;
  orientation?: 'horizontal' | 'vertical' | 'any';
  safe?: boolean;
}