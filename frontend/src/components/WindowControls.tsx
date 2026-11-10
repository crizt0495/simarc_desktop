/**
 * WindowControls — tombol kontrol jendela desktop: Minimalkan, Maksimalkan /
 * Kembalikan, dan Tutup aplikasi.
 *
 * Dipakai di topbar halaman aplikasi, header landing page publik, dan halaman
 * login agar pengguna tetap bisa mengatur jendela meskipun aplikasi berjalan
 * dalam mode fullscreen / tanpa title bar bawaan OS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Quit,
  WindowIsMaximised,
  WindowMinimise,
  WindowToggleMaximise,
} from '../../wailsjs/runtime/runtime';

export const WindowControls: React.FC<{
  /** Kelas tambahan untuk penempatan khusus. */
  className?: string;
  /** Posisi mengambang di pojok kanan atas (untuk halaman tanpa topbar). */
  floating?: boolean;
}> = ({ className = '', floating = false }) => {
  const [maximised, setMaximised] = useState(false);

  const syncState = useCallback(async () => {
    try {
      setMaximised(await WindowIsMaximised());
    } catch {
      /* abaikan di luar runtime Wails */
    }
  }, []);

  useEffect(() => {
    void syncState();
    // Status maximize berubah saat user memakai tombol OS / resize jendela.
    window.addEventListener('resize', syncState);
    return () => window.removeEventListener('resize', syncState);
  }, [syncState]);

  const minimise = () => {
    try { WindowMinimise(); } catch (e) { console.error('minimise', e); }
  };

  const toggleMaximise = () => {
    try { WindowToggleMaximise(); } catch (e) { console.error('toggleMaximise', e); }
    window.setTimeout(() => void syncState(), 120);
  };

  const exit = () => {
    try {
      Quit();
    } catch (e) {
      console.error('quit', e);
      try { window.close(); } catch {}
    }
  };

  return (
    <div
      className={`win-controls${floating ? ' win-controls-floating' : ''}${className ? ' ' + className : ''}`}
      role="group"
      aria-label="Kontrol jendela"
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      <button
        type="button"
        className="win-btn"
        title="Minimalkan"
        aria-label="Minimalkan jendela"
        onClick={minimise}
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <i className="bi bi-dash-lg" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="win-btn"
        title={maximised ? 'Kembalikan ukuran' : 'Maksimalkan'}
        aria-label={maximised ? 'Kembalikan ukuran jendela' : 'Maksimalkan jendela'}
        aria-pressed={maximised}
        onClick={toggleMaximise}
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <i className={maximised ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen'} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="win-btn win-btn-close"
        title="Tutup aplikasi"
        aria-label="Tutup aplikasi"
        onClick={exit}
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
    </div>
  );
};

export default WindowControls;