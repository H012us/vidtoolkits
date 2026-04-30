import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useRender } from '../hooks/useRender';
import { useSSE } from '../hooks/useSSE';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { RenderProgress } from '../components/RenderProgress';
import { VideoPlayer } from '../components/VideoPlayer';
import { renderApi } from '../api/renderApi';
import { ArrowLeft, Play, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, error } = useProject(id);
  const { startRender, isStarting, job } = useRender(id ?? '');
  const { health, loading: healthLoading, refresh: refreshHealth } = useHealthCheck();
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [partStatuses, setPartStatuses] = useState<Array<{ title: string; status: 'pending' | 'running' | 'completed' | 'failed' }>>([]);

  const { connected, progress, log } = useSSE(id ?? null, {
    onComplete: () => toast.success('Video rendered successfully!'),
    onError: (msg) => toast.error(`Render error: ${msg}`),
    onStep: (_step, _progress, _message, partIndex, partTitle) => {
      if (partIndex !== undefined) {
        setPartStatuses(prev => {
          const next = [...prev];
          next[partIndex] = { title: partTitle ?? `Part ${partIndex + 1}`, status: 'running' };
          return next;
        });
      }
    },
  });

  const handleStop = useCallback(async () => {
    if (!id) return;
    try {
      await renderApi.cancel(id);
    } catch {
      toast.error('Failed to cancel render');
    }
  }, [id]);

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

  const displayPartStatuses = partStatuses.length > 0
    ? partStatuses
    : project.parts.map((p: any) => ({ title: p.title, status: p.status as 'pending' | 'running' | 'completed' | 'failed' }));

  const allHealthy = health
    && health.voicebox.status === 'available'
    && health.imageProviders.some(p => p.available && p.configured)
    && health.binaries.ffmpeg.available
    && health.binaries.ffprobe.available
    && health.remotion.available;

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refreshHealth(); setShowHealthModal(true); }}
              className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm px-3 py-2 border border-gray-700 rounded-lg transition-colors"
            >
              {healthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : allHealthy ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              Check Readiness
            </button>
            <button
              onClick={() => startRender()}
              disabled={isStarting}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Play className="h-4 w-4" />
              {isStarting ? 'Starting...' : 'Render Video'}
            </button>
          </div>
        )}
      </div>

      {/* Health Modal */}
      {showHealthModal && (
        <HealthModal health={health} loading={healthLoading} onClose={() => setShowHealthModal(false)} onRefresh={refreshHealth} />
      )}

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
          onStop={isRendering ? handleStop : undefined}
          partStatuses={displayPartStatuses}
        />
      )}

      {/* Video Player */}
      {isComplete && job?.outputPath && (
        <VideoPlayer downloadUrl={`/api/render/${id}/download`} />
      )}
    </div>
  );
}

function HealthModal({
  health,
  loading,
  onClose,
  onRefresh,
}: {
  health: any;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const allGreen = health
    && health.voicebox.status === 'available'
    && health.imageProviders.some((p: any) => p.available && p.configured)
    && health.binaries.ffmpeg.available
    && health.binaries.ffprobe.available
    && health.remotion.available;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4 mx-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-200">System Readiness</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
          </div>
        ) : health ? (
          <div className="space-y-3">
            {allGreen ? (
              <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <p className="text-sm text-green-300">All systems ready! You can start rendering.</p>
              </div>
            ) : (
              <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-yellow-300">Some services are unavailable. Fix the issues below before rendering.</p>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <ServiceCheck label="Voicebox TTS" status={health.voicebox.status === 'available'} detail={health.voicebox.latencyMs != null ? `${health.voicebox.latencyMs}ms` : health.voicebox.message} />
              <ServiceCheck label="Edge-TTS" status={health.edgeTts.status === 'available'} detail="Always available" />
              <ServiceCheck label="Image Providers" status={health.imageProviders.some((p: any) => p.available)} detail={health.imageProviders.filter((p: any) => p.available).map((p: any) => p.name).join(', ') || 'None available'} />
              <ServiceCheck label="FFmpeg" status={health.binaries.ffmpeg.available} detail={health.binaries.ffmpeg.version ? `v${health.binaries.ffmpeg.version}` : health.binaries.ffmpeg.error} />
              <ServiceCheck label="FFprobe" status={health.binaries.ffprobe.available} detail={health.binaries.ffprobe.error ?? 'Available'} />
              <ServiceCheck label="Remotion" status={health.remotion.available} detail={health.remotion.error ?? 'Ready'} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">Could not load health status.</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onRefresh}
            className="flex-1 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg py-2 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2 transition-colors"
          >
            {allGreen ? 'Ready to Render' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceCheck({ label, status, detail }: { label: string; status: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      {status
        ? <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
        : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
      }
      <span className="text-gray-300 flex-1">{label}</span>
      <span className="text-gray-500 text-xs text-right max-w-32 truncate">{detail ?? (status ? 'OK' : 'Unavailable')}</span>
    </div>
  );
}