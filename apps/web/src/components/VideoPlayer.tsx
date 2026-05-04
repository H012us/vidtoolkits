import { Download, Play } from 'lucide-react';

interface VideoPlayerProps {
  downloadUrl: string;
}

export function VideoPlayer({ downloadUrl }: VideoPlayerProps) {
  return (
    <section className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="aspect-video bg-black">
        <video
          controls
          src={downloadUrl}
          className="w-full h-full"
        >
          Your browser does not support inline video playback.
        </video>
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