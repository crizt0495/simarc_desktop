/**
 * ArsipPage — replika 1:1 web/templates/arsip/index.html (referensi):
 * arsip-hero → stat-mini → panel filter → active-filter badges →
 * view toggle (Card/Tabel) → arsip-card grid & tabel premium →
 * footer paginasi. CSS scoped di arsip.css (disalin dari template).
 */
import React, { useEffect, useMemo, useState } from 'react';
import './arsip.css';
import { getMasterOptions, listArsipDetail, type Status } from '../lib/bindings';
import { useToast } from '../lib/toast';

const nf = new Intl.NumberFormat('id-ID');

const statusLabel = (s: string) => (s ? s.replace(/_/g, ' ') : '—');

export const ArsipPage: React.FC<{ status?: Status | null }> = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'card' | 'table'>('card');
  const [filterOpen, setFilterOpen] = useState(true);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { push } = useToast();
  const [ready, setReady] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([listArsipDetail(), getMasterOptions()]);
      setRows(r);
      setOpts(o);
      setError(null);
      setReady(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const rowsError = !ready ? error : null;

  /* ── Filter klien (data lokal penuh) — sama seperti query server ── */
  const filtered = useMemo(() => {
    const q = (applied.search || '').toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((a) =>
        [a.nomor, a.nama, a.uraian, a.kategori, a.unit].some((f: string) => (f || '').toLowerCase().includes(q)));
    }
    if (applied.status) out = out.filter((a) => a.status === applied.status);
    if (applied.unit_kerja_id) out = out.filter((a) => a.unitId === applied.unit_kerja_id);
    if (applied.pemberkasan_id) out = out.filter((a) => a.pemberkasanId === applied.pemberkasan_id);
    if (applied.start_date) out = out.filter((a) => (a.tanggal || '') >= applied.start_date);
    if (applied.end_date) out = out.filter((a) => (a.tanggal || '') <= applied.end_date);
    if (applied.status_berkas_digital === 'sudah_ada') out = out.filter((a) => a.berkas);
    if (applied.status_berkas_digital === 'belum_ada') out = out.filter((a) => !a.berkas);
    const has = Object.keys(applied).filter((k) => applied[k]).length > 0;
    return has ? out : out;
  }, [rows, applied]);

  const aktif = filtered.filter((a) => a.status === 'aktif' || a.status === 'diberkaskan').length;
  const inaktif = filtered.filter((a) => a.status === 'inaktif').length;
  const lainnya = filtered.length - aktif - inaktif;
  const hasFilters = Object.keys(applied).some((k) => applied[k]);

  const perPage = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    Object.entries(draft).forEach(([k, v]) => { if (v) next[k] = v; });
    setApplied(next);
    setPage(1);
  };

  const clearFilter = () => { setApplied({}); setDraft({}); setPage(1); };

  const toggleRow = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected((s) => {
      if (s.size === pageRows.length) return new Set();
      return new Set(pageRows.map((a) => a.id));
    });
  };

  const paginate = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const pageNumbers = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= totalPages; i++) arr.push(i);
    if (totalPages <= 7) return arr;
    if (curPage > 4) return totalPages - curPage <= 2 ? arr.slice(-5) : [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return arr.slice(0, 5);
  }, [totalPages, curPage]);

  /* ── Kartu & baris aksi (btn-crud) ── */
  const crudActions = (a: any) => (
    <React.Fragment>
      <button type="button" className="btn-crud btn-crud-view" title="Detail" onClick={() => push('info', `Detail ${a.nomor || a.nama}`)}><i className="bi bi-eye"></i></button>
      <button type="button" className="btn-crud btn-crud-primary" title="Berkaskan" onClick={() => push('info', 'Modul pemberkasan menyusul')}><i className="bi bi-folder-plus"></i></button>
      <button type="button" className="btn-crud btn-crud-success" title="Download" onClick={() => push('info', a.berkas ? 'Mengunduh berkas arsip…' : 'Belum ada berkas digital')}><i className="bi bi-download"></i></button>
    </React.Fragment>
  );

  return (
    <div className="container-fluid py-3 py-xl-4">
      {/* ZONE 1: HERO HEADER */}
      <div className="arsip-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-file-earmark-text me-2"></i>Daftar Arsip</div>
            <div className="hero-sub">
              <i className="bi bi-info-circle me-1"></i>Total <strong>{nf.format(filtered.length)}</strong> arsip tersimpan
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.7rem' }} onClick={() => push('info', 'Modul OCR menyusul')}>
              <i className="bi bi-camera me-1"></i>OCR
            </button>
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.7rem' }} onClick={() => push('info', 'Modul import menyusul')}>
              <i className="bi bi-file-earmark-excel me-1"></i>Import
            </button>
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => push('info', 'Modul tambah arsip menyusul')}>
              <i className="bi bi-plus-lg"></i><span className="d-none d-sm-inline ms-1">Tambah</span>
            </button>
          </div>
        </div>
      </div>

      {/* ZONE 2: STATS */}
      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-blue"><i className="bi bi-archive"></i></div><div><div className="stat-mini-value">{nf.format(filtered.length)}</div><div className="stat-mini-label">Total Arsip</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-green"><i className="bi bi-check-circle"></i></div><div><div className="stat-mini-value">{nf.format(aktif)}</div><div className="stat-mini-label">Aktif</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-pause-circle"></i></div><div><div className="stat-mini-value">{nf.format(inaktif)}</div><div className="stat-mini-label">Inaktif</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-amber"><i className="bi bi-hourglass-split"></i></div><div><div className="stat-mini-value">{nf.format(Math.max(0, lainnya))}</div><div className="stat-mini-label">Lainnya</div></div></div>
        </div>
      </div>

      {/* ZONE 3: FILTER PANEL */}
      <div className="card fade-up-d1" style={{ overflow: 'visible' }}>
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-funnel text-primary me-2"></i>Filter &amp; Pencarian</h5>
          <button className="btn btn-sm btn-outline-primary rounded-pill fw-700 px-3" type="button" onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen} style={{ fontSize: '0.7rem' }}>
            <i className={`bi ${filterOpen ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i> {filterOpen ? 'Sembunyikan' : 'Tampilkan'}
          </button>
        </div>
        {filterOpen && (
          <div className="filter-panel m-3">
            <form onSubmit={applyFilter} className="row g-3">
              <div className="col-12">
                <label className="form-label">Pencarian</label>
                <div className="search-wrap">
                  <input type="text" className="form-control" name="search" placeholder="Cari: No. Arsip, Nama, Uraian, Klasifikasi, Unit Kerja..." value={draft.search ?? ''} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} autoComplete="off" style={{ fontSize: '0.85rem' }} />
                  <i className="bi bi-search"></i>
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label">Unit Kerja</label>
                <select className="form-select form-select-sm" name="unit_kerja_id" value={draft.unit_kerja_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit_kerja_id: e.target.value }))}>
                  <option value="">Semua Unit</option>
                  {(opts.unitKerja ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select className="form-select form-select-sm" name="status" value={draft.status ?? ''} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                  <option value="">Semua</option>
                  <option value="aktif">Aktif</option>
                  <option value="inaktif">Inaktif</option>
                  <option value="siap_penyusutan">Siap Penyusutan</option>
                  <option value="musnah">Musnah</option>
                  <option value="permanen">Permanen</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Klasifikasi</label>
                <select className="form-select form-select-sm" name="kode_klasifikasi_id" value={draft.kode_klasifikasi_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, kode_klasifikasi_id: e.target.value }))}>
                  <option value="">Semua</option>
                  {(opts.kodeKlasifikasi ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Lokasi</label>
                <select className="form-select form-select-sm" name="lokasi_arsip_id" value={draft.lokasi_arsip_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, lokasi_arsip_id: e.target.value }))}>
                  <option value="">Semua</option>
                  {(opts.lokasiArsip ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Kategori Arsip</label>
                <select className="form-select form-select-sm" name="jenis_arsip_id" value={draft.jenis_arsip_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, jenis_arsip_id: e.target.value }))}>
                  <option value="">Semua</option>
                  {(opts.jenisArsip ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Tgl Mulai</label>
                <input type="date" className="form-control form-control-sm" name="start_date" value={draft.start_date ?? ''} onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))} style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Tgl Akhir</label>
                <input type="date" className="form-control form-control-sm" name="end_date" value={draft.end_date ?? ''} onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))} style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Berkas Digital</label>
                <select className="form-select form-select-sm" name="status_berkas_digital" value={draft.status_berkas_digital ?? ''} onChange={(e) => setDraft((d) => ({ ...d, status_berkas_digital: e.target.value }))}>
                  <option value="">Semua</option>
                  <option value="sudah_ada">Ada Berkas</option>
                  <option value="belum_ada">Belum Ada</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Pemberkasan</label>
                <select className="form-select form-select-sm" name="pemberkasan_id" value={draft.pemberkasan_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, pemberkasan_id: e.target.value }))}>
                  <option value="">Semua</option>
                  {(opts.pemberkasan ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Nilai Min</label>
                <input type="number" step="0.01" className="form-control form-control-sm" name="nilai_min" value={draft.nilai_min ?? ''} placeholder="0" onChange={(e) => setDraft((d) => ({ ...d, nilai_min: e.target.value }))} style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Nilai Max</label>
                <input type="number" step="0.01" className="form-control form-control-sm" name="nilai_max" value={draft.nilai_max ?? ''} placeholder="1000000" onChange={(e) => setDraft((d) => ({ ...d, nilai_max: e.target.value }))} style={{ fontSize: '0.85rem' }} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Urutkan</label>
                <select className="form-select form-select-sm" name="sort_by" value={draft.sort_by ?? ''} onChange={(e) => setDraft((d) => ({ ...d, sort_by: e.target.value }))}>
                  <option value="">Default</option>
                  <option value="nomor_arsip">No. Arsip</option>
                  <option value="nama_arsip">Nama</option>
                  <option value="tanggal_dibuat">Tanggal</option>
                  <option value="status">Status</option>
                  <option value="unit_kerja">Unit</option>
                </select>
              </div>
              <div className="col-md-1">
                <label className="form-label">Arah</label>
                <select className="form-select form-select-sm" name="sort_order" value={draft.sort_order ?? 'DESC'} onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))}>
                  <option value="ASC">↑</option>
                  <option value="DESC">↓</option>
                </select>
              </div>
              <div className="col-md-1">
                <label className="form-label">Tampil</label>
                <select className="form-select form-select-sm" name="per_page" value={draft.per_page ?? '10'} onChange={(e) => setDraft((d) => ({ ...d, per_page: e.target.value }))}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="col-md-2 d-flex align-items-end gap-2">
                <button type="submit" className="btn btn-primary btn-sm rounded-pill fw-700 flex-grow-1"><i className="bi bi-funnel me-1"></i>Terapkan</button>
                {hasFilters && <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill fw-700" onClick={clearFilter}><i className="bi bi-x-circle me-1"></i>Reset</button>}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Active Filters */}
      {hasFilters && (
        <div className="d-flex flex-wrap align-items-center gap-1 mt-3 fade-up-d2">
          <span className="text-muted small fw-700 me-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter:</span>
          {applied.search && <span className="filter-badge badge-soft-primary"><i className="bi bi-search"></i> "{applied.search}" <a href="#" className="remove" onClick={(e) => { e.preventDefault(); setApplied((s) => { const n = { ...s }; delete n.search; return n; }); }}>&times;</a></span>}
          {applied.status && <span className="filter-badge badge-soft-success"><i className="bi bi-tag"></i> {statusLabel(applied.status)} <a href="#" className="remove" onClick={(e) => { e.preventDefault(); setApplied((s) => { const n = { ...s }; delete n.status; return n; }); }}>&times;</a></span>}
          {applied.unit_kerja_id && <span className="filter-badge badge-soft-success"><i className="bi bi-building"></i> Unit <a href="#" className="remove" onClick={(e) => { e.preventDefault(); setApplied((s) => { const n = { ...s }; delete n.unit_kerja_id; return n; }); }}>&times;</a></span>}
          {applied.start_date || applied.end_date ? <span className="filter-badge badge-soft-danger"><i className="bi bi-calendar"></i> {applied.start_date || '…'} ~ {applied.end_date || '…'} <a href="#" className="remove" onClick={(e) => { e.preventDefault(); setApplied((s) => { const n = { ...s }; delete n.start_date; delete n.end_date; return n; }); }}>&times;</a></span> : null}
          {applied.status_berkas_digital && <span className="filter-badge badge-soft-primary"><i className="bi bi-file-earmark"></i> Berkas: {applied.status_berkas_digital === 'sudah_ada' ? 'Ada' : 'Belum'} <a href="#" className="remove" onClick={(e) => { e.preventDefault(); setApplied((s) => { const n = { ...s }; delete n.status_berkas_digital; return n; }); }}>&times;</a></span>}
          <a href="#" className="filter-badge" onClick={(e) => { e.preventDefault(); clearFilter(); }} style={{ background: 'var(--chip-bg)', color: 'var(--chip-text)', textDecoration: 'none' }}><i className="bi bi-x-circle"></i> Hapus Semua</a>
        </div>
      )}

      {/* BULK ACTIONS TOOLBAR */}
      {selected.size > 0 && (
        <div className="fade-up-d2" style={{ marginBottom: '1rem' }}>
          <div className="bulk-toolbar shadow-sm">
            <div className="count-text"><i className="bi bi-check-circle me-1"></i><span>{selected.size}</span> arsip dipilih</div>
            <div className="bulk-actions">
              <button type="button" className="btn btn-primary btn-sm rounded-pill fw-700 px-3" onClick={() => push('info', 'Modul berkaskan menyusul')}><i className="bi bi-folder-plus me-1"></i>Berkaskan</button>
              <button type="button" className="btn btn-success btn-sm rounded-pill fw-700 px-3" onClick={() => push('info', 'Modul pindah lokasi menyusul')}><i className="bi bi-map me-1"></i>Pindah Lokasi</button>
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill fw-700 px-3" onClick={() => setSelected(new Set())}><i className="bi bi-x-circle me-1"></i>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* TOOLS BAR: View Toggle + Export */}
      <div className="d-flex justify-content-between align-items-center mt-3 mb-1 flex-wrap gap-3 fade-up-d2">
        <div className="d-flex align-items-center gap-3">
          <div className="view-toggle-group">
            <button type="button" className={`view-toggle-btn${view === 'card' ? ' active' : ''}`} onClick={() => setView('card')}>
              <i className="bi bi-grid-3x3-gap-fill"></i> <span>Card</span>
            </button>
            <button type="button" className={`view-toggle-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>
              <i className="bi bi-table"></i> <span>Tabel</span>
            </button>
          </div>
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill fw-700 px-3" style={{ fontSize: '0.7rem' }} onClick={() => push('success', 'Tautan arsip disalin ke clipboard')}><i className="bi bi-link-45deg"></i><span className="d-none d-sm-inline ms-1">Copy URL</span></button>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" style={{ width: 'auto', fontSize: '0.75rem' }} defaultValue="excel">
            <option value="excel">Excel</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
          <button type="button" className="btn btn-sm btn-success rounded-pill fw-700 px-3" style={{ fontSize: '0.7rem' }} onClick={() => push('info', 'Modul ekspor menyusul')}><i className="bi bi-download"></i><span className="d-none d-sm-inline ms-1">Export</span></button>
        </div>
      </div>

      {/* ZONE 5: CONTENT VIEW (CARD + TABLE) */}
      <div className="card fade-up-d2">
        {view === 'card' ? (
          <div id="viewCard" className="view-container active" style={{ padding: '1rem', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: '0.35rem' }}>
            <div className="arsip-card-grid" id="arsipCardGrid">
              {pageRows.map((a, idx) => (
                <div key={a.id} className="arsip-card" data-arsip-id={a.id}>
                  <div className="arsip-card-header">
                    <div className="arsip-card-checkbox">
                      <input type="checkbox" className="form-check-input arsip-checkbox" checked={selected.has(a.id)} onChange={() => toggleRow(a.id)} data-arsip-nomor={a.nomor} />
                    </div>
                    <div className="arsip-card-title">
                      <span className="arsip-card-nomor">{a.nomor || '—'}</span>
                      <a className="arsip-card-name" href="#" onClick={(e) => { e.preventDefault(); push('info', `Detail ${a.nomor || a.nama}`); }}>{a.nama}</a>
                      <div className="arsip-card-badges">
                        <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
                        {a.berkas && <span className="status-badge" style={{ background: 'var(--neu-bg)', color: 'var(--ink-2)' }}><i className="bi bi-paperclip me-1"></i>Berkas</span>}
                      </div>
                    </div>
                  </div>
                  <div className="arsip-card-body">
                    <div className="arsip-card-field">
                      <span className="arsip-card-field-label">Unit Kerja</span>
                      <span className="arsip-card-field-value"><i className="bi bi-building"></i>{a.unit || '-'}</span>
                    </div>
                    <div className="arsip-card-field">
                      <span className="arsip-card-field-label">Tanggal</span>
                      <span className="arsip-card-field-value"><i className="bi bi-calendar3"></i>{a.tanggal || '-'}</span>
                    </div>
                    <div className="arsip-card-field">
                      <span className="arsip-card-field-label">Kategori</span>
                      <span className="arsip-card-field-value">{a.kategori || 'Umum'}</span>
                    </div>
                    <div className="arsip-card-field">
                      <span className="arsip-card-field-label">Jumlah</span>
                      <span className="arsip-card-field-value">{a.jumlah} {a.satuan}</span>
                    </div>
                    {a.nilai != null && Number(a.nilai) !== 0 && (
                      <div className="arsip-card-field" style={{ gridColumn: 'span 2' }}>
                        <span className="arsip-card-field-label">Nilai Anggaran</span>
                        <span className="arsip-card-field-value text-money">Rp {nf.format(Number(a.nilai))}</span>
                      </div>
                    )}
                  </div>
                  {a.uraian && <div className="arsip-card-uraian">{String(a.uraian).slice(0, 150)}</div>}
                  <div className="arsip-card-footer">
                    <div className="arsip-card-actions">{crudActions(a)}</div>
                    <div className="arsip-card-meta">
                      <i className="bi bi-hash"></i>{startIdx + idx + 1}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && !rowsError && filtered.length === 0 && (
                <div className="arsip-card-empty">
                  <i className="bi bi-inbox"></i>
                  <h6 className="fw-700 mb-1">Belum Ada Arsip</h6>
                  <small className="text-muted">Tidak ada data arsip yang sesuai dengan kriteria pencarian</small>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div id="viewTable" className="view-container">
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 36 }} className="text-center"><div className="form-check mb-0"><input type="checkbox" className="form-check-input" id="selectAllCheckboxTable" title="Pilih Semua" checked={pageRows.length > 0 && selected.size === pageRows.length} onChange={toggleAll} /></div></th>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th style={{ width: 140 }}>Nomor</th>
                    <th>Identitas &amp; Uraian</th>
                    <th style={{ width: 120 }} className="text-end">Nominal</th>
                    <th style={{ width: 120 }}>Unit Kerja</th>
                    <th style={{ width: 90 }}>Tanggal</th>
                    <th style={{ width: 90 }}>Kategori</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 200 }} className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((a, idx) => (
                    <tr key={a.id}>
                      <td className="text-center"><div className="form-check mb-0"><input type="checkbox" className="form-check-input arsip-checkbox-table" checked={selected.has(a.id)} onChange={() => toggleRow(a.id)} /></div></td>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{a.nomor || '—'}</span></td>
                      <td>
                        <div>
                          <a href="#" onClick={(e) => { e.preventDefault(); push('info', `Detail ${a.nomor || a.nama}`); }} className="fw-800 text-decoration-none hover-primary" style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }}>{a.nama}</a>
                          {a.uraian && <div className="text-muted mt-1" style={{ fontSize: '0.7rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(a.uraian).slice(0, 80)}</div>}
                        </div>
                      </td>
                      <td className="text-end">{a.nilai != null && Number(a.nilai) !== 0 ? <span className="fw-800 font-monospace" style={{ color: 'var(--ink-2)', fontSize: '0.78rem' }}>Rp {nf.format(Number(a.nilai))}</span> : <span className="text-muted">-</span>}</td>
                      <td><span className="small fw-600"><i className="bi bi-building text-primary me-1"></i>{a.unit || '-'}</span></td>
                      <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}><i className="bi bi-calendar3 me-1"></i>{a.tanggal || '-'}</span></td>
                      <td><span className="status-badge" style={{ background: 'var(--brand-lt)', color: 'var(--brand)' }}>{a.kategori || 'Umum'}</span></td>
                      <td><span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span></td>
                      <td className="text-center"><div className="d-flex justify-content-center gap-1">{crudActions(a)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && filtered.length === 0 && (
                <div className="text-center py-5"><div className="text-muted"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i><h6 className="fw-700">Belum Ada Arsip</h6><small className="text-muted">Tidak ada data arsip yang sesuai dengan kriteria pencarian</small></div></div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PAGINATION (di luar kartu — sama seperti referensi) */}
      <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
        <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> arsip · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong>
          {rowsError && <span className="text-danger ms-2">({rowsError})</span>}
        </small>
        {totalPages > 1 && (
          <nav><ul className="pagination pagination-sm mb-0">
            <li className={`page-item${curPage <= 1 ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); paginate(1); }} title="Pertama"><i className="bi bi-chevron-double-left"></i></a></li>
            <li className={`page-item${curPage <= 1 ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); paginate(curPage - 1); }} title="Sebelum"><i className="bi bi-chevron-left"></i></a></li>
            {pageNumbers.map((p) => (
              <li key={p} className={`page-item${p === curPage ? ' active' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); paginate(p); }}>{p}</a></li>
            ))}
            <li className={`page-item${curPage >= totalPages ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); paginate(curPage + 1); }} title="Berikut"><i className="bi bi-chevron-right"></i></a></li>
            <li className={`page-item${curPage >= totalPages ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); paginate(totalPages); }} title="Terakhir"><i className="bi bi-chevron-double-right"></i></a></li>
          </ul></nav>
        )}
      </div>
    </div>
  );
};
