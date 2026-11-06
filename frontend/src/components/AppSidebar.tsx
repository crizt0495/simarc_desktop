/**
 * AppSidebar — replika 1:1 dari web/templates/components/sidebar.html
 * aplikasi referensi: urutan grup, label, ikon (bi-*), footer (Profil/Keluar)
 * dan panel versi "SIMARC Neo-Brutalism 2.0" sama persis.
 */
import React from 'react';

export type PageKey =
  | 'dashboard' | 'advanced' | 'arsip' | 'pemberkasan' | 'pemindahan'
  | 'pemusnahan' | 'peminjaman-create' | 'peminjaman' | 'unit-kerja'
  | 'lokasi-arsip' | 'users' | 'kode-klasifikasi' | 'jenis-arsip'
  | 'search' | 'laporan' | 'laporan-arsip' | 'laporan-digital'
  | 'laporan-pemberkasan' | 'laporan-lokasi' | 'laporan-klasifikasi'
  | 'laporan-retensi' | 'laporan-pemusnahan' | 'log-aktivitas' | 'statistik'
  | 'monitoring-retensi' | 'jadwal-retensi' | 'disposal' | 'roles'
  | 'pengaturan' | 'backup' | 'integrasi' | 'qrcode' | 'import-export'
  | 'blockchain' | 'sinkronisasi' | 'profil';

interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
  ident: string; // path situs referensi (mark active + breadcrumb)
}

export const NAV_ITEMS: NavItem[] = [
  // ── Dashboard ──
  { key: 'dashboard', label: 'Dashboard Utama', icon: 'bi-speedometer2', ident: 'dashboard' },
  { key: 'advanced', label: 'Analitik Lanjutan', icon: 'bi-cpu', ident: 'advanced/dashboard' },

  // ── Manajemen Arsip ──
  { key: 'arsip', label: 'Daftar Arsip', icon: 'bi-file-earmark-text', ident: 'arsip' },
  { key: 'pemberkasan', label: 'Pemberkasan', icon: 'bi-folder-plus', ident: 'pemberkasan' },
  { key: 'pemindahan', label: 'Pemindahan Arsip', icon: 'bi-map', ident: 'arsip/pemindahan' },
  { key: 'pemusnahan', label: 'Pemusnahan Arsip', icon: 'bi-trash', ident: 'pemusnahan' },

  // ── Layanan ──
  { key: 'peminjaman-create', label: 'Permohonan Pinjam', icon: 'bi-file-earmark-arrow-up', ident: 'peminjaman/create' },
  { key: 'peminjaman', label: 'Daftar Peminjaman', icon: 'bi-journal-check', ident: 'peminjaman' },

  // ── Master Data ──
  { key: 'unit-kerja', label: 'Unit Kerja', icon: 'bi-building', ident: 'unit-kerja' },
  { key: 'lokasi-arsip', label: 'Lokasi Arsip', icon: 'bi-geo-alt', ident: 'lokasi-arsip' },
  { key: 'users', label: 'Petugas', icon: 'bi-people', ident: 'users' },
  { key: 'kode-klasifikasi', label: 'Kode Klasifikasi', icon: 'bi-tags', ident: 'kode-klasifikasi' },
  { key: 'jenis-arsip', label: 'Jenis Arsip', icon: 'bi-folder', ident: 'jenis-arsip' },

  // ── Laporan ──
  { key: 'search', label: 'Pencarian Arsip', icon: 'bi-search', ident: 'search' },
  { key: 'laporan', label: 'Dashboard Laporan', icon: 'bi-graph-up', ident: 'laporan' },
  { key: 'laporan-arsip', label: 'Laporan Arsip', icon: 'bi-file-earmark-text', ident: 'laporan/arsip' },
  { key: 'laporan-digital', label: 'Arsip Digital', icon: 'bi-cloud-check', ident: 'laporan/digital' },
  { key: 'laporan-pemberkasan', label: 'Laporan Pemberkasan', icon: 'bi-folder', ident: 'laporan/pemberkasan' },
  { key: 'laporan-lokasi', label: 'Laporan per Lokasi', icon: 'bi-geo-alt', ident: 'laporan/lokasi' },
  { key: 'laporan-klasifikasi', label: 'Laporan Klasifikasi', icon: 'bi-tags', ident: 'laporan/klasifikasi' },
  { key: 'laporan-retensi', label: 'Laporan Retensi', icon: 'bi-hourglass-split', ident: 'laporan/retensi' },
  { key: 'laporan-pemusnahan', label: 'Laporan Pemusnahan', icon: 'bi-trash', ident: 'laporan/pemusnahan' },
  { key: 'log-aktivitas', label: 'Log Aktivitas', icon: 'bi-clock-history', ident: 'laporan/aktivitas' },
  { key: 'statistik', label: 'Statistik', icon: 'bi-pie-chart', ident: 'laporan/statistik' },

  // ── Monitoring ──
  { key: 'monitoring-retensi', label: 'Monitoring Retensi', icon: 'bi-clock', ident: 'monitoring/retensi' },
  { key: 'jadwal-retensi', label: 'Jadwal Retensi', icon: 'bi-calendar-check', ident: 'jadwal-retensi' },
  { key: 'disposal', label: 'Dashboard Penyusutan', icon: 'bi-arrow-right-left', ident: 'disposal' },

  // ── Administrasi ──
  { key: 'roles', label: 'Manajemen Role', icon: 'bi-person-badge', ident: 'roles' },
  { key: 'pengaturan', label: 'Pengaturan', icon: 'bi-gear', ident: 'pengaturan' },
  { key: 'backup', label: 'Backup & Restore', icon: 'bi-database', ident: 'backup' },
  { key: 'integrasi', label: 'Integrasi Google Sheet', icon: 'bi-table', ident: 'advanced/integrations' },
  { key: 'qrcode', label: 'QR Code Arsip', icon: 'bi-qr-code', ident: 'advanced/qrcode' },
  { key: 'import-export', label: 'Import / Export', icon: 'bi-arrow-left-right', ident: 'advanced/import-export' },
  { key: 'blockchain', label: 'Blockchain Audit', icon: 'bi-shield-check', ident: 'blockchain' },
];

export const NAV_GROUPS: Array<{ label: string; keys: PageKey[] }> = [
  { label: 'Dashboard', keys: ['dashboard', 'advanced'] },
  { label: 'Manajemen Arsip', keys: ['arsip', 'pemberkasan', 'pemindahan', 'pemusnahan'] },
  { label: 'Layanan', keys: ['peminjaman-create', 'peminjaman'] },
  { label: 'Master Data', keys: ['unit-kerja', 'lokasi-arsip', 'users', 'kode-klasifikasi', 'jenis-arsip'] },
  {
    label: 'Laporan',
    keys: [
      'search', 'laporan', 'laporan-arsip', 'laporan-digital', 'laporan-pemberkasan',
      'laporan-lokasi', 'laporan-klasifikasi', 'laporan-retensi', 'laporan-pemusnahan',
      'log-aktivitas', 'statistik',
    ],
  },
  { label: 'Monitoring', keys: ['monitoring-retensi', 'jadwal-retensi', 'disposal'] },
  {
    label: 'Administrasi',
    keys: ['roles', 'pengaturan', 'backup', 'integrasi', 'qrcode', 'import-export', 'blockchain'],
  },
];

export const ITEM_BY_KEY: Record<PageKey, NavItem> = Object.fromEntries(
  NAV_ITEMS.map((n) => [n.key, n]),
) as unknown as Record<PageKey, NavItem>;

export const AppSidebar: React.FC<{
  page: PageKey;
  onNavigate: (p: PageKey) => void;
}> = ({ page, onNavigate }) => (
  <aside className="sidebar" id="sidebar">
    <div className="sidebar-header">
      <div className="sidebar-logo-icon">
        <i className="bi bi-archive-fill"></i>
      </div>
      <div>
        <div className="sidebar-logo-text">SIMARC</div>
        <div className="sidebar-logo-sub">Sistem Informasi Manajemen Arsip</div>
      </div>
    </div>

    <nav className="sidebar-nav" id="sidebarNav">
      {NAV_GROUPS.map((g) => (
        <React.Fragment key={g.label}>
          <div className="sidebar-section-label">{g.label}</div>
          {g.keys.map((k) => {
            const it = ITEM_BY_KEY[k];
            return (
              <a
                key={k}
                href={`/${it.ident}`}
                className={`sidebar-link${page === k ? ' active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(k);
                }}
              >
                <i className={`bi ${it.icon}`}></i> {it.label}
              </a>
            );
          })}
        </React.Fragment>
      ))}
    </nav>

    <div className="sidebar-footer">
      <a
        href="/profil"
        className="sidebar-footer-link"
        onClick={(e) => {
          e.preventDefault();
          onNavigate('profil');
        }}
      >
        <i className="bi bi-person-circle"></i> Profil
      </a>
      <button
        className="sidebar-footer-link"
        id="sidebarLogoutBtn"
        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}
      >
        <i className="bi bi-box-arrow-right"></i> Keluar
      </button>
    </div>

    <div className="sidebar-version">
      <span className="version-dot"></span>
      <span>SIMARC Neo-Brutalism 2.0</span>
    </div>
  </aside>
);
