import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig, Img } from 'remotion';
import type { VideoPartData } from './types';

interface VideoPartProps {
  part: VideoPartData;
  index: number;
}

export const VideoPart: React.FC<VideoPartProps> = ({ part, index }) => {
  useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = Math.ceil(part.durationSeconds * fps);

  return (
    <Sequence from={index * durationFrames} durationInFrames={durationFrames}>
      <AbsoluteFill
        style={{
          backgroundColor: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {part.images && part.images.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
            <Img
              src={part.images[0]}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            zIndex: 1,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            marginBottom: 16,
          }}
        >
          {part.title}
        </div>

        <div
          style={{
            fontSize: 24,
            color: '#e5e7eb',
            textAlign: 'center',
            maxWidth: 800,
            zIndex: 1,
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            padding: '0 32px',
            lineHeight: 1.6,
          }}
        >
          {part.script}
        </div>

        {part.ttsPath && (
          <Audio src={part.ttsPath} />
        )}
      </AbsoluteFill>
    </Sequence>
  );
};