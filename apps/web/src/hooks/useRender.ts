import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { renderApi, RenderJob } from '../api/renderApi';

export function useRender(projectId: string) {
  const [job, setJob] = useState<{ job: RenderJob } | null>(null);

  const startMutation = useMutation({
    mutationFn: () => renderApi.start(projectId),
    onSuccess: (data) => setJob(data),
  });

  return {
    startRender: startMutation.mutate,
    isStarting: startMutation.isPending,
    startError: startMutation.error,
    job: job?.job ?? null,
  };
}