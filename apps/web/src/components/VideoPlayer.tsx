import { Download, Play } from 'lucide-react';

interface VideoPlayerProps {
  downloadUrl: string;
}

export function VideoPlayer({ downloadUrl }: VideoPlayerProps) {
  return (
    <section className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="aspect-video bg-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-900/50 text-brand-400">
            <Play className="h-8 w-8 ml-1" />
          </div>
          <p className="text-gray-400 text-sm">Video ready to download</p>
        </div>
      </div>
      <div className="p-4 flex justify-end">
        <a
          href={downloadUrl}
          download
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Download Video
        </a>
      </div>
    </section>
  );
}