import { Download } from 'lucide-react';

interface RenderProgressProps {
  progress: number;
  currentStep: string | null;
  log: string[];
  connected: boolean;
  status: string;
  outputPath?: string;
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

export function RenderProgress({
  progress,
  currentStep,
  log,
  connected,
  status,
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

  return (
    <section className="bg-gray-900 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Render Progress</h2>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            isComplete ? 'bg-green-900 text-green-300' :
            isFailed ? 'bg-red-900 text-red-300' :
            connected ? 'bg-brand-900 text-brand-300' : 'bg-gray-800 text-gray-400'
          }`}>
            {isComplete ? 'Completed' : isFailed ? 'Failed' : connected ? 'Rendering' : 'Connecting...'}
          </span>
          {connected && !isComplete && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
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
          const isCurrent = step === currentStep;
          const isDone = steps.indexOf(currentStep ?? '') > i ||
            steps.indexOf(currentStep ?? '') === i && progress === 100;

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

      {/* Log */}
      <div className="bg-gray-950 rounded-lg p-4 h-48 overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-gray-600 text-sm">Waiting for progress...</p>
        ) : (
          <div className="space-y-1">
            {log.map((line, i) => (
              <p key={i} className="text-xs font-mono text-gray-400 whitespace-pre-wrap">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}