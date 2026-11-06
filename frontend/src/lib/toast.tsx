/**
 * Toast — aplikasi web referensi memakai elemen `.toast-premium`
 * (lihat web/templates/arsip/index.html → TOAST). Warna/struktur/animasi
 * mengikuti persis markup referensi; notifikasi runtime/desktop tetap
 * tampil dengan wajah yang sama.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

interface ToastItem {
  id: number;
  tone: ToastTone;
  msg: string;
}

const ToastCtx = createContext<{ push: (tone: ToastTone, msg: string) => void }>({
  push: () => undefined,
});

const ICONS: Record<ToastTone, { icon: string; color: string }> = {
  success: { icon: 'check-circle-fill', color: 'success' },
  info: { icon: 'info-circle-fill', color: 'primary' },
  warning: { icon: 'exclamation-triangle-fill', color: 'warning' },
  danger: { icon: 'x-circle-fill', color: 'danger' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const close = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, msg: string) => {
    const id = ++seq.current;
    setItems((cur) => [...cur, { id, tone, msg }]);
    setTimeout(() => close(id), 5000);
  }, [close]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      {/* TOAST container — sama dengan referensi:
          position-fixed bottom-0 end-0 p-3 */}
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 9999 }}>
        {items.map((t) => (
          <div key={t.id} className="toast-premium" style={{ display: 'flex', marginBottom: '0.5rem', animation: 'toastSlide 0.3s ease both' }}>
            <div className="d-flex align-items-center gap-2">
              <i className={`bi bi-${ICONS[t.tone].icon} text-${ICONS[t.tone].color}`} />
              <span className="flex-grow-1">{t.msg}</span>
              <button type="button" className="toast-close" onClick={() => close(t.id)} aria-label="Tutup">&times;</button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => useContext(ToastCtx);
