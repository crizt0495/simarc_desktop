/**
 * UsersPage — modul manajemen petugas (Pengguna Sistem).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listUsers } from '../lib/bindings';
import { useToast } from '../lib/toast';

const nf = new Intl.NumberFormat('id-ID');

export const UsersPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const load = async () => {
    setLoading(true);
    try {
      const r = await listUsers();
      setRows(Array.isArray(r) ? r : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => [...rows].sort((x, y) => String(y.created ?? '').localeCompare(String(y.created ?? ''))), [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="users-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-people me-2"></i>Pengguna Sistem</div>
            <div className="hero-sub">Akun petugas dan hak akses sistem kearsipan</div>
          </div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-people text-primary me-2"></i>Daftar Petugas</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data petugas…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Petugas</p><p className="empty-desc">Tidak ada data pengguna sistem</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th>Username</th>
                    <th>Nama</th>
                    <th style={{ width: 140 }}>Role</th>
                    <th style={{ width: 180 }}>Unit Kerja</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 120 }}>Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((u, idx) => (
                    <tr key={u.id}>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{u.username}</span></td>
                      <td className="fw-600">{u.name}</td>
                      <td><span className="badge badge-soft-primary">{u.role || '—'}</span></td>
                      <td><span className="small fw-600">{u.unitKerja || '—'}</span></td>
                      <td><span className={`status-badge ${u.isActive ? 'status-aktif' : 'status-inaktif'}`}>{u.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}>{u.created || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> petugas · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
