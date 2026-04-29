import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useUpdateProject } from '../hooks/useProject';
import { useRender } from '../hooks/useRender';
import { useSSE } from '../hooks/useSSE';
import { RenderProgress } from '../components/RenderProgress';
import { VideoPlayer } from '../components/VideoPlayer';
import { ArrowLeft, Play, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, error } = useProject(id);
  const { startRender, isStarting, job } = useRender(id ?? '');

  const { connected, progress, log } = useSSE(id ?? null, {
    onComplete: () => toast.success('Video rendered successfully!'),
    onError: (msg) => toast.error(`Render error: ${msg}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Project not found</p>
        <button onClick={() => navigate('/')} className="text-brand-400 hover:underline">
          Back to home
        </button>
      </div>
    );
  }

  const isRendering = job?.status === 'running' || project.status === 'processing';
  const isComplete = job?.status === 'completed' || project.status === 'completed';

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-100">{project.title}</h1>
          <p className="text-sm text-gray-500">
            {project.parts.length} parts &middot; {project.style} style &middot; voice: {project.voiceName}
          </p>
        </div>
        {!isRendering && !isComplete && (
          <button
            onClick={() => startRender()}
            disabled={isStarting}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Play className="h-4 w-4" />
            {isStarting ? 'Starting...' : 'Render Video'}
          </button>
        )}
      </div>

      {/* Parts List */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Script Parts</h2>
        <div className="space-y-4">
          {project.parts.map((part: any) => (
            <div key={part.partIndex} className="bg-gray-900 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-200">
                  Part {part.partIndex + 1}: {part.title}
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  part.status === 'completed' ? 'bg-green-900 text-green-300' :
                  part.status === 'failed' ? 'bg-red-900 text-red-300' :
                  part.status === 'running' ? 'bg-brand-900 text-brand-300' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {part.status}
                </span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed">{part.script}</p>

              {part.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {part.keywords.map((kw: string) => (
                    <span key={kw} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {part.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {part.images.slice(0, 3).map((img: any) => (
                    <img
                      key={img.id}
                      src={img.thumbnailUrl ?? img.url}
                      alt={img.alt}
                      className="h-16 rounded object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}

              {part.durationSeconds && (
                <p className="text-xs text-gray-600">
                  Duration: {part.durationSeconds.toFixed(1)}s
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Render Progress */}
      {(isRendering || isComplete) && (
        <RenderProgress
          progress={progress}
          currentStep={job?.currentStep ?? null}
          log={log}
          connected={connected}
          status={job?.status ?? project.status}
          outputPath={job?.outputPath ?? project.outputPath ?? undefined}
        />
      )}

      {/* Video Player */}
      {isComplete && job?.outputPath && (
        <VideoPlayer downloadUrl={`/api/render/${id}/download`} />
      )}
    </div>
  );
}