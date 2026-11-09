/**
 * FormModal — modal formulir generik SIMARC.
 * Dipakai seluruh modul CRUD (master data, arsip, jadwal retensi, dsb.)
 * sehingga tampilan tetap konsisten dengan design system `.sm*`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import SearchableSelect, { type SearchableSelectOption } from './SearchableSelect';

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'password' | 'email';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  help?: string;
  col?: number; // 1..12 (default 6)
  rows?: number;
  step?: string;
  min?: string | number;
  max?: string | number;
  disabled?: boolean;
};

export interface FormModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fields: FieldDef[];
  initial?: Record<string, any>;
  submitLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  onValuesChange?: (values: Record<string, any>) => void;
}

const emptyFor = (fields: FieldDef[]): Record<string, any> => {
  const out: Record<string, any> = {};
  fields.forEach((f) => { out[f.key] = f.type === 'checkbox' ? false : ''; });
  return out;
};

export const FormModal: React.FC<FormModalProps> = ({
  open, title, subtitle, icon = 'pencil-square', size = 'lg',
  fields, initial, submitLabel = 'Simpan', busy = false, onClose, onSubmit, onValuesChange,
}) => {
  const initialKey = useMemo(() => JSON.stringify(initial ?? {}), [initial]);
  const [values, setValues] = useState<Record<string, any>>(() => ({ ...emptyFor(fields), ...(initial ?? {}) }));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setValues({ ...emptyFor(fields), ...(initial ?? {}) });
    // fields statis per halaman; cukup reset saat modal dibuka / target berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  // Notifies parent about current values (dipakai untuk dropdown kondisional, mis. jenis SPJ).
  useEffect(() => {
    if (!open) return;
    onValuesChange?.(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, open]);

  if (!open) return null;

  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? '').trim()) {
        setError(`${f.label} wajib diisi.`);
        return;
      }
    }
    try {
      await onSubmit(values);
    } catch (err: any) {
      setError(String(err?.message ?? err ?? 'Terjadi kesalahan'));
    }
  };

  const colOf = (f: FieldDef) => f.col ?? (f.type === 'textarea' ? 12 : 6);

  return (
    <div className={`sm sm-show sm-${size}`} role="dialog" aria-modal="true">
      <div className="sm-overlay sm-show" onClick={busy ? undefined : onClose} />
      <div className="sm-dialog">
        <div className="sm-content">
          <div className="sm-header">
            <div className="sm-header-left">
              <div className="sm-icon sm-icon-primary"><i className={`bi bi-${icon}`} /></div>
              <div className="sm-title-group">
                <h5 className="sm-title">{title}</h5>
                {subtitle && <p className="sm-subtitle">{subtitle}</p>}
              </div>
            </div>
            <button type="button" className="sm-btn-close" onClick={onClose} disabled={busy} aria-label="Tutup">
              <i className="bi bi-x" />
            </button>
          </div>
          <form onSubmit={submit} style={{ display: 'contents' }}>
            <div className="sm-body">
              {error && <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.78rem' }}>{error}</div>}
              <div className="row g-2">
                {fields.map((f) => (
                  <div className={`col-md-${colOf(f)}`} key={f.key}>
                    {f.type === 'checkbox' ? (
                      <div className="form-check mt-md-4 pt-md-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`fm-${f.key}`}
                          checked={Boolean(values[f.key])}
                          onChange={(e) => set(f.key, e.target.checked)}
                          disabled={f.disabled || busy}
                        />
                        <label className="form-check-label fw-600" htmlFor={`fm-${f.key}`} style={{ fontSize: '0.82rem' }}>
                          {f.label}
                        </label>
                      </div>
                    ) : (
                      <>
                        <label className="form-label">
                          {f.label}{f.required && <span className="text-danger ms-1">*</span>}
                        </label>
                        {f.type === 'select' ? (
                          <SearchableSelect
                            options={(f.options ?? []) as SearchableSelectOption[]}
                            value={String(values[f.key] ?? '')}
                            onChange={(v) => set(f.key, v)}
                            disabled={f.disabled || busy}
                            placeholder={f.placeholder || '— Pilih —'}
                          />
                        ) : f.type === 'textarea' ? (
                          <textarea
                            className="form-control"
                            rows={f.rows ?? 3}
                            value={values[f.key] ?? ''}
                            placeholder={f.placeholder}
                            onChange={(e) => set(f.key, e.target.value)}
                            disabled={f.disabled || busy}
                            style={{ fontSize: '0.85rem' }}
                          />
                        ) : (
                          <input
                            className="form-control form-control-sm"
                            type={f.type ?? 'text'}
                            value={values[f.key] ?? ''}
                            placeholder={f.placeholder}
                            step={f.step}
                            min={f.min}
                            max={f.max}
                            onChange={(e) => set(f.key, e.target.value)}
                            disabled={f.disabled || busy}
                            style={{ fontSize: '0.85rem' }}
                          />
                        )}
                        {f.help && <small className="text-muted" style={{ fontSize: '0.7rem' }}>{f.help}</small>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="sm-footer">
              <button type="button" className="sm-btn sm-btn-cancel" onClick={onClose} disabled={busy}>
                <i className="bi bi-x-lg me-1" />Batal
              </button>
              <button type="submit" className="sm-btn sm-btn-confirm" disabled={busy}>
                {busy ? <i className="bi bi-arrow-repeat me-1" /> : <i className="bi bi-check-lg me-1" />}
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FormModal;
