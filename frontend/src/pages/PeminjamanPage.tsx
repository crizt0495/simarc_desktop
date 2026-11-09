/**
 * PeminjamanPage — modul peminjaman arsip (Daftar Peminjaman & Permohonan Pinjam).
 * Mode 'list'    → tabel daftar peminjaman aktif (dengan modal Detail arsip).
 * Mode 'create' → form pengajuan permohonan pinjam baru.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listPeminjaman, listArsipDetail, listUsers, createPeminjaman, updatePeminjamanStatus } from '../lib/bindings';
import { useToast } from '../lib/toast';
import SearchableSelect from '../components/SearchableSelect';
import { ArsipDetailModal } from '../components/ArsipDetailModal';

const nf = new Intl.NumberFormat('id-ID');
const statusLabel = (s: string) => (s ? s.replace(/_/g, ' ') : '—');

const pinjamBadge = (s: unknown): string => {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('pending')) return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  if (v.includes('approved') || v.includes('dipinjam') || v.includes('aktif')) return 'bg-success-subtle text-success-emphasis border border-success-subtle';
  if (v.includes('return') || v.includes('dikembalikan') || v.includes('selesai') || v.includes('closed')) return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
  if (v.includes('reject') || v.includes('tolak') || v.includes('batal')) return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle';
  return 'bg-info-subtle text-info-emphasis border border-info-subtle';
};

export const PeminjamanPage: React.FC<{ mode?: 'list' | 'create' }> = ({ mode: initialMode = 'list' }) => {
  const { push } = useToast();
  const [curMode, setCurMode] = useState<'list' | 'create'>(initialMode);
  const mode = curMode;
  const [rows, setRows] = useState<any[]>([]);
  const [arsips, setArsipList] = useState<any[]>([]);
  const [users, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [detail, setDetail] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a, u] = await Promise.all([listPeminjaman(), listArsipDetail(), listUsers()]);
      setRows(Array.isArray(r) ? r : []);
      setArsipList(Array.isArray(a) ? a : []);
      setUserList(Array.isArray(u) ? u : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  /* ── buat permohonan baru ── */
  const [draft, setDraft] = useState<Record<string, string>>({
    arsipId: '', userId: '', keperluan: '', tanggalPinjam: '', tanggalKembaliRencana: '',
  });
  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createPeminjaman(draft.arsipId, draft.userId, draft.keperluan, draft.tanggalPinjam, draft.tanggalKembaliRencana);
    if (res && (res as any).error) { push('danger', `Gagal: ${(res as any).error}`); return; }
    push('success', 'Permohonan pinjam berhasil diajukan');
    setDraft({ arsipId: '', userId: '', keperluan: '', tanggalPinjam: '', tanggalKembaliRencana: '' });
    void load();
  };

  /* ── daftar mode ── */
  const filtered = useMemo(() => {
    const q = (draft.q || '').trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((p) => [p.nomor, p.nama, p.uraian, p.peminjam, p.keperluan].some((f) => (f || '').toString().toLowerCase().includes(q)));
    }
    const sorted = [...out].sort((x, y) => String(y.created ?? '').localeCompare(String(x.created ?? '')));
    return sorted;
  }, [rows, draft]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const pendingCount = rows.filter((p) => String(p.peminjamanStatus ?? '').toLowerCase().includes('pending')).length;
  const aktifCount = rows.filter((p) => String(p.peminjamanStatus ?? '').toLowerCase().includes('approved') || String(p.peminjamanStatus ?? '').toLowerCase().includes('dipinjam')).length;
  const selesaiCount = rows.filter((p) => String(p.peminjamanStatus ?? '').toLowerCase().includes('return') || String(p.peminjamanStatus ?? '').toLowerCase().includes('dikembalikan') || String(p.peminjamanStatus ?? '').toLowerCase().includes('selesai')).length;

  const openArsip = (p: any) => { if (p && p.nomor) setDetail(p); };

  const setStatus = async (p: any, status: string) => {
    const label = status === 'disetujui' ? 'menyetujui' : status === 'ditolak' ? 'menolak' : 'menandai dikembalikan';
    if (!window.confirm(`Yakin ${label} permohonan pinjam ${p.nama || p.nomor}?`)) return;
    try {
      await updatePeminjamanStatus(p.id, status, '');
      push('success', `Status peminjaman diperbarui: ${status.replace(/_/g, ' ')}`);
      await load();
    } catch (e) {
      push('danger', `Gagal memperbarui: ${e}`);
    }
  };

  if (mode === 'create') {
    return (
      <div className="container-fluid py-3 py-xl-4">
        <div className="arsip-hero">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <div className="hero-title"><i className="bi bi-file-earmark-arrow-up me-2"></i>Permohonan Pinjam</div>
              <div className="hero-sub">Ajukan permohonan pinjam arsip ke petugas / peminat</div>
            </div>
          </div>
        </div>
        <div className="card border-0 shadow-sm fade-up-d1" style={{ border: '1px solid var(--border) !important', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <form onSubmit={submitCreate} className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Arsip</label>
                <SearchableSelect
                  options={arsips.map((a: any) => ({ value: a.id, label: `${a.nomor || '—'} — ${a.nama}` }))}
                  value={draft.arsipId ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, arsipId: v }))}
                  placeholder="Pilih arsip…"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Peminat / Petugas</label>
                <SearchableSelect
                  options={users.map((u: any) => ({ value: u.id, label: `${u.userName}${u.displayName ? ` (${u.displayName})` : ''}` }))}
                  value={draft.userId ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, userId: v }))}
                  placeholder="Pilih petugas…"
                />
              </div>
              <div className="col-12">
                <label className="form-label">Keperluan</label>
                <textarea className="form-control" rows={3} required value={draft.keperluan} onChange={(e) => setDraft((d) => ({ ...d, keperluan: e.target.value }))} placeholder="Jelaskan keperluan pinjam…" style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Tanggal Pinjam</label>
                <input type="date" className="form-control form-control-sm" value={draft.tanggalPinjam} onChange={(e) => setDraft((d) => ({ ...d, tanggalPinjam: e.target.value }))} style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Tanggal Kembali Rencana</label>
                <input type="date" className="form-control form-control-sm" value={draft.tanggalKembaliRencana} onChange={(e) => setDraft((d) => ({ ...d, tanggalKembaliRencana: e.target.value }))} style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="col-12 d-flex gap-2">
                <button type="submit" className="btn btn-primary rounded-pill px-4 fw-700"><i className="bi bi-send "></i></button>
                <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-700" onClick={() => setCurMode('list')}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="container-fluid py-3 py-xl-4">
      <div className="pinjam-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-journal-check me-2"></i>Daftar Peminjaman</div>
            <div className="hero-sub">Permohonan pinjam dan status pengembalian arsip</div>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.75rem' }} onClick={() => setCurMode('create')}><i className="bi bi-plus-lg me-1"></i><span className="d-none d-sm-inline">Tambah</span> Permohonan</button>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon icon-blue"><i className="bi bi-journal-check"></i></div><div><div className="stat-mini-value">{nf.format(rows.length)}</div><div className="stat-mini-label">Total Peminjaman</div></div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-hourglass-split"></i></div><div><div className="stat-mini-value">{nf.format(pendingCount)}</div><div className="stat-mini-label">Pending</div></div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-check-circle"></i></div><div><div className="stat-mini-value">{nf.format(aktifCount)}</div><div className="stat-mini-label">Aktif</div></div></div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-journal-check text-primary me-2"></i>Peminjaman Arsip</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data peminjaman…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Peminjaman</p><p className="empty-desc">Tidak ada data permohonan pinjam yang sesuai</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th>Arsip</th>
                    <th style={{ width: 150 }}>Peminat</th>
                    <th style={{ width: 120 }}>Pinjam</th>
                    <th style={{ width: 130 }}>Kembali Rencana</th>
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
                      <td><span className="small fw-600"><i className="bi bi-person me-1"></i>{p.peminjam || '—'}</span></td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}><i className="bi bi-calendar3 me-1"></i>{p.tanggalPinjam || '—'}</span></td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}><i className="bi bi-calendar3 me-1"></i>{p.tanggalKembaliRencana || '—'}</span></td>
                      <td><span className={`status-badge ${pinjamBadge(p.peminjamanStatus)}`}>{statusLabel(String(p.peminjamanStatus ?? ''))}</span></td>
                      <td className="text-center"><div className="btn-crud-group">
                        <button type="button" className="btn-crud btn-crud-view" title="Detail" onClick={() => openArsip(p)}><i className="bi bi-eye"></i></button>
                        {String(p.peminjamanStatus ?? '').toLowerCase().includes('pending') && (
                          <>
                            <button type="button" className="btn-crud btn-crud-success" title="Setujui" onClick={() => void setStatus(p, 'disetujui')}><i className="bi bi-check-lg"></i></button>
                            <button type="button" className="btn-crud btn-crud-del" title="Tolak" onClick={() => void setStatus(p, 'ditolak')}><i className="bi bi-x-lg"></i></button>
                          </>
                        )}
                        {(String(p.peminjamanStatus ?? '').toLowerCase().includes('approved') || String(p.peminjamanStatus ?? '').toLowerCase().includes('dipinjam') || String(p.peminjamanStatus ?? '').toLowerCase().includes('disetujui')) && (
                          <button type="button" className="btn-crud btn-crud-primary" title="Tandai dikembalikan" onClick={() => void setStatus(p, 'dikembalikan')}><i className="bi bi-arrow-return-left"></i></button>
                        )}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-5"><div className="text-muted"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i><h6 className="fw-700">Belum Ada Peminjaman</h6><small className="text-muted">Tidak ada data permohonan pinjam</small></div></div>
              )}
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> peminjaman · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
