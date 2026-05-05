import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from './useSSE';

// Mock EventSource globally
const mockEventSourceInstance = {
  onopen: null as ((e: any) => void) | null,
  onmessage: null as ((e: any) => void) | null,
  onerror: null as ((e: any) => void) | null,
  close: vi.fn(),
  url: '',
};

const MockEventSource = vi.fn().mockImplementation(() => {
  mockEventSourceInstance.onopen = null;
  mockEventSourceInstance.onmessage = null;
  mockEventSourceInstance.onerror = null;
  mockEventSourceInstance.close = vi.fn();
  return mockEventSourceInstance;
}) as any;

vi.stubGlobal('EventSource', MockEventSource);

describe('useSSE — reconnection (A.6)', () => {
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeoutSpy.mockRestore();
  });

  it('A.6.1 onerror schedules a retry via setTimeout', () => {
    renderHook(() =>
      useSSE('test-project-id', { onStep: vi.fn(), onComplete: vi.fn() })
    );

    act(() => {
      mockEventSourceInstance.onopen?.({} as any);
    });

    act(() => {
      mockEventSourceInstance.onerror?.({} as any);
    });

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    const [, delay] = setTimeoutSpy.mock.calls[0];
    expect(delay).toBe(1000); // BASE_DELAY_MS
  });

  it('A.6.2 second error triggers retry with delay > first delay (exponential backoff)', () => {
    renderHook(() =>
      useSSE('test-project-id', { onStep: vi.fn(), onComplete: vi.fn() })
    );

    act(() => { mockEventSourceInstance.onopen?.({} as any); });

    // First error
    act(() => { mockEventSourceInstance.onerror?.({} as any); });
    const firstDelay = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1] as number;
    expect(firstDelay).toBe(1000);

    // Advance clock to fire the retry (which creates a new EventSource)
    act(() => { vi.advanceTimersByTime(firstDelay + 1); });

    // Close the new connection and trigger another error
    act(() => {
      MockEventSource.mock.results[MockEventSource.mock.results.length - 1].value.close();
      mockEventSourceInstance.onerror?.({} as any);
    });

    const secondDelay = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1] as number;
    expect(secondDelay).toBeGreaterThan(firstDelay); // 2000 > 1000
  });

  it('A.6.3 after 6 consecutive errors (5 retries), setTimeout NOT called', () => {
    renderHook(() =>
      useSSE('test-project-id', { onStep: vi.fn(), onComplete: vi.fn() })
    );

    act(() => { mockEventSourceInstance.onopen?.({} as any); });

    // Fire 6 errors — only first 5 should schedule retries (MAX_RETRIES=5)
    for (let i = 0; i < 6; i++) {
      act(() => { mockEventSourceInstance.onerror?.({} as any); });
      if (i < 5) {
        act(() => { vi.advanceTimersByTime(1000 * Math.pow(2, i) + 1); });
        act(() => {
          MockEventSource.mock.results[MockEventSource.mock.results.length - 1].value.close();
        });
      }
    }

    // After 6th error, no new setTimeout scheduled (5 retries exhausted)
    expect(setTimeoutSpy).toHaveBeenCalledTimes(5);
  });

  it('A.6.4 onopen resets retry counter to 0', () => {
    renderHook(() =>
      useSSE('test-project-id', { onStep: vi.fn(), onComplete: vi.fn() })
    );

    act(() => { mockEventSourceInstance.onopen?.({} as any); });

    // First error
    act(() => { mockEventSourceInstance.onerror?.({} as any); });
    act(() => { vi.advanceTimersByTime(1001); });

    // Simulate reconnect and successful onopen (counter resets)
    act(() => {
      MockEventSource.mock.results[MockEventSource.mock.results.length - 1].value.close();
      const newEs = new MockEventSource();
      newEs.onopen?.({} as any);
    });

    // Fire error after reset — delay should be BASE_DELAY (1s), not 2s
    act(() => { mockEventSourceInstance.onerror?.({} as any); });

    const resetDelay = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1] as number;
    expect(resetDelay).toBe(1000); // Back to base delay after counter reset
  });
});
