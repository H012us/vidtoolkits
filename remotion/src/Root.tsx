import React from 'react';
import { AbsoluteFill } from 'remotion';
import { VideoPart } from './VideoPart';
import type { VideoPartData } from './types';

export interface CompositionData {
  title: string;
  fps: number;
  width: number;
  height: number;
  parts: VideoPartData[];
  workDir: string;
}

export const VideoComposition: React.FC<{ data: CompositionData }> = ({ data }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        width: data.width,
        height: data.height,
      }}
    >
      {data.parts.map((part, i) => (
        <VideoPart key={i} part={part} index={i} />
      ))}
    </AbsoluteFill>
  );
};