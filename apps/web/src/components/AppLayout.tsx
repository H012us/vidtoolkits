import { Link, useLocation } from 'react-router-dom';
import { Film, Settings, FileText } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-gray-200 hover:text-brand-400 transition-colors">
            <Film className="h-5 w-5 text-brand-500" />
            <span className="font-semibold">vidtoolkits</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              to="/template"
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                location.pathname === '/template'
                  ? 'text-brand-400 bg-brand-900/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <FileText className="h-4 w-4" />
              Template
            </Link>
            <Link
              to="/settings"
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                location.pathname === '/settings'
                  ? 'text-brand-400 bg-brand-900/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-gray-600">
          <span>vidtoolkits — video creation from markdown</span>
          <span>Built with Remotion + Voicebox + free stock imagery</span>
        </div>
      </footer>
    </div>
  );
}