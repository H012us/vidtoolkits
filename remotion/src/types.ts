export interface VideoPartData {
  index: number;
  title: string;
  script: string;
  images: string[];
  ttsPath: string | null;
  durationSeconds: number;
  keywords: string[];
}