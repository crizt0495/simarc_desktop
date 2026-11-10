/**
 * PublicHeader — header landing page publik: judul di kiri, tombol "Masuk"
 * di pojok kanan atas (permintaan UI: landing page tampil pertama kali).
 */
import React from 'react';
import { WindowControls } from './WindowControls';

export interface PublicHeaderProps {
  onLogin: () => void;
  sessionName?: string | null;
  onEnterDashboard?: () => void;
  /** Menutup aplikasi desktop (opsional). */
  onExit?: () => void;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({
  onLogin,
  sessionName,
  onEnterDashboard,
  onExit,
}) => (
  <div className="card-header public-brand-header d-flex align-items-center justify-content-between flex-wrap gap-2 bg-white">
    <div className="d-flex align-items-center gap-3">
      <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white flex-shrink-0" style={{ width: 40, height: 40 }}>
        <i className="bi bi-archive-fill"></i>
      </span>
      <div className="brand-lockup">
        <div className="brand-name">SIMARC</div>
        <div className="simarc-marquee text-muted" style={{ fontSize: '.72rem' }}>
          <span
            className="simarc-marquee-track"
            data-text="Sistem Informasi Manajemen Arsip Record Center"
          >
            Sistem Informasi Manajemen Arsip Record Center
          </span>
        </div>
      </div>
    </div>

    {/* tombol login / dashboard + keluar — pojok kanan atas */}
    <div className="d-flex align-items-center gap-2 flex-wrap">
      {sessionName ? (
        <div className="d-flex align-items-center gap-2">
          <span className="d-flex flex-column text-end lh-sm">
            <span className="small fw-semibold">{sessionName}</span>
            <span className="text-muted" style={{ fontSize: '.72rem' }}>Sesi aktif</span>
          </span>
          <button
            type="button"
            className="btn btn-success btn-sm rounded-pill px-3"
            onClick={onEnterDashboard}
            title="Masuk ke Dashboard"
          >
            <i className="bi bi-speedometer2 me-1"></i>Dashboard
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline-primary btn-sm rounded-pill px-3"
          onClick={onLogin}
          title="Masuk sebagai petugas"
        >
          <i className="bi bi-box-arrow-in-right me-1"></i>Login
        </button>
      )}
      {onExit && (
        <button
          type="button"
          className="btn btn-outline-danger btn-sm rounded-pill px-3"
          onClick={onExit}
          title="Tutup aplikasi"
        >
          <i className="bi bi-power me-1"></i>Keluar
        </button>
      )}
      <WindowControls />
    </div>
  </div>
);

export default PublicHeader;
