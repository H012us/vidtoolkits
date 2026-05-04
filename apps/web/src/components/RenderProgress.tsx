import { Download, Square, CheckCircle, XCircle } from 'lucide-react';

interface RenderProgressProps {
  progress: number;
  currentStep: string | null;
  log: string[];
  connected: boolean;
  status: string;
  outputPath?: string;
  onStop?: () => void;
  partStatuses?: Array<{ title: string; status: 'pending' | 'running' | 'completed' | 'failed' }>;
  partErrors?: Record<number, string>;
}

const STEP_LABELS: Record<string, string> = {
  PARSE_MARKDOWN: 'Parse Markdown',
  FETCH_IMAGES: 'Fetch Images',
  GENERATE_TTS: 'Generate Voice',
  MEASURE_DURATIONS: 'Measure Durations',
  ASSEMBLE_COMPOSITION: 'Assemble Composition',
  RENDER_VIDEO: 'Render Video',
  POST_PROCESS: 'Post-Process',
  DELIVER_RESULT: 'Deliver Result',
};

function logLineColor(line: string): string {
  if (line.includes('[ERROR]') || line.includes('Failed') || line.includes('failed')) return 'text-red-400';
  if (line.includes('[COMPLETE]') || line.includes('successfully')) return 'text-green-400';
  if (line.includes('[STOPPED]') || line.includes('cancelled')) return 'text-yellow-400';
  if (line.includes('[WARN')) return 'text-yellow-300';
  return 'text-gray-400';
}

function timestamp(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

export function RenderProgress({
  progress,
  currentStep,
  log,
  connected,
  status,
  onStop,
  partStatuses,
  partErrors = {},
}: RenderProgressProps) {
  const steps = [
    'PARSE_MARKDOWN',
    'FETCH_IMAGES',
    'GENERATE_TTS',
    'MEASURE_DURATIONS',
    'ASSEMBLE_COMPOSITION',
    'RENDER_VIDEO',
    'POST_PROCESS',
    'DELIVER_RESULT',
  ];

  const isComplete = status === 'completed';
  const isFailed = status === 'failed';
  const isStopped = status === 'stopped';
  const isActive = connected && !isComplete && !isFailed;

  return (
    <section className="bg-gray-900 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Render Progress</h2>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            isComplete ? 'bg-green-900 text-green-300' :
            isFailed ? 'bg-red-900 text-red-300' :
            isStopped ? 'bg-yellow-900 text-yellow-300' :
            connected ? 'bg-brand-900 text-brand-300' : 'bg-gray-800 text-gray-400'
          }`}>
            {isComplete ? 'Completed' : isFailed ? 'Failed' : isStopped ? 'Stopped' : connected ? 'Rendering' : 'Connecting...'}
          </span>
          {isActive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </span>
          )}
          {isActive && onStop && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 px-2 py-1 rounded-lg transition-colors"
            >
              <Square className="h-3 w-3" /> Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isFailed ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-brand-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{progress}%</span>
          {currentStep && <span>{STEP_LABELS[currentStep] ?? currentStep}</span>}
        </div>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, i) => {
          const currentIdx = steps.indexOf(currentStep ?? '');
          const isCurrent = step === currentStep;
          const isDone = currentIdx > i || (currentIdx === i && progress === 100 && !isFailed);

          return (
            <div
              key={step}
              className={`text-center text-xs py-1.5 px-2 rounded-lg ${
                isCurrent ? 'bg-brand-900 text-brand-300 ring-1 ring-brand-500' :
                isDone ? 'bg-green-900/30 text-green-400' :
                'bg-gray-800 text-gray-600'
              }`}
            >
              {STEP_LABELS[step] ?? step}
            </div>
          );
        })}
      </div>

      {/* Part Statuses */}
      {partStatuses && partStatuses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Parts</p>
          <div className="grid grid-cols-3 gap-2">
            {partStatuses.map((part, i) => (
              <div key={i} className={`text-xs py-1.5 px-3 rounded-lg flex flex-col gap-1 ${
                part.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                part.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                part.status === 'running' ? 'bg-brand-900/30 text-brand-400' :
                'bg-gray-800 text-gray-600'
              }`}>
                <div className="flex items-center gap-2">
                  {part.status === 'completed' && <CheckCircle className="h-3 w-3 flex-shrink-0" />}
                  {part.status === 'failed' && <XCircle className="h-3 w-3 flex-shrink-0" />}
                  {part.status === 'running' && <span className="h-3 w-3 rounded-full border border-brand-400 border-t-transparent animate-spin flex-shrink-0" />}
                  <span className="truncate">Part {i + 1}: {part.title}</span>
                </div>
                {part.status === 'failed' && partErrors[i] && (
                  <p className="text-red-300 text-xs pl-5 truncate" title={partErrors[i]}>{partErrors[i]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="bg-gray-950 rounded-lg p-4 h-48 overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-gray-600 text-sm">Waiting for progress...</p>
        ) : (
          <div className="space-y-1">
            {log.map((line, i) => (
              <p key={i} className={`text-xs font-mono ${logLineColor(line)} whitespace-pre-wrap`}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}