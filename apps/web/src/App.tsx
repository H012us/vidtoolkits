import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ProjectPage } from './pages/ProjectPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatePage } from './pages/TemplatePage';
import { AppLayout } from './components/AppLayout';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/template" element={<TemplatePage />} />
      </Routes>
    </AppLayout>
  );
}