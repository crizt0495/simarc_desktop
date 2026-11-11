/**
 * DatabaseBanner — memberi tahu pengguna saat aplikasi tidak dapat
 * tersambung ke database TiDB Cloud. Tanpa ini, kegagalan koneksi hanya
 * tampil sebagai daftar kosong ("data tidak muncul") tanpa penjelasan.
 */
import React from 'react';

export const DatabaseBanner: React.FC<{
  dbError?: string;
  onRetry?: () => void;
  retrying?: boolean;
}> = ({ dbError, onRetry, retrying }) => {
  const msg = (dbError || '').trim();
  if (!msg) return null;
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '.6rem',
        padding: '.6rem 1rem',
        background: '#fef2f2',
        borderTop: '2px solid #dc2626',
        color: '#7f1d1d',
        fontSize: '.85rem',
        lineHeight: 1.4,
      }}
    >
      <i className="bi bi-wifi-off" style={{ fontSize: '1.05rem', lineHeight: 1.2 }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Database tidak tersambung.</strong> Data belum dapat dimuat.
        <div style={{ marginTop: '.15rem', wordBreak: 'break-word', opacity: 0.9 }}>{msg}</div>
        <div style={{ marginTop: '.25rem', opacity: 0.8 }}>
          Periksa koneksi internet komputer ini, lalu coba lagi. Detail tercatat di
          berkas <code>simarc.log</code> (folder konfigurasi SIMARC).
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          style={{
            flexShrink: 0,
            border: '1px solid #dc2626',
            background: retrying ? '#fecaca' : '#fff',
            color: '#7f1d1d',
            borderRadius: 6,
            padding: '.3rem .7rem',
            fontWeight: 600,
            cursor: retrying ? 'wait' : 'pointer',
          }}
        >
          {retrying ? 'Menyambung…' : 'Coba lagi'}
        </button>
      )}
    </div>
  );
};

export default DatabaseBanner;
