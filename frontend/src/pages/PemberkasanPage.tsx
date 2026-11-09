/**
 * PemberkasanPage — modul pemberkasan arsip (CRUD berkas + isi berkas).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listPemberkasan, listArsipDetail, getMasterOptions, savePemberkasan, deletePemberkasan, assignArsipToPemberkasan } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { ArsipDetailModal } from '../components/ArsipDetailModal';
import { FormModal } from '../components/FormModal';

const nf = new Intl.NumberFormat('id-ID');
const statusLabel = (s: string) => (s ? s.replace(/_/g, ' ') : '—');
const toOpts = (arr: any[] | undefined) => (arr ?? []).map((o: any) => ({ value: String(o.id), label: String(o.name ?? o.id) }));

const STATUS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'ditutup', label: 'Ditutup' },
  { value: 'selesai', label: 'Selesai' },
];

const berkasBadge = (s: unknown): string => {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('aktif') || v.includes('open') || v.includes('buka')) return 'bg-success-subtle text-success-success-emphasis border border-success-subtle';
  if (v.includes('close') || v.includes('tutup') || v.includes('selesai') || v.includes('inactive')) return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
  if (v.includes('pending') || v.includes('review')) return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  return 'bg-info-subtle text-info-emphasis border border-info-subtle';
};

export const PemberkasanPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [arsips, setArsips] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [detail, setDetail] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSel, setAssignSel] = useState<Set<string>>(new Set());
  const [assignBusy, setAssignBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, a, o] = await Promise.all([listPemberkasan(), listArsipDetail(), getMasterOptions()]);
      setRows(Array.isArray(r) ? r : []);
      setArsips(Array.isArray(a) ? a : []);
      setOpts(o ?? {});
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => [...rows].sort((x, y) => Number(y.tahun ?? 0) - Number(x.tahun ?? 0) || String(y.namaPemberkasan ?? '').localeCompare(String(x.namaPemberkasan ?? ''))), [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;
  const totalArsip = rows.reduce((acc, r) => acc + Number(r.arsipCount ?? 0), 0);
  const openArsip = (r: any) => { if (r && r.nomor) setDetail(r); };

  const submit = async (v: Record<string, any>) => {
    setBusy(true);
    try {
      await savePemberkasan({ ...v, id: target?.id ?? '' });
      push('success', target ? 'Berkas berhasil diperbarui' : 'Berkas berhasil ditambahkan');
      setFormOpen(false);
      setTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Hapus berkas "${row.namaPemberkasan}"? Arsip di dalamnya tidak dihapus.`)) return;
    try {
      await deletePemberkasan(row.id);
      push('success', 'Berkas berhasil dihapus');
      await load();
    } catch (e) {
      push('danger', `Gagal menghapus: ${e}`);
    }
  };

  const openAssign = (row: any) => {
    setAssignTarget(row);
    setAssignSearch('');
    setAssignSel(new Set(arsips.filter((a) => a.pemberkasanId === row.id).map((a) => a.id)));
  };

  const submitAssign = async () => {
    if (!assignTarget) return;
    setAssignBusy(true);
    try {
      const ids = Array.from(assignSel);
      if (ids.length === 0) { push('warning', 'Pilih minimal satu arsip'); return; }
      await assignArsipToPemberkasan(ids, assignTarget.id);
      push('success', `${ids.length} arsip dimasukkan ke berkas ${assignTarget.namaPemberkasan}`);
      setAssignTarget(null);
      await load();
    } catch (e) {
      push('danger', `Gagal: ${e}`);
    } finally {
      setAssignBusy(false);
    }
  };

  const assignRows = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    return arsips.filter((a) => !q || [a.nomor, a.nama, a.unit, a.kategori].some((f) => String(f ?? '').toLowerCase().includes(q)));
  }, [arsips, assignSearch]);

  return (
    <>
      <div className="container-fluid py-3 py-xl-4">
        <div className="berkas-hero">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <div className="hero-title"><i className="bi bi-folder me-2"></i>Pemberkasan</div>
              <div className="hero-sub">Berkas arsip — {nf.format(totalArsip)} arsip dalam {nf.format(rows.length)} berkas</div>
            </div>
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => { setTarget(null); setFormOpen(true); }}>
              <i className="bi bi-plus-lg "></i></button>
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
                      <th style={{ width: 80 }}>Tahun</th>
                      <th style={{ width: 150 }}>Unit Kerja</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 100 }} className="text-center">Arsip</th>
                      <th style={{ width: 140 }} className="text-center">Aksi</th>
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
                        <td className="text-center"><div className="btn-crud-group">
                          <button type="button" className="btn-crud btn-crud-view" title="Detail" onClick={() => openArsip(b)}><i className="bi bi-eye "></i></button>
                          <button type="button" className="btn-crud btn-crud-primary" title="Isi berkas" onClick={() => openAssign(b)}><i className="bi bi-folder-plus "></i></button>
                          <button type="button" className="btn-crud btn-crud-edit" title="Ubah" onClick={() => { setTarget(b); setFormOpen(true); }}><i className="bi bi-pencil "></i></button>
                          <button type="button" className="btn-crud btn-crud-del" title="Hapus" onClick={() => void remove(b)}><i className="bi bi-trash"></i></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      <FormModal
        open={formOpen}
        title={target ? 'Ubah Berkas' : 'Tambah Berkas'}
        subtitle="Berkas pemberkasan arsip"
        icon="folder-plus"
        size="lg"
        fields={[
          { key: 'kode', label: 'Kode Berkas', placeholder: 'Contoh: B-2026-01' },
          { key: 'nama', label: 'Nama Berkas', required: true, placeholder: 'Contoh: Berkas Keuangan 2026' },
          { key: 'tahun', label: 'Tahun', type: 'number', min: 1900, max: 2200, placeholder: String(new Date().getFullYear()) },
          { key: 'status', label: 'Status Berkas', type: 'select', options: STATUS, placeholder: 'Aktif' },
          { key: 'tanggalMulai', label: 'Tanggal Mulai', type: 'date' },
          { key: 'tanggalTutup', label: 'Tanggal Tutup', type: 'date' },
          { key: 'unitKerjaId', label: 'Unit Kerja', type: 'select', options: toOpts(opts.unitKerja), placeholder: '— Pilih unit —' },
          { key: 'kodeKlasifikasiId', label: 'Kode Klasifikasi', type: 'select', options: toOpts(opts.kodeKlasifikasi), placeholder: '— Pilih klasifikasi —' },
        ]}
        initial={target ? {
          kode: target.kodeBerkas ?? '', nama: target.namaPemberkasan ?? '', tahun: target.tahun ?? '',
          status: target.statusBerkas ?? 'aktif', tanggalMulai: target.tanggalMulai ?? '',
          tanggalTutup: target.tanggalTutup ?? '', unitKerjaId: target.unitKerjaId ?? '',
          kodeKlasifikasiId: target.kodeKlasifikasiId ?? '',
        } : { status: 'aktif', tahun: new Date().getFullYear() }}
        busy={busy}
        submitLabel={target ? 'Simpan Perubahan' : 'Tambah Berkas'}
        onClose={() => { if (!busy) { setFormOpen(false); setTarget(null); } }}
        onSubmit={submit}
      />

      {/* Modal isi berkas */}
      {assignTarget && (
        <div className="sm sm-show sm-xl" role="dialog" aria-modal="true">
          <div className="sm-overlay sm-show" onClick={() => setAssignTarget(null)} />
          <div className="sm-dialog"><div className="sm-content">
            <div className="sm-header">
              <div className="sm-header-left">
                <div className="sm-icon sm-icon-primary"><i className="bi bi-folder-plus" /></div>
                <div className="sm-title-group">
                  <h5 className="sm-title">Isi Berkas</h5>
                  <p className="sm-subtitle">{assignTarget.namaPemberkasan} · {assignSel.size} arsip dipilih</p>
                </div>
              </div>
              <button type="button" className="sm-btn-close" onClick={() => setAssignTarget(null)}><i className="bi bi-x" /></button>
            </div>
            <div className="sm-body">
              <input type="search" className="form-control form-control-sm mb-3" placeholder="Cari arsip…" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} />
              <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
                <table className="table table-sm table-hover mb-0">
                  <thead><tr><th style={{ width: 40 }}></th><th>Nomor</th><th>Nama</th><th>Unit</th></tr></thead>
                  <tbody>
                    {assignRows.map((a) => (
                      <tr key={a.id}>
                        <td><input type="checkbox" className="form-check-input" checked={assignSel.has(a.id)} onChange={() => setAssignSel((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} /></td>
                        <td><span className="font-monospace small fw-700">{a.nomor || '—'}</span></td>
                        <td><span className="small fw-600">{a.nama}</span></td>
                        <td><span className="small text-muted">{a.unit || '—'}</span></td>
                      </tr>
                    ))}
                    {assignRows.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">Tidak ada arsip</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="sm-footer">
              <button type="button" className="sm-btn sm-btn-cancel" onClick={() => setAssignTarget(null)}><i className="bi bi-x-lg me-1" />Batal</button>
              <button type="button" className="sm-btn sm-btn-confirm" disabled={assignBusy} onClick={() => void submitAssign()}><i className="bi bi-check-lg me-1" />Simpan ke Berkas</button>
            </div>
          </div></div>
        </div>
      )}

      <ArsipDetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
};
