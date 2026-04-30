import { useState, useEffect, useCallback } from 'react';
import { healthApi } from '../api/healthApi';
import type { DetailedHealth } from '../api/healthApi';

export function useHealthCheck() {
  const [health, setHealth] = useState<DetailedHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await healthApi.getDetailed();
      setHealth(report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { health, loading, error, refresh };
}