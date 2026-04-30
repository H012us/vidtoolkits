import { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Download, Edit3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { templateApi } from '../api/templateApi';
import { TemplateEditor } from '../components/TemplateEditor';

export function TemplatePage() {
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    templateApi.getMarkdownTemplate().then(t => {
      setTemplate(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([template], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vidtoolkits-template.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => setShowEditor(true);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Markdown Template Guide</h1>
          <p className="text-sm text-gray-500 mt-1">
            Use this template to write video scripts that produce great results.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              Edit &amp; Create
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-gray-400 hover:text-gray-200 border border-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 text-gray-400 hover:text-gray-200 border border-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Download .md
            </button>
          </div>

          {/* Template Preview */}
          <div className="bg-gray-900 rounded-xl p-6">
            <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap leading-relaxed">
              {template}
            </pre>
          </div>
        </>
      )}

      {/* Template Editor Modal */}
      {showEditor && (
        <TemplateEditorWithTemplate
          initialTemplate={template}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

function TemplateEditorWithTemplate({
  initialTemplate,
  onClose,
}: {
  initialTemplate: string;
  onClose: () => void;
}) {
  const [markdown, setMarkdown] = useState(initialTemplate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = require('react-router-dom').useNavigate();

  const handleCreate = async () => {
    if (!markdown.trim()) {
      setError('Please fill in the template before creating.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { default: axios } = await import('axios');
      const { data } = await axios.post('/api/projects/from-template', { markdown });
      onClose();
      navigate(`/project/${data.project.id}`);
    } catch (err) {
      const msg = (err as any)?.response?.data?.message ?? (err as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200">Edit &amp; Create Video</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>
        <p className="px-4 pt-3 pb-1 text-xs text-gray-500">Fill in the template and click "Create Video" when ready.</p>
        <div className="flex-1 overflow-hidden px-4 py-2">
          <textarea
            value={markdown}
            onChange={(e) => { setMarkdown(e.target.value); setError(null); }}
            className="w-full h-full min-h-80 bg-gray-950 border border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-brand-500 transition-colors"
            spellCheck={false}
          />
        </div>
        {error && (
          <div className="px-4">
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}
        <div className="flex items-center gap-3 p-4 border-t border-gray-800">
          <button
            onClick={handleCreate}
            disabled={loading || !markdown.trim()}
            className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Creating project…' : 'Create Video'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}