/**
 * PublicHeader — header landing page publik: judul di kiri, tombol "Masuk"
 * di pojok kanan atas (permintaan UI: landing page tampil pertama kali).
 */
import React from 'react';

export interface PublicHeaderProps {
  onLogin: () => void;
  sessionName?: string | null;
  onEnterDashboard?: () => void;
  onLogout?: () => void;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({
  onLogin,
  sessionName,
  onEnterDashboard,
  onLogout,
}) => (
  <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2 bg-white">
    <div className="d-flex align-items-center gap-2">
      <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white" style={{ width: 36, height: 36 }}>
        <i className="bi bi-archive-fill"></i>
      </span>
      <div>
        <div className="h5 mb-0">SIMARC — Landing Publik</div>
        <div className="text-muted small">Cari & telusuri arsip tanpa login</div>
      </div>
    </div>

    {/* tombol login — pojok kanan atas */}
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
        {onLogout ? (
          <button
            type="button"
            className="btn btn-outline-danger btn-sm rounded-pill px-3"
            onClick={onLogout}
            title="Keluar dari SIMARC"
          >
            <i className="bi bi-box-arrow-right me-1"></i>Keluar
          </button>
        ) : null}
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
  </div>
);

export default PublicHeader;
