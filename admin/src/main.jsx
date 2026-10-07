import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './styles.css';
import { StoreProvider, useStore } from './store/index.jsx';
import { ToastProvider } from './components/ui.jsx';
import Shell from './components/Shell.jsx';
import Login, { SetPassword } from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import PageEditor from './pages/PageEditor.jsx';
import CollectionEditor from './pages/CollectionEditor.jsx';
import FiguresEditor from './pages/FiguresEditor.jsx';
import Documents from './pages/Documents.jsx';
import Globals from './pages/Globals.jsx';
import { Users, Settings, History } from './pages/Admin.jsx';

function Gate({ children }) {
  const { session } = useStore();
  const loc = useLocation();
  if (session === undefined) return <div style={{ padding: 40 }} className="muted">Loading</div>;
  if (!session) return loc.pathname === '/set-password' ? <SetPassword /> : <Login />;
  return children;
}

function AdminOnly({ children }) {
  const { isAdmin } = useStore();
  return isAdmin ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <Gate>
      <Routes>
        <Route path="/set-password" element={<SetPassword />} />
        <Route element={<Shell />}>
          <Route index element={<Overview />} />
          <Route path="pages/:slug" element={<PageEditor />} />
          <Route path="collections/:name" element={<CollectionEditor />} />
          <Route path="figures" element={<FiguresEditor />} />
          <Route path="documents" element={<Documents />} />
          <Route path="site" element={<Globals />} />
          <Route path="users" element={<AdminOnly><Users /></AdminOnly>} />
          <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
          <Route path="history" element={<AdminOnly><History /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Gate>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
