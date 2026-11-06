/**
 * AppLayout — replika 1:1 kerangka `web/templates/layouts/app.html`:
 * sidebar + overlay + mobile search bar + top-navbar + main.main-content
 * (dengan breadcrumb global di dalamnya) + modal pintasan keyboard,
 * konfirmasi keluar, dan portal modal di akhir body.
 */
import React, { useEffect, useRef } from 'react';
import { AppSidebar, NAV_ITEMS, type PageKey } from './AppSidebar';
import { AppTopbar, type SessionUser } from './AppTopbar';
import { SimarcModal, SmModal } from '../lib/modal';
import { QuitApp } from '../../wailsjs/go/main/App';

/* ── Breadcrumb global — logika sama seperti layouts/app.html ── */
const LABELS: Record<string, string> = {
  dashboard: 'Dashboard', advanced: 'Lanjutan', arsip: 'Arsip',
  pemberkasan: 'Pemberkasan', pemusnahan: 'Pemusnahan', peminjaman: 'Peminjaman',
  'unit-kerja': 'Unit Kerja', 'lokasi-arsip': 'Lokasi Arsip', users: 'Petugas',
  'kode-klasifikasi': 'Kode Klasifikasi', 'jenis-arsip': 'Jenis Arsip',
  search: 'Pencarian', laporan: 'Laporan', monitoring: 'Monitoring Retensi',
  'jadwal-retensi': 'Jadwal Retensi', roles: 'Role & Hak Akses', role: 'Role & Hak Akses',
  pengaturan: 'Pengaturan', backup: 'Backup & Restore', integrations: 'Integrasi Google Sheet',
  blockchain: 'Blockchain Audit', qrcode: 'QR Code', ocr: 'OCR', profil: 'Profil Saya',
  'import-export': 'Impor & Ekspor', disposal: 'Pemusnahan',
};
const NAMED: Record<string, string> = {
  create: 'Tambah Baru', edit: 'Edit', show: 'Detail', view: 'Detail',
  history: 'Riwayat', versions: 'Versi', pemindahan: 'Pemindahan',
  scanner: 'Pindai QR', settings: 'Pengaturan', statistik: 'Statistik',
  aktivitas: 'Log Aktivitas', lokasi: 'per Lokasi', arsip: 'Laporan Arsip',
  digital: 'Arsip Digital', klasifikasi: 'Klasifikasi', pemberkasan: 'Pemberkasan',
  retensi: 'Retensi', pemusnahan: 'Pemusnahan', permissions: 'Hak Akses',
};

const KNOWN = [
  '/dashboard', '/advanced/dashboard', '/arsip', '/pemberkasan', '/arsip/pemindahan',
  '/pemusnahan', '/peminjaman', '/unit-kerja', '/lokasi-arsip', '/users',
  '/kode-klasifikasi', '/jenis-arsip', '/search', '/laporan', '/monitoring/retensi',
  '/jadwal-retensi', '/roles', '/pengaturan', '/backup', '/advanced/integrations',
  '/blockchain', '/qrcode', '/ocr', '/profil', '/retention',
];

const mapCrumb = (seg: string) => {
  if (LABELS[seg]) return LABELS[seg];
  if (seg.indexOf('-') === 0 && NAMED[seg.replace(/^-/, '')]) return NAMED[seg.replace(/^-/, '')];
  if (NAMED[seg]) return NAMED[seg];
  const pretty = seg.replace(/[-_]/g, ' ');
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
};

export const buildBreadcrumb = (ident: string): React.ReactNode => {
  const parts = (('/' + ident).replace(/\/+$/, '') || '/').split('/').filter(Boolean);
  const nodes: React.ReactNode[] = [<a key="home" href="/dashboard">Beranda</a>];
  let acc = '';
  parts.forEach((seg, i) => {
    acc += '/' + seg;
    const isLast = i === parts.length - 1;
    nodes.push(<span key={`sep-${i}`} className="breadcrumb-sep" aria-hidden="true">/</span>);
    const label = mapCrumb(seg);
    if (isLast || !KNOWN.includes(acc)) {
      nodes.push(<span key={`act-${i}`} className="active">{label}</span>);
    } else {
      nodes.push(<a key={`lnk-${i}`} href={acc}>{label}</a>);
    }
  });
  return nodes;
};

export const AppLayout: React.FC<{
  page: string;
  onNavigate: (p: PageKey) => void;
  user: SessionUser | null;
  children: React.ReactNode;
}> = ({ page, onNavigate, user, children }) => {
  const firstInput = useRef<HTMLDivElement>(null);
  void firstInput;
  const ident = NAV_ITEMS.find((n) => n.key === page)?.ident ?? page;

  /* ── Pintasan keyboard — persis layouts/app.html (/ · D · Ctrl+B) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target.matches?.('input, textarea, select') ?? false;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !inField) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.nav-search input')?.focus();
      }
      if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !inField) {
        e.preventDefault();
        document.getElementById('themeToggle')?.click();
      }
      if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('sidebarToggle')?.click();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Sidebar mobile toggle + overlay (perilaku sidebar.js) ── */
  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggle = document.getElementById('sidebarToggle');
    if (!sidebar || !overlay) return;
    const onToggle = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
      if (toggle) toggle.setAttribute('aria-expanded', String(sidebar.classList.contains('active')));
    };
    const onOverlay = () => {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    };
    toggle?.addEventListener('click', onToggle);
    overlay.addEventListener('click', onOverlay);
    return () => {
      toggle?.removeEventListener('click', onToggle);
      overlay.removeEventListener('click', onOverlay);
    };
  }, []);

  /* ── Tombol "Keluar" di footer sidebar → modal konfirmasi ── */
  useEffect(() => {
    const btn = document.getElementById('sidebarLogoutBtn');
    if (!btn) return;
    const h = () => SimarcModal.show('exitConfirmModal');
    btn.addEventListener('click', h);
    return () => btn.removeEventListener('click', h);
  }, []);

  const doQuit = async () => {
    try { await QuitApp(); } catch { window.close(); }
    SimarcModal.hide('exitConfirmModal');
  };

  return (
    <React.Fragment>
      <AppSidebar page={page} onNavigate={onNavigate} />
      <div className="sidebar-overlay" id="sidebarOverlay"></div>

      {/* Mobile Search Bar — sama seperti layout referensi */}
      <div className="mobile-search-bar" id="mobileSearchBar" ref={firstInput}>
        <form action="/search" method="GET" style={{ display: 'contents', flex: 1 }} onSubmit={(e) => e.preventDefault()}>
          <div className="mobile-search-inner">
            <i className="bi bi-search"></i>
            <input type="search" name="q" placeholder="Cari arsip, nomor, atau kode..." aria-label="Pencarian" autoComplete="off" />
            <button type="button" className="mobile-search-clear" style={{ display: 'none' }}><i className="bi bi-x-lg"></i></button>
          </div>
          <button type="submit" className="btn btn-primary btn-sm mobile-search-submit"><i className="bi bi-search"></i></button>
          <button type="button" className="btn btn-light btn-sm mobile-search-close" onClick={() => document.getElementById('mobileSearchBar')?.classList.add('d-none')} aria-label="Tutup pencarian"><i className="bi bi-x-lg"></i></button>
        </form>
      </div>

      <AppTopbar user={user} />

      {/* Main Content */}
      <main className="main-content">
        <nav className="breadcrumb" id="globalBreadcrumb" aria-label="Breadcrumb">
          {buildBreadcrumb(ident)}
        </nav>
        {children}
      </main>

      {/* ── Modal Pintasan Keyboard — SIMARC V4 ── */}
      <SmModal id="kbdModal" size="sm">
        <div className="sm-header">
          <div className="sm-header-left">
            <div className="sm-icon sm-icon-primary"><i className="bi bi-keyboard"></i></div>
            <div>
              <h5 className="sm-title">Pintasan Keyboard</h5>
              <p className="sm-subtitle">Tekan tombol untuk aksi cepat</p>
            </div>
          </div>
          <button type="button" className="sm-btn-close" onClick={() => SimarcModal.hide('kbdModal')} aria-label="Close">
            <i className="bi bi-x"></i>
          </button>
        </div>
        <div className="sm-body">
          {[
            ['Fokus pencarian', '/'],
            ['Dark mode', 'D'],
            ['Tutup modal / sidebar', 'Esc'],
            ['Sidebar toggle', 'Ctrl+B'],
          ].map(([label, key], i) => (
            <div key={label} className="d-flex justify-content-between align-items-center py-3 shortcut-row" style={{ borderBottom: i === 3 ? undefined : '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>{label}</span>
              <kbd className="shortcut-key" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', minWidth: 36, textAlign: 'center' }}>{key}</kbd>
            </div>
          ))}
        </div>
        <div className="sm-footer">
          <button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('kbdModal')}>
            <i className="bi bi-x-lg me-1"></i>Tutup
          </button>
        </div>
      </SmModal>

      {/* ── Modal konfirmasi keluar (flash-modal style referensi) ── */}
      <SmModal id="exitConfirmModal" size="sm">
        <div className="sm-header" style={{ justifyContent: 'center', padding: '32px 24px 8px', border: 'none' }}>
          <div className="sm-confirm-icon sm-icon-warning" style={{ margin: '0 auto' }}>
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
        </div>
        <div className="sm-body" style={{ textAlign: 'center', padding: '8px 24px 16px' }}>
          <h5 className="sm-confirm-title">Keluar dari SIMARC?</h5>
          <p className="sm-confirm-message">Aplikasi akan ditutup. Data database lokal tetap aman di komputer ini.</p>
        </div>
        <div className="sm-footer" style={{ justifyContent: 'center' }}>
          <button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('exitConfirmModal')}>
            <i className="bi bi-x-lg me-1"></i>Batal
          </button>
          <button type="button" className="sm-btn sm-btn-confirm danger" onClick={() => void doQuit()}>
            <i className="bi bi-box-arrow-right me-1"></i> Keluar
          </button>
        </div>
      </SmModal>
    </React.Fragment>
  );
};
