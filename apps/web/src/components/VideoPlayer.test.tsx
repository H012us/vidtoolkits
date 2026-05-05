import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoPlayer } from './VideoPlayer';

describe('VideoPlayer — inline playback (A.5)', () => {
  const testUrl = '/api/render/test-id/download';

  it('A.5.1 renders <video controls> element', () => {
    render(<VideoPlayer downloadUrl={testUrl} />);
    // <video> doesn't have a standard ARIA role in jsdom, use querySelector
    const videoEl = document.querySelector('video') as HTMLVideoElement | null;
    expect(videoEl).not.toBeNull();
    expect(videoEl!.hasAttribute('controls')).toBe(true);
  });

  it('A.5.2 src attribute equals the downloadUrl prop', () => {
    render(<VideoPlayer downloadUrl={testUrl} />);
    const videoEl = document.querySelector('video') as HTMLVideoElement | null;
    expect(videoEl).not.toBeNull();
    expect(videoEl!.src).toContain('/api/render/test-id/download');
  });

  it('A.5.3 <a download> present with correct href', () => {
    render(<VideoPlayer downloadUrl={testUrl} />);
    const anchor = screen.getByRole('link') as HTMLAnchorElement | undefined;
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toContain('/api/render/test-id/download');
    expect(anchor!.download).toBe('');
  });
});
