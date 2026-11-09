/**
 * BackupPage — backup & restore database.
 * Backup menulis dump SQL lewat dialog simpan; restore membaca file SQL.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listBackupLogs, createBackup, restoreBackup } from '../lib/bindings';
import { useToast } from '../lib/toast';

const nf = new Intl.NumberFormat('id-ID');

const fmtSize = (bytes: unknown) => {
  const n = Number(bytes ?? 0);
  if (!n) return '—';
  if (n < 1024) return `${nf.format(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const statusCls = (s: unknown) => {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('success') || v.includes('berhasil')) return 'status-aktif';
  if (v.includes('fail') || v.includes('gagal')) return 'status-inaktif';
  return 'status-inaktif';
};

export const BackupPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listBackupLogs();
      setRows(Array.isArray(r) ? r : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const lastSuccess = useMemo(() => rows.find((r) => String(r.status ?? '').toLowerCase().includes('success')), [rows]);
  const totalSize = useMemo(() => rows.reduce((acc, r) => acc + Number(r.fileSize ?? 0), 0), [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = rows.slice((curPage - 1) * perPage, curPage * perPage);

  const doBackup = async () => {
    setBusy('backup');
    try {
      const res = await createBackup();
      if (res?.cancelled) push('info', 'Backup dibatalkan');
      else push('success', `Backup berhasil dibuat${res?.size ? ` (${fmtSize(res.size)})` : ''}`);
      await load();
    } catch (e) {
      push('danger', `Gagal membuat backup: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    if (!window.confirm('Restore database akan menimpa data saat ini dengan isi file backup. Lanjutkan?')) return;
    setBusy('restore');
    try {
      const res = await restoreBackup();
      if (res?.cancelled) push('info', 'Restore dibatalkan');
      else {
        push('success', 'Restore selesai — mulai ulang aplikasi untuk memuat data terbaru');
        await load();
      }
    } catch (e) {
      push('danger', `Gagal restore: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="backup-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-shield-check me-2"></i>Backup &amp; Restore</div>
            <div className="hero-sub">Amankan data arsip dengan backup berkala dan pemulihan file SQL</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => void doBackup()} disabled={busy !== null}>
              <i className={`bi ${busy === 'backup' ? 'bi-arrow-repeat' : 'bi-cloud-arrow-down'} me-1`}></i>{busy === 'backup' ? 'Memproses…' : 'Buat Backup'}
            </button>
            <button type="button" className="btn btn-outline-danger btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => void doRestore()} disabled={busy !== null}>
              <i className={`bi ${busy === 'restore' ? 'bi-arrow-repeat' : 'bi-arrow-counterclockwise'} me-1`}></i>{busy === 'restore' ? 'Memulihkan…' : 'Restore'}
            </button>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-blue"><i className="bi bi-archive"></i></div><div><div className="stat-mini-value">{nf.format(rows.length)}</div><div className="stat-mini-label">Total Backup</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-green"><i className="bi bi-check-circle"></i></div><div><div className="stat-mini-value">{nf.format(rows.filter((r) => String(r.status ?? '').toLowerCase().includes('success')).length)}</div><div className="stat-mini-label">Berhasil</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-amber"><i className="bi bi-hdd"></i></div><div><div className="stat-mini-value">{fmtSize(totalSize)}</div><div className="stat-mini-label">Total Ukuran</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-clock-history"></i></div><div><div className="stat-mini-value" style={{ fontSize: '0.95rem' }}>{lastSuccess?.created ?? '—'}</div><div className="stat-mini-label">Backup Terakhir</div></div></div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-clock-history text-primary me-2"></i>Riwayat Backup</h5>
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill fw-700 px-3" style={{ fontSize: '0.7rem' }} onClick={() => void load()} disabled={loading}>
            <i className="bi bi-arrow-repeat me-1"></i>Muat Ulang
          </button>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat riwayat backup…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : rows.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-cloud-arrow-down empty-icon"></i><p className="empty-title">Belum Ada Backup</p><p className="empty-desc">Klik "Buat Backup" untuk menyimpan salinan database</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th>Nama File</th>
                    <th style={{ width: 110 }}>Tipe</th>
                    <th style={{ width: 110 }}>Ukuran</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 170 }}>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, idx) => (
                    <tr key={r.id ?? idx}>
                      <td className="text-center text-muted fw-700 small">{(curPage - 1) * perPage + idx + 1}</td>
                      <td>
                        <div className="fw-700" style={{ fontSize: '0.85rem' }}>{r.fileName || '—'}</div>
                        <div className="text-muted" style={{ fontSize: '0.68rem', wordBreak: 'break-all' }}>{r.filePath || r.notes || '—'}</div>
                      </td>
                      <td><span className="badge badge-soft-primary">{r.type || 'database'}</span></td>
                      <td><span className="small fw-600">{r.size || fmtSize(r.fileSize)}</span></td>
                      <td><span className={`status-badge ${statusCls(r.status)}`}>{r.status || '—'}</span></td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}>{r.created || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(rows.length)}</strong> backup · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
          {totalPages > 1 && (
            <nav><ul className="pagination pagination-sm mb-0">
              <li className={`page-item${curPage <= 1 ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(Math.max(1, curPage - 1)); }}><i className="bi bi-chevron-left"></i></a></li>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pn) => (
                <li key={pn} className={`page-item${pn === curPage ? ' active' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(pn); }}>{pn}</a></li>
              ))}
              <li className={`page-item${curPage >= totalPages ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, curPage + 1)); }}><i className="bi bi-chevron-right"></i></a></li>
            </ul></nav>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupPage;
