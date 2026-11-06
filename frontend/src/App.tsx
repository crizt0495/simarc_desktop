/**
 * App — bootstrapping data backend dan routing halaman.
 * Shell (sidebar/topbar/breadcrumb) 100% mengikuti layouts/app.html.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { ArsipPage } from './pages/ArsipPage';
import { StaticPage } from './pages/StaticPage';
import { PublicSearchPage } from './pages/PublicSearchPage';
import { ITEM_BY_KEY, type PageKey } from './components/AppSidebar';
import { getProfile, getStatus, pingBackend, type Status } from './lib/bindings';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  const hash = typeof location !== 'undefined' ? (location.hash || '').replace('#', '') as PageKey : '' as PageKey;
  const validHash = hash && ITEM_BY_KEY[hash as PageKey] ? hash as PageKey : null;
  const [page, setPage] = useState<PageKey>(validHash ?? 'dashboard');
  const [status, setStatus] = useState<Status | null>(null);
  const [profile, setProfile] = useState<{ name: string; role: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, ping, p] = await Promise.all([getStatus(), pingBackend(), getProfile()]);
      setStatus(s);
      if (p) setProfile(p);
      void ping;
    } catch {
      /* biarkan state lama */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    document.title = `${ITEM_BY_KEY[page]?.label ?? 'SIMARC'} — SIMARC-Arsip Record Center`;
  }, [page]);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard status={status} userName={profile?.name ?? 'Pengguna'} />;
      case 'arsip':
        return <ArsipPage />;
      case 'public-search':
        return <PublicSearchPage />;
      default:
        return <StaticPage page={page} />;
    }
  };

  return (
    <AppLayout
      page={page}
      onNavigate={setPage}
      user={profile}
    >
      <ErrorBoundary>
        {renderPage()}
      </ErrorBoundary>
    </AppLayout>
  );
};

export default App;
