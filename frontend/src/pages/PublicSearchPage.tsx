/**
 * PublicSearchPage — landing page untuk viewer (tanpa login) yang mencari arsip.
 *
 * - Tidak membutuhkan login & AppShell (sidebar/topbar).
 * - Full filter: status, pemberkasan, kode klasifikasi, jenis arsip,
 *   unit kerja, tanggal range, keyword (nomor/nama/uraian/unit).
 * - Hasil ditampilkan dalam tabel kaya + pagination + action cart.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getMasterOptions, listArsipDetail, quitApp, getUpdateInfo, downloadUpdate, installUpdate } from '../lib/bindings';
import PublicHeader from '../components/PublicHeader';
import { ArsipDetailModal } from '../components/ArsipDetailModal';
import SearchableSelect from '../components/SearchableSelect';

/* ── warna badge status arsip ── */
const statusBadge = (s: unknown): string => {
  const v = String(s ?? '').toLowerCase();
  if (v === 'aktif' || v === 'diberkaskan') return 'bg-success-subtle text-success-emphasis border border-success-subtle';
  if (v === 'inaktif') return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
  if (v === 'siap_penyusutan') return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  if (v === 'musnah') return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle';
  return 'bg-info-subtle text-info-emphasis border border-info-subtle';
};

export interface PublicSearchPageProps {
  onLogin?: () => void;
  sessionName?: string | null;
}

export const PublicSearchPage: React.FC<PublicSearchPageProps> = ({ onLogin, sessionName }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [update, setUpdate] = useState<{ hasUpdate: boolean; current: string; latest: string; url: string } | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  /* ── draft filter (user input) ── */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const perPage = 15;

  /* ── load data (bawa semua arsip) dengan retry sampai DB backend siap ── */
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 12;

    const load = async () => {
      attempt += 1;
      setLoading(true);
      try {
        const [r, o] = await Promise.all([listArsipDetail(), getMasterOptions()]);
        if (cancelled) return;
        setRows(Array.isArray(r) ? r : []);
        setOpts(o || {});
        setError(null);

        // Jika DB belum siap, r kosong — jadwalkan retry (kecuali percobaan terakhir).
        if ((!Array.isArray(r) || r.length === 0) && attempt < maxAttempts) {
          setTimeout(load, Math.min(300 * attempt, 1500));
          return;
        }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(String(e));
        if (attempt < maxAttempts) {
          setTimeout(load, Math.min(300 * attempt, 1500));
        } else {
          setLoading(false);
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  /* ── pemeriksaan pembaruan dari GitHub Releases (auto-update) ── */
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const u = await getUpdateInfo();
        if (cancelled) return;
        if (u?.hasUpdate) {
          setUpdate({ hasUpdate: true, current: String(u.current ?? ''), latest: String(u.latest ?? ''), url: String(u.downloadURL ?? '') });
        } else {
          setUpdate(null);
        }
      } catch { /* abaikan kegagalan cek pembaruan */ }
    };
    void check();
    return () => { cancelled = true; };
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
        [a.nomor, a.nama, a.uraian, a.unit, a.kodeKlasifikasiTxt, a.lokasi, a.jenisName, a.status].some(
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
    if (applied.lokasiArsipId) out = out.filter((a) => String(a.lokasiArsipId || '') === applied.lokasiArsipId);
    if (applied.unitKerjaId) out = out.filter((a) => String(a.unitId || '') === applied.unitKerjaId);
    if (applied.startDate) out = out.filter((a) => String(a.tanggal || '') >= applied.startDate);
    if (applied.endDate) out = out.filter((a) => String(a.tanggal || '') <= applied.endDate);
    return out;
  }, [rows, applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);

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

  /* ── tombol keluar: tutup aplikasi desktop ── */
  const doExit = async () => {
    if (!window.confirm('Keluar dari aplikasi SIMARC?')) return;
    try {
      await quitApp();
    } catch {
      window.close();
    }
  };

  /* ── pembaruan: unduh & instal paket .deb terbaru ── */
  const doUpdate = async () => {
    if (!update?.url) return;
    setUpdateBusy(true);
    setUpdateMsg(null);
    try {
      const path = await downloadUpdate(update.url);
      if (!path) throw new Error('Gagal mengunduh paket pembaruan');
      await installUpdate(path);
      setUpdate(null);
      setUpdateMsg(`Pembaruan SIMARC v${update.latest} berhasil diinstal. Silakan restart aplikasi untuk menerapkan.`);
    } catch (e) {
      setUpdateMsg(`Gagal memperbarui: ${String(e)}`);
      setUpdate(null);
    } finally {
      setUpdateBusy(false);
    }
  };

  return (
    <>
    <div className="container-fluid py-3 py-xl-4">
      <div className="card">
        {/* HEADER LANDING — judul kiri, tombol Login pojok kanan atas */}
        <PublicHeader
          onLogin={() => onLogin?.()}
          sessionName={sessionName ?? null}
          onEnterDashboard={onLogin}
          onExit={() => void doExit()}
        />

        {/* JUDUL HALAMAN */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h2 className="h3 fw-800 mb-0">
              <i className="bi bi-archive-fill text-primary me-2"></i>Daftar Arsip Record Center
            </h2>
            <div className="text-muted small mt-1">Pencarian arsip keseluruhan pada Sistem Informasi Manajemen Arsip Record Center</div>
          </div>
          <span className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle rounded-pill px-3 py-2">
            <i className="bi bi-search me-1"></i>Pencarian arsip keseluruhan
          </span>
        </div>

        {/* SEARCH FORM */}
        <form onSubmit={applyFilter} className="card-body pt-3 pb-3">
          {/* PENGUDIAN PENCARIAN ARSIP KESELURUHAN */}
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label small fw-700 mb-1">Pencarian Arsip</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                <input type="text" className="form-control" placeholder="Cari arsip keseluruhan: nomor, nama, uraian, lokasi, unit, status…"
                       value={draft.q ?? ''} onChange={(e) => setDraft({ ...draft, q: e.target.value })} autoComplete="off" />
              </div>
            </div>
            <div className="col-md-2 d-flex align-items-end gap-1">
              <button type="submit" className="btn btn-primary rounded-pill px-3">
                <i className="bi bi-search "></i></button>
            </div>
          </div>

          {/* FILTER LOKASI & TANGGAL */}
          <div className="row g-2 mt-2">
            <div className="col-md-3">
              <label className="form-label small fw-700 mb-1">Lokasi Arsip</label>
              <SearchableSelect
                options={(opts.lokasiArsip ?? []).map((o: any) => ({ value: o.id, label: o.name }))}
                value={draft.lokasiArsipId ?? ''}
                onChange={(v) => setDraft({ ...draft, lokasiArsipId: v })}
                placeholder="Semua Lokasi"
              />
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
                <i className="bi bi-trash "></i></button>
            </div>
          )}
        </form>

        {/* PEMBARUAN APLIKASI */}
        {update?.hasUpdate && (
          <div className="card mb-3">
            <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-2 py-3">
              <div>
                <div className="fw-800"><i className="bi bi-arrow-up-circle me-1"></i>Pembaruan tersedia</div>
                <div className="text-muted small">SIMARC v{update.latest} tersedia (versi saat ini v{update.current}). Klik tombol di bawah untuk memperbarui.</div>
                {updateMsg && <div className="small text-danger mt-1">{updateMsg}</div>}
              </div>
              <button type="button" className="btn btn-success rounded-pill px-3" onClick={() => void doUpdate()} disabled={updateBusy}>
                <i className={`bi ${updateBusy ? 'bi-arrow-repeat' : 'bi-arrow-up-circle'} me-1`}></i>{updateBusy ? 'Mengunduh…' : 'Perbarui Sekarang'}
              </button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {loading ? (
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status" aria-label="Loading..."></div>
            <div className="text-muted small mt-2">Memuat daftar arsip…</div>
          </div>
        ) : error ? (
          <div className="card-body text-center py-5">
            <i className="bi bi-exclamation-triangle-fill text-danger fs-3 d-block mb-2"></i>
            <h6 className="text-danger mb-1">Gagal memuat data</h6>
            <p className="text-muted small mb-0">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox fs-2 d-block mb-2 text-muted"></i>
            <p className="text-muted mb-0">Tidak ditemukan hasil sesuai kriteria</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover table-striped table-sm align-middle mb-0" style={{ tableLayout: 'fixed', minWidth: 1100, width: '100%' }}>
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: 140 }}>Nomor</th>
                    <th>Nama Arsip</th>
                    <th style={{ width: 180 }}>Uraian</th>
                    <th style={{ width: 140 }}>Unit Kerja</th>
                    <th style={{ width: 150 }}>Lokasi Arsip</th>
                    <th style={{ width: 110 }}>Jenis</th>
                    <th className="text-center" style={{ width: 92 }}>Tanggal</th>
                    <th className="text-center" style={{ width: 60 }}>Berkas</th>
                    <th className="text-center" style={{ width: 100 }}>Status</th>
                    <th className="text-center" style={{ width: 84 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((ar) => (
                    <tr key={ar.id}>
                      <td className="fw-semibold small" style={{ wordBreak: 'break-word' }}>{ar.nomor || '—'}</td>
                      <td className="small" style={{ wordBreak: 'break-word' }}>{ar.nama || '—'}</td>
                      <td className="small" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{ar.uraian || '—'}</td>
                      <td className="small" style={{ wordBreak: 'break-word' }}>{ar.unit || '—'}</td>
                      <td className="small" style={{ wordBreak: 'break-word' }}>{ar.lokasi || '—'}</td>
                      <td className="small" style={{ wordBreak: 'break-word' }}>{ar.jenisName || '—'}</td>
                      <td className="text-center small text-muted">{ar.tanggal || '—'}</td>
                      <td className="text-center">
                        {ar.berkas
                          ? <i className="bi bi-file-earmark-check text-success" title="Berkas tersedia"></i>
                          : <i className="bi bi-file-earmark-x text-warning" title="Tidak ada berkas"></i>}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${statusBadge(ar.status)}`}>{ar.status ? ar.status.replace(/_/g, ' ') : '—'}</span>
                      </td>
                      <td className="text-center">
                        <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-2" onClick={() => setDetail(ar)} title="Lihat detail">
                          <i className="bi bi-eye "></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-2 py-2 border-top">
              <span className="text-muted small">
                Menampilkan <strong>{pageRows.length}</strong> dari <strong>{filtered.length}</strong> hasil (total {rows.length})
                {activeFilterCount > 0 && <span className="ms-2 badge bg-danger">{activeFilterCount} filter aktif</span>}
              </span>
              <nav aria-label="Navigasi halaman">
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item${curPage === 1 ? ' disabled' : ''}`}>
                    <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); if (curPage > 1) setPage(curPage - 1); }}>‹</a>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, curPage - 3), Math.min(totalPages, curPage + 2))
                    .map((p) => (
                      <li key={p} className={`page-item${p === curPage ? ' active' : ''}`}>
                        <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPage(p); }}>{p}</a>
                      </li>
                    ))}
                  <li className={`page-item${curPage === totalPages ? ' disabled' : ''}`}>
                    <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); if (curPage < totalPages) setPage(curPage + 1); }}>›</a>
                  </li>
                </ul>
              </nav>
            </div>
          </>
        )}
      </div>
    </div>
    <ArsipDetailModal detail={detail} onClose={() => setDetail(null)} />
  </>
  );
};

export default PublicSearchPage;
