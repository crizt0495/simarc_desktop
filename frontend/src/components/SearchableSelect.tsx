/**
 * SearchableSelect — dropdown dengan fitur pencarian (input + daftar hasil).
 * Digunakan untuk semua dropdownlist form agar user mudah mencari opsi
 * dari daftar yang panjang (master data, klasifikasi, unit, lokasi, dll).
 *
 * Panel dirender via portal ke <body> (position: fixed) agar TIDAK terpotong
 * overflow modal (.sm-body overflow-y:auto) — bug sebelumnya: daftar tidak
 * menampilkan data karena ter-clip di dalam modal Tambah Arsip.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const PANEL_MAX_HEIGHT = 240;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '— Pilih —',
  disabled,
  id,
  style,
}) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const sel = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(t) || o.value.toLowerCase().includes(t),
    );
  }, [options, q]);

  const measure = useCallback(() => {
    const input = wrapRef.current?.querySelector('input');
    if (!input) return;
    const r = input.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    const onResize = () => measure();
    const onScroll = () => measure();
    window.addEventListener('resize', onResize);
    // capture-phase scroll agar panel mengikuti scroll modal (.sm-body)
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open, measure]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inWrap = wrapRef.current?.contains(t);
      const inPanel = panelRef.current?.contains(t);
      if (!inWrap && !inPanel) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  // Sinkronkan tampilan input dengan nilai terpilih saat modal dibuka / value berubah
  useEffect(() => {
    setQ(sel ? sel.label : '');
  }, [sel?.value, open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ('');
  };

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
        maxHeight: PANEL_MAX_HEIGHT,
        overflowY: 'auto',
      }
    : undefined;

  const panel = open && rect ? (
    <div ref={panelRef} style={panelStyle}>
      {options.length === 0 ? (
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--nb-ink-4, #64748b)' }}>
          Tidak ada data tersedia.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--nb-ink-4, #64748b)' }}>
          Tidak ada hasil yang cocok.
        </div>
      ) : (
        filtered.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
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
              background: o.value === value ? 'var(--nb-primary-light, #eff4ff)' : 'transparent',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--nb-ink-2, #334155)',
            }}
          >
            {o.label}
          </button>
        ))
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        className="form-control form-control-sm"
        style={style}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        value={q}
        onFocus={() => {
          setOpen(true);
          measure();
          setQ(sel ? sel.label : '');
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {panel && createPortal(panel, document.body)}
    </div>
  );
};

export default SearchableSelect;
