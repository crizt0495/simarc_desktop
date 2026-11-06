/**
 * LogActivityPage — modul laporan aktivitas petugas (Log Aktivitas).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listActivityLogs } from '../lib/bindings';
import { useToast } from '../lib/toast';

const nf = new Intl.NumberFormat('id-ID');

export const LogActivityPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 12;

  const load = async () => {
    setLoading(true);
    try {
      const r = await listActivityLogs();
      setRows(Array.isArray(r) ? r : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = (draftQ || '').trim().toLowerCase();
    const out = q ? rows.filter((l) => [l.userName, l.action, l.description, l.modelType].some((f) => (f || '').toString().toLowerCase().includes(q))) : rows;
    return [...out].sort((x, y) => String(y.createdAt ?? '').localeCompare(String(x.createdAt ?? '')));
  }, [rows]);

  const [draftQ, setDraftQ] = useState('');
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="mon-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-clock-history me-2"></i>Log Aktivitas</div>
            <div className="hero-sub">Catatan aktivitas petugas pada sistem kearsipan</div>
          </div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-clock-history text-primary me-2"></i>Aktivitas Terbaru</h5>
          <input type="search" className="form-control form-control-sm" style={{ width: 'auto', minWidth: '220px', fontSize: '0.8rem' }} placeholder="Cari aktivitas / petugas…" value={draftQ} onChange={(e) => { setDraftQ(e.target.value); setPage(1); }} />
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat log aktivitas…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Aktivitas</p><p className="empty-desc">Tidak ada catatan aktivitas pada sistem</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th style={{ width: 200 }}>Waktu</th>
                    <th style={{ width: 170 }}>Petugas</th>
                    <th style={{ width: 150 }}>Aksi</th>
                    <th>Detail Aktivitas</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((l, idx) => (
                    <tr key={l.id}>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}><i className="bi bi-clock me-1"></i>{l.createdAt || '—'}</span></td>
                      <td><span className="small fw-600"><i className="bi bi-person me-1"></i>{l.userName || 'Sistem'}</span></td>
                      <td><span className="badge badge-soft-primary"><i className="bi bi-gear me-1"></i>{l.action || '—'}</span></td>
                      <td><div className="small" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{l.description || '—'}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> aktivitas · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
          {totalPages > 1 && (
            <nav><ul className="pagination pagination-sm mb-0">
              <li className={`page-item${curPage <= 1 ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(Math.max(1, curPage - 1)); }} title="Sebelum"><i className="bi bi-chevron-left"></i></a></li>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pn) => (
                <li key={pn} className={`page-item${pn === curPage ? ' active' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(pn); }}>{pn}</a></li>
              ))}
              <li className={`page-item${curPage >= totalPages ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, curPage + 1)); }} title="Berikut"><i className="bi bi-chevron-right"></i></a></li>
            </ul></nav>
          )}
        </div>
      </div>
    </div>
  );
};
