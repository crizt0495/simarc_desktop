/**
 * SimarcModal — replika reaksi dari `web/static/js/modal-manager.js`
 * (SIMARC V4): portal di akhir <body>, overlay blur, animasi pop, Esc untuk
 * menutup, klik backdrop menutup, nama-nama class (`.sm*`) mengikuti
 * enterprise.css agar tampilan modal identik.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Store = { open: string[] };
type Listener = () => void;

let state: Store = { open: [] };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
const setState = (fn: (s: Store) => Store) => {
  state = fn(state);
  emit();
};

export const SimarcModal = {
  isOpen(id: string) {
    return state.open.includes(id);
  },
  show(id: string) {
    setState((s) => (s.open.includes(id) ? s : { open: [...s.open, id] }));
  },
  hide(id: string) {
    setState((s) => ({ open: s.open.filter((x) => x !== id) }));
  },
};

const ModalCtx = createContext<{ hide: (id: string) => void }>({ hide: SimarcModal.hide });

/** Vokal singkat agar list masuk re-render saat store berubah. */
const useSnap = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const l: Listener = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state.open;
};

/**
 * Satu modal. Selalu dirender (visibility) supaya state anak tetap hidup —
 * sama seperti <template data-modal> referensi.
 */
export const SmModal: React.FC<{
  id: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}> = ({ id, size = 'md', children }) => {
  const open = useSnap();
  const isOpen = open.includes(id);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') SimarcModal.hide(id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, id]);

  const cls = `sm${isOpen ? ' sm-show' : ''} sm-${size}`;
  return (
    <div
      className={cls}
      role="dialog"
      aria-modal="true"
      id={id}
      style={isOpen ? undefined : { visibility: 'hidden', opacity: 0 }}
      aria-hidden={!isOpen}
    >
      <div className="sm-overlay" onClick={() => SimarcModal.hide(id)} />
      <div className="sm-dialog">
        <div className="sm-content">{children}</div>
      </div>
    </div>
  );
};

/** Header modal gaya referensi (sm-header / sm-title-group). */
export const SmHeader: React.FC<{ id: string; title: string; subtitle?: string; icon?: string; iconColor?: string }> = ({ id, title, subtitle, icon, iconColor = 'primary' }) => (
  <div className="sm-header">
    <div className="sm-header-left">
      {icon && (
        <div className={`sm-icon sm-icon-${iconColor}`}>
          <i className={`bi bi-${icon}`} />
        </div>
      )}
      <div className="sm-title-group">
        <h5 className="sm-title">{title}</h5>
        {subtitle && <p className="sm-subtitle">{subtitle}</p>}
      </div>
    </div>
    <button type="button" className="sm-btn-close" onClick={() => SimarcModal.hide(id)} aria-label="Close">
      <i className="bi bi-x" />
    </button>
  </div>
);
