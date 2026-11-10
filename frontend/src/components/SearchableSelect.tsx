/**
 * SearchableSelect — dropdown dengan kotak pencarian untuk SEMUA dropdownlist
 * aplikasi (master data, klasifikasi, unit kerja, lokasi, status, dll).
 *
 * Fitur:
 * - Ketik untuk mencari (filter label + value, tidak peka huruf besar/kecil).
 * - Saat dibuka, seluruh opsi langsung tampil (bukan hanya nilai terpilih).
 * - Navigasi keyboard: ↑ / ↓ untuk memilih, Enter untuk menerapkan, Esc menutup.
 * - Daftar panjang dibatasi 200 baris agar tetap ringan, dengan petunjuk
 *   "ketik untuk mempersempit".
 * - Panel dirender via portal ke <body> (position: fixed) supaya tidak terpotong
 *   overflow modal (.sm-body overflow-y:auto), dan otomatis flip ke atas bila
 *   ruang di bawah kurang.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

const PANEL_MAX_HEIGHT = 260;
const RENDER_LIMIT = 200;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '— Pilih —',
  disabled,
  id,
  style,
}) => {
  const listId = useId();
  const [q, setQ] = useState('');          // teks yang terlihat di input
  const [query, setQuery] = useState('');  // kata kunci filter aktif
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
    maxHeight: number;
  } | null>(null);

  const sel = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(t) || o.value.toLowerCase().includes(t),
    );
  }, [options, query]);

  const shown = useMemo(() => filtered.slice(0, RENDER_LIMIT), [filtered]);

  const measure = useCallback(() => {
    const input = wrapRef.current?.querySelector('input');
    if (!input) return;
    const r = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(PANEL_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
    const top = openUp ? Math.max(8, r.top - 4 - maxHeight) : r.bottom + 4;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
    setRect({ top, left, width: r.width, openUp, maxHeight });
  }, []);

  const openPanel = useCallback(() => {
    if (disabled) return;
    measure();
    setOpen(true);
    setQuery('');
    setQ(sel ? sel.label : '');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [disabled, measure, options, sel, value]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setQuery('');
    setQ(sel ? sel.label : '');
  }, [sel]);

  const choose = useCallback(
    (v: string) => {
      onChange(v);
      const picked = options.find((o) => o.value === v);
      setOpen(false);
      setQuery('');
      setQ(picked ? picked.label : '');
    },
    [onChange, options],
  );

  /* Sinkronkan tampilan saat nilai berubah dari luar (mis. reset form) */
  useEffect(() => {
    if (!open) {
      setQ(sel ? sel.label : '');
      setQuery('');
    }
  }, [sel?.label, open]);

  /* Reset pilihan keyboard setiap kata kunci / daftar berubah */
  useEffect(() => {
    setActive(0);
  }, [query, options]);

  /* Posisi panel mengikuti scroll (termasuk scroll modal) & resize */
  useEffect(() => {
    if (!open) return;
    const onMove = () => measure();
    window.addEventListener('resize', onMove);
    document.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      document.removeEventListener('scroll', onMove, true);
    };
  }, [open, measure]);

  /* Klik di luar menutup panel */
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) closePanel();
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [closePanel]);

  /* Pastikan baris aktif tetap terlihat saat navigasi keyboard */
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const panelStyle: React.CSSProperties | undefined = rect
    ? {
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        zIndex: 5000,
        background: 'var(--nb-surface, #ffffff)',
        border: '1px solid var(--nb-border, #e2e8f0)',
        borderRadius: 8,
        boxShadow: 'var(--nb-shadow-lg, 0 10px 30px rgba(15, 23, 42, 0.18))',
        maxHeight: rect.maxHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    : undefined;

  const panel = open && rect ? (
    <div ref={panelRef} style={panelStyle} role="listbox" id={listId}>
      <div style={{ overflowY: 'auto', flex: 1 }} data-panel-scroll="1">
        {options.length === 0 ? (
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--nb-ink-4, #64748b)' }}>
            Tidak ada data tersedia.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--nb-ink-4, #64748b)' }}>
            Tidak ada hasil untuk “{query}”.
          </div>
        ) : (
          shown.map((o, idx) => (
            <button
              key={o.value}
              type="button"
              id={`${listId}-${idx}`}
              role="option"
              aria-selected={o.value === value}
              data-idx={idx}
              onMouseEnter={() => setActive(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.value);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.45rem 0.75rem',
                fontSize: '0.82rem',
                background:
                  idx === active
                    ? 'var(--nb-primary-light, #eff4ff)'
                    : o.value === value
                      ? 'var(--nb-primary-light, #eff4ff)'
                      : 'transparent',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: 'var(--nb-ink-2, #334155)',
                fontWeight: o.value === value ? 600 : 400,
              }}
            >
              {o.label}
            </button>
          ))
        )}
      </div>
      {filtered.length > shown.length && (
        <div
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.7rem',
            color: 'var(--nb-ink-4, #64748b)',
            borderTop: '1px solid var(--nb-border, #e2e8f0)',
            background: 'var(--nb-surface-2, #f8fafd)',
            flexShrink: 0,
          }}
        >
          Menampilkan {shown.length} dari {filtered.length} opsi — ketik untuk mempersempit.
        </div>
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <i
        className="bi bi-search"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '0.6rem',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '0.72rem',
          color: 'var(--nb-ink-4, #64748b)',
          pointerEvents: 'none',
        }}
      />
      <input
        id={id}
        className="form-control form-control-sm"
        style={{ paddingLeft: '1.7rem', ...style }}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        value={q}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        onFocus={(e) => {
          openPanel();
          // Pilih seluruh teks agar user bisa langsung mengetik kata kunci.
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setQuery(e.target.value);
          setActive(0);
          if (!open) measure();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            closePanel();
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) {
              openPanel();
              return;
            }
            setActive((i) => Math.min(i + 1, shown.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
              openPanel();
              return;
            }
            setActive((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === 'Enter') {
            if (open && shown[active]) {
              e.preventDefault();
              choose(shown[active].value);
            }
            return;
          }
          if (e.key === 'Tab') {
            closePanel();
          }
        }}
        onBlur={() => {
          // Tutup hanya bila fokus benar-benar keluar dari komponen.
          window.setTimeout(() => {
            const el = document.activeElement;
            if (!wrapRef.current?.contains(el) && !panelRef.current?.contains(el)) closePanel();
          }, 0);
        }}
      />
      {panel && createPortal(panel, document.body)}
    </div>
  );
};

export default SearchableSelect;
