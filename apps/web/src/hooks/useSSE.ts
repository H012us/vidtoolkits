import { useEffect, useRef, useState, useCallback } from 'react';
import type { SSEEvent } from '../api/renderApi';

interface UseSSEOptions {
  onStep?: (step: string, progress: number, message: string, partIndex?: number, partTitle?: string) => void;
  onError?: (message: string) => void;
  onComplete?: (data: unknown) => void;
  onHeartbeat?: () => void;
  onStopped?: () => void;
}

export function useSSE(projectId: string | null, options: UseSSEOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!projectId) return;

    const es = new EventSource(`/api/render/${projectId}/status`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        if (data.type === 'heartbeat') {
          options.onHeartbeat?.();
          return;
        }

        if (data.type === 'stopped') {
          setConnected(false);
          setLog(l => [...l, `[STOPPED] ${data.message ?? 'Render cancelled by user'}`]);
          options.onStopped?.();
          return;
        }

        if (data.type === 'step' || data.type === 'progress') {
          setCurrentStep(data.step ?? null);
          setProgress(data.progress ?? 0);
          const prefix = data.partIndex !== undefined ? `[${data.step ?? 'step'}] Part ${data.partIndex + 1}` : `[${data.step ?? 'progress'}]`;
          const msg = data.partTitle ? `${prefix} (${data.partTitle}): ${data.message}` : `${prefix} ${data.message ?? ''}`;
          setLog(l => [...l, msg.trim()]);
          options.onStep?.(data.step ?? '', data.progress ?? 0, data.message ?? '', data.partIndex, data.partTitle);
        }

        if (data.type === 'error') {
          const prefix = data.partIndex !== undefined ? `Part ${data.partIndex + 1}` : 'Error';
          setLog(l => [...l, `[ERROR] ${prefix}: ${data.message}`]);
          options.onError?.(data.message ?? 'Unknown error');
        }

        if (data.type === 'complete') {
          const result = data.data as { success: boolean; outputPath: string | null; errors?: { message: string }[] };
          setProgress(100);
          setCurrentStep(null);
          if (result?.success && result?.outputPath) {
            setLog(l => [...l, '[COMPLETE] Video rendered successfully']);
            options.onComplete?.(data.data);
          } else {
            const errMsg = result?.errors?.[0]?.message ?? 'Render failed — check logs';
            setLog(l => [...l, `[ERROR] ${errMsg}`]);
            options.onError?.(errMsg);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [projectId]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      esRef.current?.close();
    };
  }, [connect]);

  return { connected, currentStep, progress, log };
}