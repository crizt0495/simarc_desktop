/**
 * SearchableSelect — dropdown dengan fitur pencarian (input + daftar hasil).
 * Digunakan untuk semua dropdownlist form agar user mudah mencari opsi
 * dari daftar yang panjang (master data, klasifikasi, unit, lokasi, dll).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

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

  const sel = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(t) || o.value.toLowerCase().includes(t),
    );
  }, [options, q]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const choose = (v: string) => {
    onChange(v);
    setQ('');
    setOpen(false);
  };

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 2000,
    background: 'var(--nb-surface, #ffffff)',
    border: '1px solid var(--nb-border, #e2e8f0)',
    borderRadius: 8,
    boxShadow: 'var(--nb-shadow-lg, 0 10px 30px rgba(15, 23, 42, 0.18))',
    maxHeight: 240,
    overflowY: 'auto',
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        className="form-control form-control-sm"
        style={style}
        disabled={disabled}
        autoComplete="off"
        placeholder={sel ? sel.label : placeholder}
        value={q}
        onFocus={() => {
          setOpen(true);
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
      {open && (
        <div className="position-absolute" style={panelStyle}>
          {filtered.length === 0 ? (
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
      )}
    </div>
  );
};

export default SearchableSelect;
