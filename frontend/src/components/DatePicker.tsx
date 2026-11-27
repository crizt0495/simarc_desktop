/**
 * DatePicker — input tanggal yang ramah operator.
 *
 * Nilai yang disimpan tetap string `YYYY-MM-DD` (format yang dipakai backend),
 * tetapi pengguna bisa mengetik `DD-MM-YYYY`, `DD/MM/YYYY`, `DDMMYYYY`,
 * `hari ini`, `kemarin`, `besok`, atau memilih lewat kalender pop-up.
 * Komponen ini sengaja tanpa dependensi pihak ketiga agar ringan di desktop.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './datepicker.css';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const POPUP_WIDTH = 296;
const POPUP_HEIGHT = 340;

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fromISO = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
};

/** Format tampilan Indonesia; dikembalikan kosong bila nilainya tidak valid. */
const toDisplay = (value: string) => {
  const d = fromISO(value);
  return d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : '';
};

const shiftDays = (iso: string, delta: number) => {
  const d = fromISO(iso) ?? new Date();
  d.setDate(d.getDate() + delta);
  return toISO(d);
};

/** Terima banyak bentuk ketikan umum; null = belum bisa diartikan. */
const parseTyped = (raw: string): string | null | '' => {
  let s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return '';
  const now = new Date();

  if (/^(hari ini|today|sekarang)$/.test(s)) return toISO(now);
  if (/^(kemarin|yesterday)$/.test(s)) return shiftDays(toISO(now), -1);
  if (/^(besok|tomorrow)$/.test(s)) return shiftDays(toISO(now), 1);
  if (/^\+\d+$/.test(s)) return shiftDays(toISO(now), Number(s.slice(1)));
  if (/^-\d+$/.test(s)) return shiftDays(toISO(now), -Number(s.slice(1)));

  let d: number;
  let mo: number;
  let y: number;
  const compact = s.replace(/\D/g, '');
  const parts = s.split(/[\/.\-\s]+/).filter(Boolean);
  if (parts.length === 3 && parts[0].length === 4) {
    //YYYY-MM-DD (atau YYYY/MM/DD) — tahun di depan.
    y = Number(parts[0]); mo = Number(parts[1]); d = Number(parts[2]);
  } else if (compact.length === 8) {
    // DDMMYYYY — bentuk paling sering diketik operator Indonesia.
    d = Number(compact.slice(0, 2));
    mo = Number(compact.slice(2, 4));
    y = Number(compact.slice(4));
  } else if (compact.length === 6) {
    d = Number(compact.slice(0, 2));
    mo = Number(compact.slice(2, 4));
    y = Number(compact.slice(4));
  } else {
    const nums = (s.match(/\d+/g) ?? []).map(Number);
    if (nums.length === 1) {
      d = nums[0];
      mo = now.getMonth() + 1;
      y = now.getFullYear();
    } else if (nums.length === 2) {
      d = nums[0];
      mo = nums[1];
      y = now.getFullYear();
    } else if (nums.length >= 3) {
      // Awalan 4 digit dipakai sebagai tahun (YYYY-MM-DD), sebaliknya DD-MM-YYYY.
      if (nums[0] >= 1900 && nums[0] <= 2100) {
        y = nums[0]; mo = nums[1]; d = nums[2];
      } else {
        d = nums[0]; mo = nums[1]; y = nums[2];
      }
    } else {
      return null;
    }
  }

  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (y < 1900 || y > 2100) return null;
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return toISO(date);
};

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, disabled, placeholder }) => {
  const [text, setText] = useState(() => toDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [view, setView] = useState(() => {
    const d = fromISO(value) ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastEmitted = useRef(value);

  // Nilai bisa diganti dari luar (misal saat modal dibuka untuk data lain).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(toDisplay(value));
      setInvalid(false);
      const d = fromISO(value);
      if (d) setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: Event) => {
      const target = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const emit = (iso: string) => {
    lastEmitted.current = iso;
    onChange(iso);
  };

  const commit = (raw: string) => {
    const iso = parseTyped(raw);
    if (iso === null) {
      setInvalid(true);
      setText(toDisplay(lastEmitted.current));
      return;
    }
    setInvalid(false);
    setText(toDisplay(iso));
    emit(iso);
  };

  const choose = (iso: string) => {
    setInvalid(false);
    if (iso) {
      setText(toDisplay(iso));
      const d = fromISO(iso);
      if (d) setView({ year: d.getFullYear(), month: d.getMonth() });
    } else {
      setText('');
    }
    emit(iso);
    setOpen(false);
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(8, Math.min(r.right - POPUP_WIDTH, window.innerWidth - POPUP_WIDTH - 8));
      const below = r.bottom + 6;
      const top = below + POPUP_HEIGHT > window.innerHeight ? Math.max(8, r.top - POPUP_HEIGHT - 6) : below;
      setPos({ top, left });
    }
    setOpen(true);
  };

  const days = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const offset = (first.getDay() + 6) % 7; // Senin di kolom pertama
    const start = new Date(view.year, view.month, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const moveMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const today = toISO(new Date());

  return (
    <div className="dp" ref={rootRef}>
      <div className={`dp-input${invalid ? ' dp-invalid' : ''}`}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="form-control form-control-sm dp-text"
          value={text}
          placeholder={placeholder || 'DD-MM-YYYY'}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            const iso = parseTyped(raw);
            if (iso === null) {
              setInvalid(false); // pengguna masih mengetik
              return;
            }
            setInvalid(false);
            emit(iso);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          ref={triggerRef}
          className="dp-trigger"
          onClick={toggle}
          onMouseDown={(e) => e.preventDefault()}
          disabled={disabled}
          aria-label="Buka kalender"
          title="Buka kalender"
        >
          <i className="bi bi-calendar3"></i>
        </button>
      </div>
      {invalid && <small className="dp-hint">Tanggal tidak dikenali. Contoh: 17-08-1945 atau “hari ini”.</small>}

      {open && (
        <div className="dp-pop" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Pilih tanggal">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => moveMonth(-1)} aria-label="Bulan sebelumnya"><i className="bi bi-chevron-left"></i></button>
            <div className="dp-title">{MONTHS[view.month]} {view.year}</div>
            <button type="button" className="dp-nav" onClick={() => moveMonth(1)} aria-label="Bulan berikutnya"><i className="bi bi-chevron-right"></i></button>
          </div>
          <div className="dp-week">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="dp-grid">
            {days.map((d) => {
              const iso = toISO(d);
              const cls = ['dp-day'];
              if (d.getMonth() !== view.month) cls.push('dp-day-out');
              if (iso === today) cls.push('dp-day-today');
              if (iso === value) cls.push('dp-day-selected');
              return (
                <button type="button" key={iso} className={cls.join(' ')} onClick={() => choose(iso)}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="dp-quick">
            <button type="button" onClick={() => choose(today)}>Hari ini</button>
            <button type="button" onClick={() => choose(shiftDays(today, -1))}>Kemarin</button>
            <button type="button" onClick={() => choose('')}>Bersihkan</button>
          </div>
          <div className="dp-foot">Bisa juga ketik <strong>17-08-1945</strong> atau <strong>hari ini</strong></div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
