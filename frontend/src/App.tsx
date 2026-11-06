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
import { LoginPage } from './pages/LoginPage';
import { ITEM_BY_KEY, type PageKey } from './components/AppSidebar';
import { getProfile, getStatus, pingBackend, type Status, type Profile } from './lib/bindings';
import ErrorBoundary from './components/ErrorBoundary';

type AppPage = PageKey | 'login';

const App: React.FC = () => {
  const hash = typeof location !== 'undefined' ? (location.hash || '').replace('#', '') as AppPage : '' as AppPage;
  const validHash = hash && ITEM_BY_KEY[hash as PageKey] ? hash as PageKey : null;
  // Halaman pertama saat aplikasi dibuka = landing page publik.
  const [page, setPage] = useState<AppPage>(validHash ?? 'public-search');
  const [status, setStatus] = useState<Status | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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
    document.title = `${ITEM_BY_KEY[page as PageKey]?.label ?? 'SIMARC'} — SIMARC-Arsip Record Center`;
  }, [page]);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard status={status} userName={profile?.name ?? 'Pengguna'} />;
      case 'arsip':
        return <ArsipPage />;
      case 'public-search':
        return (
          <PublicSearchPage
            onLogin={() => setPage('login')}
            sessionName={null} // landing selalu mode viewer; profil tampil di topbar
          />
        );
      case 'login':
        return (
          <LoginPage
            onSuccess={(p) => {
              setProfile(p);
              setPage('dashboard');
            }}
            onBack={() => setPage('public-search')}
          />
        );
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
