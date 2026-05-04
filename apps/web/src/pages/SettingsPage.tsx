import { useEffect, useState, useCallback } from 'react';
import { useSettingsStore } from '../stores/appStore';
import { ArrowLeft, CheckCircle, XCircle, Loader2, RefreshCw, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { settingsApi } from '../api/settingsApi';
import { healthApi } from '../api/healthApi';
import type { AppSettings } from '../types';
import type { DetailedHealth } from '../api/healthApi';

const defaultSettings: AppSettings = {
  pixabayKey: '',
  pexelsKey: '',
  unsplashKey: '',
  voicePreviewVoice: 'en-US-AriaNeural',
};

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  // Load server settings on mount
  useEffect(() => {
    settingsApi.get().then(serverSettings => {
      updateSettings(serverSettings);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(async (updates: Partial<AppSettings>) => {
    setSaving(true);
    try {
      const updated = await settingsApi.update(updates);
      updateSettings(updated);
      setLastSaved(new Date());
    } catch {
      // keep local state on failure
    } finally {
      setSaving(false);
    }
  }, [updateSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 text-gray-400 hover:text-gray-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        </div>
        {saving && (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {!saving && lastSaved && (
          <span className="text-sm text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      {/* Image Provider API Keys */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-200">Image Provider API Keys</h2>
        <p className="text-sm text-gray-500">
          All keys are optional. If not set, the app uses fallback behavior (limited requests).
          Keys are saved to the server and persist across restarts.
        </p>

        <div className="space-y-4">
          <ApiKeyField
            label="Pixabay API Key"
            description="~5,000 requests/day free. Get yours at pixabay.com/api/docs/"
            value={settings.pixabayKey}
            onSave={(v) => handleSave({ pixabayKey: v })}
            placeholder="Your Pixabay API key"
          />
          <ApiKeyField
            label="Pexels API Key"
            description="200 requests/hour free. Get yours at pexels.com/api/"
            value={settings.pexelsKey}
            onSave={(v) => handleSave({ pexelsKey: v })}
            placeholder="Your Pexels API key"
          />
          <ApiKeyField
            label="Unsplash Access Key"
            description="50 requests/hour demo. Get yours at unsplash.com/developers"
            value={settings.unsplashKey}
            onSave={(v) => handleSave({ unsplashKey: v })}
            placeholder="Your Unsplash Access Key"
          />
        </div>
      </section>

      {/* Voice Settings */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-200">Voice Settings</h2>
        <SettingField
          label="Default Voice"
          description="Used when no voice is specified in the markdown front matter"
          value={settings.voicePreviewVoice}
          onSave={(v) => handleSave({ voicePreviewVoice: v })}
          placeholder="en-US-AriaNeural"
        />
        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-300">Voicebox</h3>
          <p className="text-sm text-gray-500">
            Voicebox runs locally on your machine. Install from{' '}
            <a href="https://github.com/jamiepine/voicebox" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
              github.com/jamiepine/voicebox
            </a>
            . No API key needed — everything runs on your device.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">
              Local — no internet needed
            </span>
            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">
              50+ voices
            </span>
          </div>
        </div>
      </section>

      {/* System Info */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">System</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Target Hardware</p>
            <p className="text-gray-300">i7 10th gen / 16GB RAM</p>
          </div>
          <div>
            <p className="text-gray-500">Node.js Heap</p>
            <p className="text-gray-300">4GB max</p>
          </div>
          <div>
            <p className="text-gray-500">Image Concurrency</p>
            <p className="text-gray-300">6 parallel</p>
          </div>
          <div>
            <p className="text-gray-500">TTS Concurrency</p>
            <p className="text-gray-300">2 parallel</p>
          </div>
        </div>
      </section>

      {/* System Health */}
      <SystemHealthSection />
    </div>
  );
}

function SystemHealthSection() {
  const [health, setHealth] = useState<DetailedHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<Record<string, { success: boolean; error?: string } | null>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const report = await healthApi.getDetailed();
      setHealth(report);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const testProvider = async (name: string) => {
    setTesting(name);
    setTestFeedback(prev => ({ ...prev, [name]: null }));
    try {
      const result = await healthApi.testProvider(name);
      if (result.available) {
        setTestFeedback(prev => ({ ...prev, [name]: { success: true } }));
      } else {
        setTestFeedback(prev => ({ ...prev, [name]: { success: false, error: result.error } }));
      }
      await refresh();
    } catch (err) {
      setTestFeedback(prev => ({ ...prev, [name]: { success: false, error: (err as Error).message } }));
    } finally {
      setTesting(null);
      setTimeout(() => setTestFeedback(prev => ({ ...prev, [name]: null })), 5000);
    }
  };

  if (loading) {
    return (
      <section className="bg-gray-900 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">System Health</h2>
          <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
        </div>
        <p className="text-sm text-gray-500">Checking system services…</p>
      </section>
    );
  }

  if (!health) return null;

  return (
    <section className="bg-gray-900 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">System Health</h2>
        <button
          onClick={refresh}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* TTS Services */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Text-to-Speech</p>
        <div className="space-y-2">
          <HealthRow
            name="Voicebox"
            sub="Local TTS (priority 1)"
            status={health.voicebox.status === 'available' ? 'ok' : 'fail'}
            detail={health.voicebox.latencyMs != null ? `${health.voicebox.latencyMs}ms` : health.voicebox.message}
          />
          <HealthRow
            name="Edge-TTS"
            sub="Cloud TTS (fallback)"
            status={health.edgeTts.status === 'available' ? 'ok' : 'fail'}
            detail="Microsoft servers"
          />
        </div>
      </div>

      {/* Image Providers */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Image Providers</p>
        <div className="space-y-2">
          {health.imageProviders.map(p => (
            <div key={p.name} className="flex items-center justify-between">
              <HealthRow
                name={p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                sub={p.configured ? `Configured` : 'Not configured'}
                status={p.available ? 'ok' : p.configured ? 'warn' : 'off'}
                detail={p.latencyMs != null ? `${p.latencyMs}ms` : p.error}
              />
              {p.configured && (
                <div className="flex items-center gap-2">
                  {testFeedback[p.name]?.success != null && (
                    testFeedback[p.name]!.success
                      ? <CheckCircle className="h-3 w-3 text-green-400" />
                      : <span className="text-xs text-red-400 max-w-24 truncate" title={testFeedback[p.name]!.error}>✗ {testFeedback[p.name]!.error ?? 'failed'}</span>
                  )}
                  <button
                    onClick={() => testProvider(p.name)}
                    disabled={testing === p.name}
                    className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
                  >
                    {testing === p.name ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Binaries */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">System Binaries</p>
        <div className="space-y-2">
          <HealthRow
            name="FFmpeg"
            sub={health.binaries.ffmpeg.version ? `v${health.binaries.ffmpeg.version}` : 'Not found'}
            status={health.binaries.ffmpeg.available ? 'ok' : 'fail'}
            detail={health.binaries.ffmpeg.error}
          />
          <HealthRow
            name="FFprobe"
            sub={health.binaries.ffprobe.available ? 'Available' : 'Not found'}
            status={health.binaries.ffprobe.available ? 'ok' : 'fail'}
            detail={health.binaries.ffprobe.error}
          />
          <HealthRow
            name="Remotion"
            sub={health.remotion.available ? 'Ready' : 'Not found'}
            status={health.remotion.available ? 'ok' : 'fail'}
            detail={health.remotion.error}
          />
        </div>
      </div>
    </section>
  );
}

function HealthRow({
  name,
  sub,
  status,
  detail,
}: {
  name: string;
  sub: string;
  status: 'ok' | 'warn' | 'fail' | 'off';
  detail?: string;
}) {
  const colors = {
    ok: 'bg-green-900 text-green-300',
    warn: 'bg-yellow-900 text-yellow-300',
    fail: 'bg-red-900 text-red-300',
    off: 'bg-gray-800 text-gray-500',
  };
  const icons = {
    ok: <CheckCircle className="h-3 w-3" />,
    warn: <Zap className="h-3 w-3" />,
    fail: <XCircle className="h-3 w-3" />,
    off: <span className="h-3 w-3 rounded-full border border-gray-600" />,
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${colors[status]}`}>
        {icons[status]}
      </span>
      <div className="flex-1">
        <p className="text-sm text-gray-200">{name}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      {detail && <p className="text-xs text-gray-500 text-right max-w-32 truncate">{detail}</p>}
    </div>
  );
}

function ApiKeyField({
  label,
  description,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onSave(localValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        {saved && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> saved
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">{description}</p>
      <div className="relative">
        <input
          type="password"
          value={localValue}
          onChange={(e) => { setLocalValue(e.target.value); setSaved(false); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-20 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <button
          onClick={() => { onSave(localValue); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-400 hover:text-brand-300 px-2 py-1 rounded transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SettingField({
  label,
  description,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onSave(localValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        {saved && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> saved
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">{description}</p>
      <div className="relative">
        <input
          type="text"
          value={localValue}
          onChange={(e) => { setLocalValue(e.target.value); setSaved(false); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-20 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <button
          onClick={() => { onSave(localValue); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-400 hover:text-brand-300 px-2 py-1 rounded transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}