import { useSettingsStore } from '../stores/appStore';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
      </div>

      {/* Image Provider API Keys */}
      <section className="bg-gray-900 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-200">Image Provider API Keys</h2>
        <p className="text-sm text-gray-500">
          All keys are optional. If not set, the app uses fallback behavior (limited requests).
        </p>

        <div className="space-y-4">
          <SettingField
            label="Pixabay API Key"
            description="~5,000 requests/day free. Get yours at pixabay.com/api/docs/"
            value={settings.pixabayKey}
            onChange={(v) => updateSettings({ pixabayKey: v })}
            placeholder="Your Pixabay API key"
          />
          <SettingField
            label="Pexels API Key"
            description="200 requests/hour free. Get yours at pexels.com/api/"
            value={settings.pexelsKey}
            onChange={(v) => updateSettings({ pexelsKey: v })}
            placeholder="Your Pexels API key"
          />
          <SettingField
            label="Unsplash Access Key"
            description="50 requests/hour demo. Get yours at unsplash.com/developers"
            value={settings.unsplashKey}
            onChange={(v) => updateSettings({ unsplashKey: v })}
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
          onChange={(v) => updateSettings({ voicePreviewVoice: v })}
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
    </div>
  );
}

function SettingField({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <p className="text-xs text-gray-500">{description}</p>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
      />
    </div>
  );
}