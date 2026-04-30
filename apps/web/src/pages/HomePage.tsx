import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import { useUpload } from '../hooks/useUpload';
import { useProjects } from '../hooks/useProject';
import { projectApi } from '../api/projectApi';
import { TemplateEditor } from '../components/TemplateEditor';
import { Upload, Film, Clock, Trash2, ExternalLink, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import type { VideoProject } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const upload = useUpload();
  const { data: projects = [] } = useProjects();
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (accepted.length === 0) return;
    const file = accepted[0];
    try {
      const result = await upload.mutateAsync(file);
      toast.success(`"${result.project.title}" created!`);
      navigate(`/project/${result.project.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [upload, navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/markdown': ['.md', '.markdown'] },
    maxFiles: 1,
    disabled: upload.isPending,
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-100">vidtoolkits</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Convert markdown scripts into videos with AI voice-over and free stock imagery.
          Upload your script, pick your style, and watch the magic happen.
        </p>
      </section>

      {/* Upload Zone */}
      <section>
        {/* Method selection */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setShowTemplateEditor(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-brand-900/30 hover:bg-brand-900/50 border border-brand-800 text-brand-300 rounded-lg transition-colors"
          >
            <FileText className="h-5 w-5" />
            <span className="font-medium">New from Template</span>
          </button>
          <div className="flex-1 drag-area text-center cursor-pointer hover:border-brand-500/50" {...getRootProps()}>
            <input {...getInputProps()} />
            <Upload className="h-5 w-5 text-gray-500 inline-block mr-2" />
            <span className="text-gray-400 text-sm">
              {upload.isPending ? 'Parsing…' : 'Upload .md file'}
            </span>
          </div>
        </div>
        <div
          {...getRootProps()}
          className={`drag-area p-12 text-center cursor-pointer hover:border-brand-500/50 ${
            isDragActive ? 'dragging' : ''
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-10 w-10 text-gray-500 mb-3" />
          {upload.isPending ? (
            <p className="text-brand-400">Parsing your markdown...</p>
          ) : isDragActive ? (
            <p className="text-brand-400">Drop your .md file here</p>
          ) : (
            <p className="text-gray-400">
              Drag &amp; drop a markdown file, or click to browse
            </p>
          )}
          <p className="text-sm text-gray-600 mt-2">.md or .markdown files up to 500KB</p>
        </div>
      </section>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Recent Projects</h2>
          <div className="space-y-3">
            {projects.slice(0, 5).map((project: VideoProject) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section>
        <h2 className="text-xl font-semibold text-gray-200 mb-4">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: <Upload className="h-6 w-6" />,
              title: '1. Upload Script',
              desc: 'Write your video as a markdown file with parts and keywords.',
            },
            {
              icon: <Film className="h-6 w-6" />,
              title: '2. Auto-Generate',
              desc: 'Images, voice-over, and video composition are created automatically.',
            },
            {
              icon: <Clock className="h-6 w-6" />,
              title: '3. Download',
              desc: 'Get a high-quality MP4 video, ready to share.',
            },
          ].map((item) => (
            <div key={item.title} className="bg-gray-900 rounded-xl p-6 space-y-3">
              <div className="text-brand-400">{item.icon}</div>
              <h3 className="font-medium text-gray-200">{item.title}</h3>
              <p className="text-sm text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
      {showTemplateEditor && <TemplateEditor />}
    </div>
  );
}

function ProjectCard({ project }: { project: VideoProject }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleDelete = async () => {
    try {
      await projectApi.delete(project.id);
      qc.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const statusColors: Record<string, string> = {
    created: 'bg-gray-600',
    processing: 'bg-brand-500 animate-pulse',
    completed: 'bg-green-600',
    failed: 'bg-red-600',
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 hover:bg-gray-800 transition-colors">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/project/${project.id}`)}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-block w-2 h-2 rounded-full ${statusColors[project.status] ?? 'bg-gray-600'}`} />
          <span className="font-medium text-gray-200 truncate">{project.title}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{project.parts.length} parts</span>
          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
          <span className="capitalize">{project.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/project/${project.id}`); }}
          className="p-2 text-gray-400 hover:text-brand-400 transition-colors"
          title="Open project"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
          title="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}