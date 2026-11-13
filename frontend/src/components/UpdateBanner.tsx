/**
 * UpdateBanner — pemberitahuan pembaruan aplikasi yang muncul di semua
 * halaman (landing maupun setelah login).
 *
 * Pemeriksaan dilakukan sekali saat aplikasi dibuka lalu setiap 6 jam.
 * Pengguna dapat menunda; versi yang ditunda diingat di localStorage agar
 * tidak mengganggu terus-menerus. Pemasangan tetap memerlukan konfirmasi.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { applyUpdate, getUpdateInfo, restartApp, type UpdateInfo } from '../lib/bindings';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SNOOZE_KEY = 'simarc.update.snooze';

const snoozed = (version?: string): boolean => {
  if (!version) return false;
  try {
    return window.localStorage.getItem(SNOOZE_KEY) === version;
  } catch {
    return false;
  }
};

export const UpdateBanner: React.FC = () => {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const u = await getUpdateInfo();
      if (u?.hasUpdate && !snoozed(u.latest)) setInfo(u);
    } catch {
      /* pemeriksaan pembaruan bersifat opsional */
    }
  }, []);

  useEffect(() => {
    // Beri waktu aplikasi menyelesaikan startup & koneksi database.
    const first = window.setTimeout(() => void check(), 4000);
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [check]);

  const dismiss = () => {
    if (info?.latest) {
      try {
        window.localStorage.setItem(SNOOZE_KEY, info.latest);
      } catch {
        /* abaikan */
      }
    }
    setInfo(null);
    setMsg(null);
  };

  const install = async () => {
    if (!info?.downloadURL) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await applyUpdate(info.downloadURL, info.sha256 ?? '');
      if (res?.restarting) {
        setMsg('Pembaruan dipasang. Aplikasi akan dibuka ulang…');
        return; // backend menutup aplikasi & menjalankan ulang
      }
      setMsg('Pembaruan terpasang. Membuka ulang aplikasi…');
      window.setTimeout(() => {
        void restartApp().catch(() => {
          setMsg('Pembaruan terpasang. Silakan tutup dan buka lagi aplikasi.');
        });
      }, 900);
    } catch (e) {
      setBusy(false);
      setMsg(`Gagal memperbarui: ${String(e)}`);
    }
  };

  if (!info) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        right: '1rem',
        bottom: '1rem',
        zIndex: 8800,
        width: 'min(420px, calc(100vw - 2rem))',
        background: '#ecfdf5',
        border: '2px solid #059669',
        borderRadius: 10,
        color: '#064e3b',
        padding: '.85rem 1rem',
        boxShadow: '0 10px 30px rgba(0,0,0,.18)',
        fontSize: '.85rem',
        lineHeight: 1.45,
      }}
    >
      <div className="d-flex align-items-start gap-2">
        <i className="bi bi-arrow-up-circle-fill" style={{ fontSize: '1.15rem', color: '#059669' }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>Pembaruan SIMARC tersedia</div>
          <div style={{ opacity: 0.85 }}>
            Versi {info.latest} (sekarang {info.current}).
          </div>
          {msg && <div style={{ marginTop: '.3rem', wordBreak: 'break-word' }}>{msg}</div>}
          {!msg && info.notes && (
            <div
              style={{
                marginTop: '.3rem',
                maxHeight: 72,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                opacity: 0.75,
                fontSize: '.78rem',
              }}
            >
              {info.notes.length > 280 ? `${info.notes.slice(0, 280)}…` : info.notes}
            </div>
          )}
        </div>
      </div>
      <div className="d-flex justify-content-end gap-2" style={{ marginTop: '.6rem' }}>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          style={{
            border: '1px solid #059669',
            background: 'transparent',
            color: '#065f46',
            borderRadius: 6,
            padding: '.28rem .7rem',
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Nanti
        </button>
        <button
          type="button"
          onClick={() => void install()}
          disabled={busy || !info.downloadURL}
          style={{
            border: '1px solid #047857',
            background: busy ? '#a7f3d0' : '#047857',
            color: busy ? '#065f46' : '#fff',
            borderRadius: 6,
            padding: '.28rem .8rem',
            fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Memperbarui…' : 'Perbarui sekarang'}
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
