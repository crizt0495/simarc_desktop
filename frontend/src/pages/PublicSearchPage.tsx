/**
 * PublicSearchPage — landing page untuk viewer (tanpa login) yang mencari arsip.
 *
 * - Tidak membutuhkan login & AppShell (sidebar/topbar).
 * - Full filter: status, pemberkasan, kode klasifikasi, jenis arsip,
 *   unit kerja, tanggal range, keyword (nomor/nama/uraian/unit).
 * - Hasil ditampilkan dalam tabel kaya + pagination + action cart.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getMasterOptions, listArsipDetail } from '../lib/bindings';
import PublicHeader from '../components/PublicHeader';

export interface PublicSearchPageProps {
  onLogin?: () => void;
  sessionName?: string | null;
}

export const PublicSearchPage: React.FC<PublicSearchPageProps> = ({ onLogin, sessionName }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── draft filter (user input) ── */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const perPage = 15;

  /* ── load data (bawa semua arsip) ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [r, o] = await Promise.all([listArsipDetail(), getMasterOptions()]);
        setRows(r);
        setOpts(o);
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── filter klien (dataset data penuh, filter lokal) ──
     Semua kunci draft dipakai langsung (camelCase) — kunci identik dengan
     field map dari backend: nomor/nama/uraian/status/unitId/…
     Filter teks diterapkan per-field DAN keyword serba bisa. */
  const normStatus = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, '_');

  const filtered = useMemo(() => {
    const q = (applied.q || '').trim().toLowerCase();
    let out = rows;

    if (q) {
      out = out.filter((a) =>
        [a.nomor, a.nama, a.uraian, a.unit, a.kodeKlasifikasiTxt].some(
          (f: string) => (f || '').toLowerCase().includes(q)));
    }
    if (applied.nomor) out = out.filter((a) => (a.nomor || '').toLowerCase().includes(applied.nomor.toLowerCase()));
    if (applied.nama) out = out.filter((a) => (a.nama || '').toLowerCase().includes(applied.nama.toLowerCase()));
    if (applied.uraian) out = out.filter((a) => (a.uraian || '').toLowerCase().includes(applied.uraian.toLowerCase()));
    // Bandingkan status tanpa memandang besar-kecil huruf/underscore.
    if (applied.status) out = out.filter((a) => normStatus(a.status) === normStatus(applied.status));
    if (applied.pemberkasanId) out = out.filter((a) => String(a.pemberkasanId || '') === applied.pemberkasanId);
    if (applied.kodeKlasifikasiId) out = out.filter((a) => String(a.kodeKlasifikasiId || '') === applied.kodeKlasifikasiId);
    if (applied.jenisArsipId) out = out.filter((a) => String(a.jenisArsipId || '') === applied.jenisArsipId);
    if (applied.unitKerjaId) out = out.filter((a) => String(a.unitId || '') === applied.unitKerjaId);
    if (applied.startDate) out = out.filter((a) => String(a.tanggal || '') >= applied.startDate);
    if (applied.endDate) out = out.filter((a) => String(a.tanggal || '') <= applied.endDate);
    return out;
  }, [rows, applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const activeFilterCount = Object.values(applied).filter((v) => v && v !== '').length;

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    // Kunci draft = kunci field backend (camelCase) — salin langsung.
    const next: Record<string, string> = {};
    Object.entries(draft).forEach(([k, v]) => { if (v) next[k] = v; });
    setApplied(next);
    setPage(1);
  };

  const clearFilter = () => {
    setDraft({});
    setApplied({});
    setPage(1);
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="card">
        {/* HEADER LANDING — judul kiri, tombol Login pojok kanan atas */}
        <PublicHeader
          onLogin={() => onLogin?.()}
          sessionName={sessionName ?? null}
          onEnterDashboard={onLogin}
        />

        {/* SEARCH FORM */}
        <form onSubmit={applyFilter} className="card-body pt-3 pb-3">
          <div className="row g-2">
            <div className="col-md-3">
              <input type="text" className="form-control form-control-sm" placeholder="Nomor arsip"
                     value={draft.nomor ?? ''} onChange={(e) => setDraft({ ...draft, nomor: e.target.value })} />
            </div>
            <div className="col-md-2">
              <input type="text" className="form-control form-control-sm" placeholder="Nama arsip"
                     value={draft.nama ?? ''} onChange={(e) => setDraft({ ...draft, nama: e.target.value })} />
            </div>
            <div className="col-md-3">
              <input type="text" className="form-control form-control-sm" placeholder="Uraian / deskripsi"
                     value={draft.uraian ?? ''} onChange={(e) => setDraft({ ...draft, uraian: e.target.value })} />
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" onChange={(e) => setDraft({ ...draft, unitKerjaId: e.target.value })}>
                <option value="">Unit Kerja</option>
                {opts.unitKerja?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end gap-1">
              <button type="submit" className="btn btn-primary rounded-pill px-3">
                <i className="bi bi-search me-1"></i>Cari
              </button>
            </div>
          </div>

          {/* FULL FILTER PANEL */}
          <div className="row g-2 mt-2">
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={draft.status ?? ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="">Status</option>
                {['aktif','diberkaskan','inaktif','siap_penyusutan','musnah'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={draft.pemberkasanId ?? ''} onChange={(e) => setDraft({ ...draft, pemberkasanId: e.target.value })}>
                <option value="">Pemberkasan</option>
                {opts.pemberkasan?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={draft.kodeKlasifikasiId ?? ''} onChange={(e) => setDraft({ ...draft, kodeKlasifikasiId: e.target.value })}>
                <option value="">Klasifikasi</option>
                {opts.kodeKlasifikasi?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={draft.jenisArsipId ?? ''} onChange={(e) => setDraft({ ...draft, jenisArsipId: e.target.value })}>
                <option value="">Jenis Arsip</option>
                {opts.jenisArsip?.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>

            <div className="col-md-6 d-flex align-items-end gap-1">
              <div className="d-flex flex-column">
                <label className="small text-muted mb-1">Tanggal Awal</label>
                <input type="date" className="form-control form-control-sm"
                       value={draft.startDate ?? ''} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
              </div>
              <div className="d-flex flex-column">
                <label className="small text-muted mb-1">Tanggal Akhir</label>
                <input type="date" className="form-control form-control-sm"
                       value={draft.endDate ?? ''} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <div className="badge bg-danger">Terapkan filter: {activeFilterCount}</div>
              <button type="button" className="btn btn-outline-secondary rounded-pill px-3 text-decoration-none" onClick={clearFilter}>
                <i className="bi bi-trash me-1"></i>Hapus filter
              </button>
            </div>
          )}
        </form>

        {/* RESULTS */}
        {loading ? (
          <div className="card-body text-center py-5"><div className="spinner-border text-primary" role="status" aria-label="Loading..."></div></div>
        ) : error ? (
          <div className="card-body text-center py-5">
            <h6 className="text-danger mb-2">Gagal memuat data</h6>
            <p className="text-muted small">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox fs-3 d-block mb-2"></i>
            <p className="text-muted">Tidak ditemukan hasil sesuai kriteria</p>
          </div>
        ) : (
          <>
            <div className="card-body px-0 pb-0">
              <table className="table table-hover table-sm align-middle mb-0">
                <thead className="table-light border-bottom sticky-top">
                  <tr>
                    <th className="text-center w-100 text-start">#</th>
                    <th className="w-25 text-start">Nomor</th>
                    <th className="text-start">Nama</th>
                    <th className="text-start">Unit Kerja</th>
                    <th className="text-start">Kategori</th>
                    <th className="text-start">Jenis</th>
                    <th className="text-center w-20">Tanggal</th>
                    <th className="text-center w-20">Berkas</th>
                    <th className="text-center w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((ar, i) => (
                    <tr key={ar.id}>
                      <td className="text-center text-muted small">{String(startIdx + i + 1).padStart(3, '0')}</td>
                      <td className="fw-semibold small">{ar.nomor || '-'}</td>
                      <td className="small">{(ar.nama || '—').slice(0, 48)}</td>
                      <td className="small">{ar.unit || '-'}</td>
                      <td className="small">{ar.kategori || '-'}</td>
                      <td className="small">{ar.jenisName || '-'}</td>
                      <td className="text-center small text-muted">{ar.tanggal || '—'}</td>
                      <td className="text-center">
                        {ar.berkas ? <i className="bi bi-file-earmark text-success" title="Berkas tersedia"></i> : <i className="bi bi-file-earmark-question-fill text-warning" title="Tidak ada berkas"></i>}
                      </td>
                      <td className="text-center">
                        <span className="badge bg-info text-dark">{ar.status ? ar.status.replace(/_/g, ' ') : '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-2 py-2">
              <span className="text-muted small">
                {filtered.length} hasil dari {rows.length} total
                {applied.q ? <><span className="ms-2">— keyword “{applied.q}”</span></> : null}
              </span>
              <nav>
                <ul className="pagination pagination-sm justify-content-center mb-0">
                  <li className="page-item disabled"><a className="page-link" href="#">«</a></li>
                  <li className={`page-item${curPage === 1 ? ' active' : ''}`}>
                    <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(curPage - 1); }}>«</a>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(1, curPage - 2), curPage + 2)
                    .map((p) => (
                      <li key={p} className={`page-item${p === curPage ? ' active' : ''}`}>
                        <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(p); }}>{p}</a>
                      </li>
                    ))}
                  <li className={`page-item${curPage === totalPages ? ' active' : ''}`}>
                    <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(curPage + 1); }}>»</a>
                  </li>
                </ul>
              </nav>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublicSearchPage;
