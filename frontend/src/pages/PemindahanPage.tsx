/**
 * PemindahanPage — pilih arsip, tentukan lokasi tujuan, proses pemindahan batch.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listArsipDetail, getMasterOptions, moveArsip } from '../lib/bindings';
import { useToast } from '../lib/toast';
import SearchableSelect from '../components/SearchableSelect';

const nf = new Intl.NumberFormat('id-ID');

export const PemindahanPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lokasiId, setLokasiId] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 12;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([listArsipDetail(), getMasterOptions()]);
      setRows(Array.isArray(r) ? r : []);
      setOpts(o ?? {});
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((a) => [a.nomor, a.nama, a.unit, a.lokasi].some((f) => String(f ?? '').toLowerCase().includes(needle)));
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const submit = async () => {
    if (!lokasiId) { push('warning', 'Pilih lokasi tujuan terlebih dahulu'); return; }
    if (selected.size === 0) { push('warning', 'Pilih minimal satu arsip'); return; }
    setBusy(true);
    try {
      const res = await moveArsip(Array.from(selected), lokasiId);
      push('success', `${res?.moved ?? selected.size} arsip dipindahkan ke ${res?.lokasi ?? 'lokasi tujuan'}`);
      setSelected(new Set());
      await load();
    } catch (e) {
      push('danger', `Gagal memindahkan: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="pindah-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-map me-2"></i>Pemindahan Arsip</div>
            <div className="hero-sub">Pilih arsip, tentukan lokasi tujuan, dan proses pemindahan secara batch</div>
          </div>
        </div>
      </div>

      <div className="card mb-3 fade-up-d1">
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label">Cari Arsip</label>
              <div className="search-wrap">
                <input type="search" className="form-control form-control-sm" placeholder="Nomor / nama / unit / lokasi…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
                <i className="bi bi-search"></i>
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label">Lokasi Tujuan</label>
              <SearchableSelect
                options={(opts.lokasiArsip ?? []).map((o: any) => ({ value: o.id, label: o.name }))}
                value={lokasiId}
                onChange={(v) => setLokasiId(v)}
                placeholder="— Pilih lokasi tujuan —"
              />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="button" className="btn btn-primary btn-sm rounded-pill fw-700 flex-grow-1" disabled={busy || selected.size === 0 || !lokasiId} onClick={() => void submit()}>
                <i className="bi bi-arrow-right-circle "></i></button>
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill fw-700" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>Reset</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-map text-primary me-2"></i>Daftar Arsip</h5>
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill fw-700" style={{ fontSize: '0.7rem' }} onClick={() => setSelected(new Set(pageRows.map((a) => a.id)))}>
            <i className="bi bi-check2-square "></i></button>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data arsip…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Arsip</p><p className="empty-desc">Tidak ada arsip yang sesuai</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 40 }} className="text-center"><input type="checkbox" className="form-check-input" checked={pageRows.length > 0 && pageRows.every((a) => selected.has(a.id))} onChange={() => {
                      const all = pageRows.every((a) => selected.has(a.id));
                      setSelected((s) => { const n = new Set(s); pageRows.forEach((a) => { if (all) n.delete(a.id); else n.add(a.id); }); return n; });
                    }} /></th>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th style={{ width: 140 }}>Nomor</th>
                    <th>Nama Arsip</th>
                    <th style={{ width: 150 }}>Unit Kerja</th>
                    <th style={{ width: 180 }}>Lokasi Saat Ini</th>
                    <th style={{ width: 110 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((a, idx) => (
                    <tr key={a.id}>
                      <td className="text-center"><input type="checkbox" className="form-check-input" checked={selected.has(a.id)} onChange={() => toggle(a.id)} /></td>
                      <td className="text-center text-muted fw-700 small">{(curPage - 1) * perPage + idx + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{a.nomor || '—'}</span></td>
                      <td><span className="fw-600" style={{ fontSize: '0.85rem' }}>{a.nama}</span></td>
                      <td><span className="small fw-600">{a.unit || '—'}</span></td>
                      <td><span className="small fw-600"><i className="bi bi-geo-alt text-primary me-1"></i>{a.lokasi || '—'}</span></td>
                      <td><span className={`status-badge status-${String(a.status ?? '').toLowerCase()}`}>{String(a.status ?? '').replace(/_/g, ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> arsip · <strong>{selected.size}</strong> dipilih · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
