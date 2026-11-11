/**
 * App — bootstrapping data backend dan routing halaman.
 * Shell (sidebar/topbar/breadcrumb) 100% mengikuti layouts/app.html.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { ArsipPage } from './pages/ArsipPage';
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
import { DisposalPage } from './pages/DisposalPage';
import { MonitoringRetensiPage } from './pages/MonitoringRetensiPage';
import { BlockchainPage } from './pages/BlockchainPage';
import { AdvancedPage } from './pages/AdvancedPage';
import { RolesPage } from './pages/RolesPage';
import { StatistikPage } from './pages/StatistikPage';
import { SearchPage } from './pages/SearchPage';
import { PemindahanPage } from './pages/PemindahanPage';
import { JadwalRetensiPage } from './pages/JadwalRetensiPage';
import { LaporanPage } from './pages/LaporanPage';
import { PengaturanPage } from './pages/PengaturanPage';
import { BackupPage } from './pages/BackupPage';
import { IntegrasiPage } from './pages/IntegrasiPage';
import { QrCodePage } from './pages/QrCodePage';
import { ImportExportPage } from './pages/ImportExportPage';
import { ProfilPage } from './pages/ProfilPage';
import { ITEM_BY_KEY, type PageKey } from './components/AppSidebar';
import { getProfile, getStatus, pingBackend, reconnectDb, type Status, type Profile } from './lib/bindings';
import ErrorBoundary from './components/ErrorBoundary';
import { DatabaseBanner } from './components/DatabaseBanner';

type AppPage = PageKey | 'login';

const App: React.FC = () => {
  const hash = typeof location !== 'undefined' ? (location.hash || '').replace('#', '') as AppPage : '' as AppPage;
  const validHash = hash && ITEM_BY_KEY[hash as PageKey] ? hash as PageKey : null;
  // Halaman pertama saat aplikasi dibuka = landing page publik.
  const [page, setPage] = useState<AppPage>(validHash ?? 'public-search');
  const [status, setStatus] = useState<Status | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [retryingDb, setRetryingDb] = useState(false);

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

  const retryDb = useCallback(async () => {
    if (retryingDb) return;
    setRetryingDb(true);
    try {
      const res = await reconnectDb();
      if (res?.ok) {
        // Muat ulang tampilan agar seluruh halaman mengambil data terbaru.
        window.location.reload();
        return;
      }
      await refresh();
    } catch {
      await refresh();
    } finally {
      setRetryingDb(false);
    }
  }, [refresh, retryingDb]);

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
      case 'disposal':
        return <DisposalPage />;
      case 'monitoring-retensi':
        return <MonitoringRetensiPage />;
      case 'blockchain':
        return <BlockchainPage />;
      case 'advanced':
        return <AdvancedPage />;
      case 'roles':
        return <RolesPage />;
      case 'statistik':
        return <StatistikPage />;
      case 'search':
        return <SearchPage />;
      case 'pemindahan':
        return <PemindahanPage />;
      case 'jadwal-retensi':
        return <JadwalRetensiPage />;
      case 'laporan':
      case 'laporan-arsip':
      case 'laporan-digital':
      case 'laporan-pemberkasan':
      case 'laporan-lokasi':
      case 'laporan-klasifikasi':
      case 'laporan-retensi':
      case 'laporan-pemusnahan':
        return <LaporanPage page={page} />;
      case 'pengaturan':
        return <PengaturanPage />;
      case 'backup':
        return <BackupPage />;
      case 'integrasi':
      case 'sinkronisasi':
        return <IntegrasiPage page={page} />;
      case 'qrcode':
        return <QrCodePage />;
      case 'import-export':
        return <ImportExportPage />;
      case 'profil':
        return <ProfilPage />;
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
        return (
          <div className="container-fluid py-4">
            <div className="card"><div className="card-body">
              <div className="empty-state py-5">
                <i className="bi bi-compass empty-icon"></i>
                <p className="empty-title">Halaman Tidak Ditemukan</p>
                <p className="empty-desc">Menu yang Anda tuju tidak tersedia pada aplikasi ini.</p>
              </div>
            </div></div>
          </div>
        );
    }
  };

  // Landing page publik & login tampil full-screen (tanpa sidebar/shell),
  // sesuai desain viewer tanpa login. Halaman aplikasi lain pakai AppLayout.
  const isPublic = page === 'public-search' || page === 'login';

  if (isPublic) {
    return (
      <>
        <ErrorBoundary>
          {renderBody()}
        </ErrorBoundary>
        <DatabaseBanner dbError={status?.db_error} onRetry={retryDb} retrying={retryingDb} />
      </>
    );
  }

  return (
    <>
      <AppLayout
        page={page as PageKey}
        onNavigate={(p) => setPage(p)}
        user={profile}
      >
        <ErrorBoundary>
          {renderBody()}
        </ErrorBoundary>
      </AppLayout>
      <DatabaseBanner dbError={status?.db_error} onRetry={retryDb} retrying={retryingDb} />
    </>
  );
};

export default App;
