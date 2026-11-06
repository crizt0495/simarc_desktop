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
import { PeminjamanPage } from './pages/PeminjamanPage';
import { PemberkasanPage } from './pages/PemberkasanPage';
import { PemusnahanPage } from './pages/PemusnahanPage';
import { LogActivityPage } from './pages/LogActivityPage';
import { UsersPage } from './pages/UsersPage';
import { UnitKerjaPage } from './pages/UnitKerjaPage';
import { LokasiArsipPage } from './pages/LokasiArsipPage';
import { KodeKlasifikasiPage } from './pages/KodeKlasifikasiPage';
import { JenisArsipPage } from './pages/JenisArsipPage';
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

  const renderBody = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard status={status} userName={profile?.name ?? 'Pengguna'} />;
      case 'arsip':
        return <ArsipPage />;
      case 'peminjaman':
        return <PeminjamanPage />;
      case 'peminjaman-create':
        return <PeminjamanPage mode="create" />;
      case 'pemberkasan':
        return <PemberkasanPage />;
      case 'pemusnahan':
        return <PemusnahanPage />;
      case 'log-aktivitas':
        return <LogActivityPage />;
      case 'users':
        return <UsersPage />;
      case 'unit-kerja':
        return <UnitKerjaPage />;
      case 'lokasi-arsip':
        return <LokasiArsipPage />;
      case 'kode-klasifikasi':
        return <KodeKlasifikasiPage />;
      case 'jenis-arsip':
        return <JenisArsipPage />;
      case 'public-search':
        return (
          <PublicSearchPage
            onLogin={() => setPage('login')}
            sessionName={null}
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

  // Landing page publik & login tampil full-screen (tanpa sidebar/shell),
  // sesuai desain viewer tanpa login. Halaman aplikasi lain pakai AppLayout.
  const isPublic = page === 'public-search' || page === 'login';

  if (isPublic) {
    return (
      <ErrorBoundary>
        {renderBody()}
      </ErrorBoundary>
    );
  }

  return (
    <AppLayout
      page={page as PageKey}
      onNavigate={(p) => setPage(p)}
      user={profile}
    >
      <ErrorBoundary>
        {renderBody()}
      </ErrorBoundary>
    </AppLayout>
  );
};

export default App;
