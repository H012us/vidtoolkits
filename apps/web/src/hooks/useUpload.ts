import { useMutation } from '@tanstack/react-query';
import { uploadApi } from '../api/uploadApi';
import type { VideoProject } from '../types';

export function useUpload() {
  return useMutation<{ project: VideoProject }, Error, File>({
    mutationFn: (file) => uploadApi.uploadMarkdown(file),
  });
}