import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export function TemplateEditor() {
  const navigate = useNavigate();
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!markdown.trim()) {
      setError('Please fill in the template before creating.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post('/projects/from-template', { markdown });
      toast.success(`"${data.project.title}" created!`);
      navigate(`/project/${data.project.id}`);
    } catch (err) {
      const msg = (err as any)?.response?.data?.message ?? (err as Error).message;
      setError(msg);
      toast.error(`Failed to create project: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [markdown, navigate]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200">Create Video from Template</h2>
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Instructions */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs text-gray-500">
            Fill in the template below. Replace placeholder text with your content. Then click "Create Video" to parse and start editing.
          </p>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden px-4 py-2">
          <textarea
            value={markdown}
            onChange={(e) => { setMarkdown(e.target.value); setError(null); }}
            className="w-full h-full min-h-80 bg-gray-950 border border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-brand-500 transition-colors"
            placeholder="Your markdown content will appear here..."
            spellCheck={false}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4">
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 p-4 border-t border-gray-800">
          <button
            onClick={handleCreate}
            disabled={loading || !markdown.trim()}
            className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Creating project…' : 'Create Video'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2.5 text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}