/**
 * PemusnahanPage — modul pemusnahan arsip (antrean pengajuan pemusnahan).
 * Menampilkan daftar permohonan pemusnahan yang dikelompokkan dari arsip.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listPemusnahan, listArsipDetail, createPemusnahan, updatePemusnahanStatus } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { ArsipDetailModal } from '../components/ArsipDetailModal';

const nf = new Intl.NumberFormat('id-ID');
const statusLabel = (s: string) => (s ? s.replace(/_/g, ' ') : '—');

const destruksiBadge = (s: unknown): string => {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('diajukan') || v.includes('pending') || v.includes('menunggu')) return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  if (v.includes('approved') || v.includes('disetujui') || v.includes('proses')) return 'bg-info-subtle text-info-emphasis border border-info-subtle';
  if (v.includes('reject') || v.includes('ditolak') || v.includes('batal')) return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle';
  if (v.includes('selesai') || v.includes('completed') || v.includes('dikendalikan')) return 'bg-success-subtle text-success-emphasis border border-success-subtle';
  return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
};

export const PemusnahanPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [detail, setDetail] = useState<any | null>(null);
  const [draftQ, setDraftQ] = useState('');
  const [arsips, setArsips] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [kegiatan, setKegiatan] = useState('Pemusnahan Arsip');
  const [alasan, setAlasan] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([listPemusnahan(), listArsipDetail()]);
      setRows(Array.isArray(r) ? r : []);
      setArsips(Array.isArray(a) ? a : []);
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
    const out = q ? rows.filter((p) => [p.nomor, p.nama, p.uraian, p.status, p.namaKegiatan, p.alasanPengajuan].some((f) => (f || '').toString().toLowerCase().includes(q))) : rows;
    return [...out].sort((x, y) => String(y.created ?? '').localeCompare(String(x.created ?? '')));
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const antrean = rows.filter((p) => String(p.status ?? '').toLowerCase().includes('diajukan') || String(p.status ?? '').toLowerCase().includes('pending')).length;

  const openArsip = (p: any) => { if (p && p.nomor) setDetail(p); };

  const setStatus = async (p: any, status: string) => {
    if (!window.confirm(`Ubah status pemusnahan ${p.nama || p.nomor} menjadi "${status}"?`)) return;
    try {
      await updatePemusnahanStatus(p.id, status, '');
      push('success', `Status pemusnahan diperbarui: ${status}`);
      await load();
    } catch (e) {
      push('danger', `Gagal memperbarui: ${e}`);
    }
  };

  const submitCreate = async () => {
    if (sel.size === 0) { push('warning', 'Pilih minimal satu arsip'); return; }
    setBusy(true);
    try {
      const res = await createPemusnahan(Array.from(sel), kegiatan, alasan);
      push('success', `${res?.created ?? sel.size} pengajuan pemusnahan dibuat`);
      setCreateOpen(false);
      setSel(new Set());
      setAlasan('');
      await load();
    } catch (e) {
      push('danger', `Gagal membuat pengajuan: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const eligible = arsips.filter((a) => ['musnah', 'siap_penyusutan'].includes(String(a.status ?? '').toLowerCase()));
  const eligibleRows = eligible.filter((a) => {
    const q = draftQ.trim().toLowerCase();
    return !q || [a.nomor, a.nama, a.unit].some((f) => String(f ?? '').toLowerCase().includes(q));
  });

  return (
    <>
    <div className="container-fluid py-3 py-xl-4">
      <div className="pemusnahan-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-trash3 me-2"></i>Pemusnahan Arsip</div>
            <div className="hero-sub">Pengajuan pemusnahan arsip — {nf.format(antrean)} permohonan menunggu</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => { setSel(new Set()); setCreateOpen(true); }}>
            <i className="bi bi-plus-lg "></i></button>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-trash3"></i></div><div><div className="stat-mini-value">{nf.format(rows.length)}</div><div className="stat-mini-label">Total Pemusnahan</div></div></div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-trash3 text-danger me-2"></i>Antrean Pemusnahan</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data pemusnahan…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Pemusnahan</p><p className="empty-desc">Tidak ada data permohonan pemusnahan arsip</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th>Arsip</th>
                    <th style={{ width: 180 }}>Kegiatan</th>
                    <th style={{ width: 140 }}>Penyelenggara</th>
                    <th style={{ width: 140 }}>Tanggal</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ width: 100 }} className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p, idx) => (
                    <tr key={p.id}>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td>
                        <div>
                          <span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{p.nomor || '—'}</span>
                          <a href="#" className="fw-800 text-decoration-none" style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }} onClick={(e) => { e.preventDefault(); openArsip(p); }}>{p.nama || '—'}</a>
                          {p.uraian && <div className="text-muted mt-1" style={{ fontSize: '0.7rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>{String(p.uraian)}</div>}
                        </div>
                      </td>
                      <td><span className="small fw-600">{p.namaKegiatan || '—'}</span></td>
                      <td><span className="small fw-600"><i className="bi bi-person me-1"></i>{p.userPengaju || '—'}</span></td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}><i className="bi bi-calendar3 me-1"></i>{p.tanggalPelaksanaan || p.tanggalPengajuan || '—'}</span></td>
                      <td><span className={`status-badge ${destruksiBadge(p.status)}`}>{statusLabel(String(p.status ?? ''))}</span></td>
                      <td className="text-center"><div className="btn-crud-group">
                        <button type="button" className="btn-crud btn-crud-view" title="Detail" onClick={() => openArsip(p)}><i className="bi bi-eye"></i></button>
                        {String(p.status ?? '').toLowerCase().includes('diajukan') && (
                          <>
                            <button type="button" className="btn-crud btn-crud-success" title="Setujui" onClick={() => void setStatus(p, 'disetujui')}><i className="bi bi-check-lg"></i></button>
                            <button type="button" className="btn-crud btn-crud-del" title="Tolak" onClick={() => void setStatus(p, 'ditolak')}><i className="bi bi-x-lg"></i></button>
                          </>
                        )}
                        {String(p.status ?? '').toLowerCase().includes('disetujui') && (
                          <button type="button" className="btn-crud btn-crud-primary" title="Selesaikan pemusnahan" onClick={() => void setStatus(p, 'selesai')}><i className="bi bi-check2-all"></i></button>
                        )}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-5"><div className="text-muted"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i><h6 className="fw-700">Belum Ada Pemusnahan</h6><small className="text-muted">Tidak ada data permohonan pemusnahan arsip</small></div></div>
              )}
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> pemusnahan · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
    {createOpen && (
      <div className="sm sm-show sm-xl" role="dialog" aria-modal="true">
        <div className="sm-overlay sm-show" onClick={() => setCreateOpen(false)} />
        <div className="sm-dialog"><div className="sm-content">
          <div className="sm-header">
            <div className="sm-header-left">
              <div className="sm-icon sm-icon-primary"><i className="bi bi-trash3" /></div>
              <div className="sm-title-group">
                <h5 className="sm-title">Buat Pengajuan Pemusnahan</h5>
                <p className="sm-subtitle">Pilih arsip yang memenuhi kriteria pemusnahan</p>
              </div>
            </div>
            <button type="button" className="sm-btn-close" onClick={() => setCreateOpen(false)}><i className="bi bi-x" /></button>
          </div>
          <div className="sm-body">
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label className="form-label">Nama Kegiatan</label>
                <input className="form-control form-control-sm" value={kegiatan} onChange={(e) => setKegiatan(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Alasan Pengajuan</label>
                <input className="form-control form-control-sm" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Masa retensi telah berakhir" />
              </div>
              <div className="col-12">
                <label className="form-label">Cari Arsip</label>
                <input type="search" className="form-control form-control-sm" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Nomor / nama / unit…" />
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <small className="text-muted fw-600">{sel.size} arsip dipilih · {eligibleRows.length} arsip memenuhi kriteria</small>
              <button type="button" className="btn btn-sm btn-outline-primary rounded-pill fw-700" style={{ fontSize: '0.7rem' }} onClick={() => setSel(new Set(eligibleRows.map((a) => a.id)))}>Pilih Semua</button>
            </div>
            <div style={{ maxHeight: '38vh', overflowY: 'auto' }}>
              <table className="table table-sm table-hover mb-0">
                <thead><tr><th style={{ width: 40 }}></th><th>Nomor</th><th>Nama</th><th>Status</th></tr></thead>
                <tbody>
                  {eligibleRows.map((a) => (
                    <tr key={a.id}>
                      <td><input type="checkbox" className="form-check-input" checked={sel.has(a.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} /></td>
                      <td><span className="small font-monospace fw-700">{a.nomor || '—'}</span></td>
                      <td><span className="small fw-600">{a.nama}</span></td>
                      <td><span className={`status-badge status-${String(a.status ?? '').toLowerCase()}`}>{String(a.status ?? '').replace(/_/g, ' ')}</span></td>
                    </tr>
                  ))}
                  {eligibleRows.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">Belum ada arsip dengan status musnah / siap penyusutan. Proses jadwal retensi terlebih dahulu.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="sm-footer">
            <button type="button" className="sm-btn sm-btn-cancel" onClick={() => setCreateOpen(false)}><i className="bi bi-x-lg me-1" />Batal</button>
            <button type="button" className="sm-btn sm-btn-confirm" disabled={busy || sel.size === 0} onClick={() => void submitCreate()}><i className="bi bi-send me-1" />Ajukan Pemusnahan</button>
          </div>
        </div></div>
      </div>
    )}
    <ArsipDetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
};
