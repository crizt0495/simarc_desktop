/**
 * AppTopbar — replika 1:1 dari <header class="top-navbar"> pada
 * web/templates/layouts/app.html: tombol mobile, brand, kolom pencarian
 * (petunjuk "/" ), toggle dark mode, tombol pintasan keyboard, dan dropdown
 * pengguna (avatar inisial + nama + role → Profil/Pengaturan/Keluar).
 */
import React from 'react';
import { useTheme } from '../lib/theme';
import { SimarcModal } from '../lib/modal';
import { WindowControls } from './WindowControls';

export interface SessionUser {
  name: string;
  role: string;
}

export const AppTopbar: React.FC<{
  user: SessionUser | null;
}> = ({ user }) => {
  const { mode } = useTheme();

  const onThemeToggle = () => {
    const html = document.documentElement;
    const t = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', t);    html.setAttribute('data-theme', t);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: t } }));
  };

  void mode;

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <button className="nav-icon-btn d-md-none" id="sidebarToggle" aria-label="Buka menu navigasi" aria-expanded="false" aria-controls="sidebarNav">
          <i className="bi bi-list"></i>
        </button>
        <a href="/dashboard" className="navbar-brand-mobile" aria-label="SIMARC Beranda">
          <i className="bi bi-archive-fill"></i>
          <span>SIMARC</span>
        </a>

        <form action="/search" method="GET" className="nav-search d-none d-lg-flex" onSubmit={(e) => e.preventDefault()}>
          <i className="bi bi-search" style={{ color: 'var(--ink-4)', fontSize: 14, flexShrink: 0 }}></i>
          <input type="search" name="q" placeholder="Cari arsip..." aria-label="Pencarian" autoComplete="off" />
          <kbd style={{ fontSize: 11, color: 'var(--ink-4)', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>/</kbd>
        </form>
      </div>

      <div className="navbar-right">
        <button className="nav-icon-btn" id="themeToggle" title="Toggle Dark Mode" onClick={onThemeToggle}>
          <i className="bi bi-moon" id="themeIcon"></i>
        </button>

        <button className="nav-icon-btn d-none d-md-flex" id="keyboardShortcutBtn" title="Pintasan Keyboard" onClick={() => SimarcModal.show('kbdModal')}>
          <i className="bi bi-keyboard"></i>
        </button>

        <div className="dropdown">
          <div className="nav-user" data-bs-toggle="dropdown" role="button" tabIndex={0} aria-haspopup="menu" aria-expanded="false" aria-label="Menu pengguna">
            <div className="nav-avatar">{(user?.name || 'P').slice(0, 1)}</div>
            <div className="d-none d-sm-block">
              <div className="nav-user-name">{user?.name ?? 'Pengguna'}</div>
              <div className="nav-user-role">{user?.role ?? 'Pengguna'}</div>
            </div>
            <i className="bi bi-chevron-down d-none d-sm-inline" style={{ fontSize: 11, color: 'var(--ink-4)' }}></i>
          </div>
          <ul className="dropdown-menu dropdown-menu-end">
            <li>
              <a className="dropdown-item" href="/profil" onClick={(e) => e.preventDefault()}>
                <i className="bi bi-person"></i> Profil Saya
              </a>
            </li>
            <li>
              <a className="dropdown-item" href="/pengaturan" onClick={(e) => e.preventDefault()}>
                <i className="bi bi-gear"></i> Pengaturan
              </a>
            </li>
            <li><div className="dropdown-divider"></div></li>
            <li>
              <button className="dropdown-item danger" onClick={() => SimarcModal.show('exitConfirmModal')}>
                <i className="bi bi-box-arrow-right"></i> Keluar
              </button>
            </li>
          </ul>
        </div>

        <WindowControls />
      </div>
    </header>
  );
};
