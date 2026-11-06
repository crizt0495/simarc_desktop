/**
 * PemberkasanPage — modul pemberkasan arsip (berkaskan berkas).
 * Menampilkan daftar berkas + jumlah arsip dalam berkas masing-masing.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listPemberkasan } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { ArsipDetailModal } from '../components/ArsipDetailModal';

const nf = new Intl.NumberFormat('id-ID');
const statusLabel = (s: string) => (s ? s.replace(/_/g, ' ') : '—');

const berkasBadge = (s: unknown): string => {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('aktif') || v.includes('open') || v.includes('buka')) return 'bg-success-subtle text-success-emphasis border border-success-subtle';
  if (v.includes('close') || v.includes('tutup') || v.includes('selesai') || v.includes('inactive')) return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
  if (v.includes('pending') || v.includes('review')) return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  return 'bg-info-subtle text-info-emphasis border border-info-subtle';
};

export const PemberkasanPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [detail, setDetail] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listPemberkasan();
      setRows(Array.isArray(r) ? r : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => [...rows].sort((x, y) => Number(y.tahun ?? 0) - Number(x.tahun ?? 0) || String(y.namaPemberkasan ?? '').localeCompare(String(x.namaPemberkasan ?? ''))), [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const totalArsip = rows.reduce((acc, r) => acc + Number(r.arsipCount ?? 0), 0);

  const openArsip = (r: any) => { if (r && r.nomor) setDetail(r); };

  return (
    <>
    <div className="container-fluid py-3 py-xl-4">
      <div className="berkas-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-folder me-2"></i>Pemberkasan</div>
            <div className="hero-sub">Berkas arsip — {nf.format(totalArsip)} arsip dalam {nf.format(rows.length)} berkas</div>
          </div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-folder text-primary me-2"></i>Daftar Berkas</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data berkas…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Berkas</p><p className="empty-desc">Tidak ada data berkas pemberkasan</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th style={{ width: 130 }}>Kode Berkas</th>
                    <th>Nama Berkas</th>
                    <th style={{ width: 90 }}>Tahun</th>
                    <th style={{ width: 160 }}>Unit Kerja</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 110 }} className="text-center">Arsip</th>
                    <th style={{ width: 100 }} className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((b, idx) => (
                    <tr key={b.id}>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{b.kodeBerkas || '—'}</span></td>
                      <td className="fw-600">{b.namaPemberkasan}</td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}>{b.tahun || '—'}</span></td>
                      <td><span className="small fw-600"><i className="bi bi-building text-primary me-1"></i>{b.unitKerja || b.unitKerjaId || '—'}</span></td>
                      <td><span className={`status-badge ${berkasBadge(b.statusBerkas)}`}>{statusLabel(String(b.statusBerkas ?? ''))}</span></td>
                      <td className="text-center"><span className="badge badge-soft-primary">{nf.format(Number(b.arsipCount ?? 0))} arsip</span></td>
                      <td className="text-center"><div className="d-flex justify-content-center gap-1">
                        <button type="button" className="btn-crud btn-crud-view" title="Detail" onClick={() => openArsip(b)}><i className="bi bi-eye me-1"></i>Detail</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-5"><div className="text-muted"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i><h6 className="fw-700">Belum Ada Berkas</h6><small className="text-muted">Tidak ada data berkas pemberkasan</small></div></div>
              )}
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> berkas · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
    <ArsipDetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
};
