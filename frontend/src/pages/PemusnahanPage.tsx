/**
 * PemusnahanPage — modul pemusnahan arsip.
 *
 * Dua bagian utama:
 * 1. "Arsip Akan Dimusnahkan" — daftar OTOMATIS dari relasi
 *    arsip.kode_klasifikasi_id → kode_klasifikasi.penyusutan_arsip = "musnah".
 *    Arsip berkategori musnah langsung muncul tanpa harus diubah statusnya
 *    manual, kecuali yang sudah dimusnahkan / sudah diajukan.
 * 2. "Antrean Pemusnahan" — daftar pengajuan pemusnahan (status & approval).
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

/** Status pengajuan yang masih berjalan / sudah selesai → arsip tidak perlu diajukan lagi. */
const ACTIVE_DISPOSAL_STATUS = new Set([
  'diajukan', 'pending', 'menunggu', 'disetujui', 'approved', 'proses',
  'selesai', 'done', 'dimusnahkan',
]);

/** Kategori penyusutan dari kode klasifikasi yang berarti "dimusnahkan". */
const isKategoriMusnah = (v: unknown) => String(v ?? '').toLowerCase().includes('musnah');

const todayStr = () => new Date().toISOString().slice(0, 10);

export const PemusnahanPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Antrean pemusnahan */
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [draftQ, setDraftQ] = useState('');

  /* Kandidat otomatis (arsip kategori musnah) */
  const [arsips, setArsips] = useState<any[]>([]);
  const [candQ, setCandQ] = useState('');
  const [candPage, setCandPage] = useState(1);

  const [detail, setDetail] = useState<any | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [kegiatan, setKegiatan] = useState('Pemusnahan Arsip');
  const [alasan, setAlasan] = useState('Masa retensi telah berakhir dan kategori arsip musnah');
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

  /* Arsip yang sudah ada di antrean aktif/selesai — agar tidak dobel diajukan. */
  const queuedIds = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((p) => {
      const st = String(p.status ?? '').toLowerCase();
      const arsipId = String(p.arsipId ?? '');
      if (arsipId && ACTIVE_DISPOSAL_STATUS.has(st)) set.add(arsipId);
    });
    return set;
  }, [rows]);

  /* ── DAFTAR OTOMATIS: arsip dengan kode klasifikasi penyusutan "musnah" ── */
  const candidates = useMemo(() => {
    return arsips
      .filter((a) => {
        if (!isKategoriMusnah(a.penyusutanArsip)) return false;
        if (String(a.status ?? '').toLowerCase() === 'musnah') return false; // sudah dimusnahkan
        if (queuedIds.has(String(a.id))) return false; // sudah diajukan/selesai
        return true;
      })
      .sort((x, y) => String(x.tanggalRetensiBerakhir ?? '').localeCompare(String(y.tanggalRetensiBerakhir ?? '')));
  }, [arsips, queuedIds]);

  const candFiltered = useMemo(() => {
    const q = candQ.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((a) =>
      [a.nomor, a.nama, a.uraian, a.unit, a.kodeKlasifikasiTxt, a.kodeKlasifikasiNama]
        .some((f) => String(f ?? '').toLowerCase().includes(q)),
    );
  }, [candidates, candQ]);

  const candTotalPages = Math.max(1, Math.ceil(candFiltered.length / perPage));
  const candCurPage = Math.min(candPage, candTotalPages);
  const candRows = candFiltered.slice((candCurPage - 1) * perPage, candCurPage * perPage);

  /* ── ANTREAN PEMUSNAHAN ── */
  const filtered = useMemo(() => {
    const q = draftQ.trim().toLowerCase();
    const out = q
      ? rows.filter((p) => [p.nomor, p.nama, p.uraian, p.status, p.namaKegiatan, p.alasanPengajuan, p.kodeKlasifikasi]
          .some((f) => String(f ?? '').toLowerCase().includes(q)))
      : rows;
    return [...out].sort((x, y) => String(y.created ?? '').localeCompare(String(x.created ?? '')));
  }, [rows, draftQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const menunggu = rows.filter((p) => {
    const s = String(p.status ?? '').toLowerCase();
    return s.includes('diajukan') || s.includes('pending');
  }).length;

  const openArsip = (p: any) => { if (p && p.nomor) setDetail(p); };

  const toggleSel = (id: string) => {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const pilihSemuaHasil = () => {
    const ids = candFiltered.map((a) => String(a.id));
    setSel((s) => {
      const allSelected = ids.length > 0 && ids.every((id) => s.has(id));
      const n = new Set(s);
      if (allSelected) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  };

  const openCreate = (keepSelection = false) => {
    if (!keepSelection) setSel(new Set());
    setCreateOpen(true);
  };

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
      setAlasan('Masa retensi telah berakhir dan kategori arsip musnah');
      await load();
    } catch (e) {
      push('danger', `Gagal membuat pengajuan: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const tglHariIni = todayStr();

  return (
    <>
    <div className="container-fluid py-3 py-xl-4">
      <div className="pemusnahan-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-trash3 me-2"></i>Pemusnahan Arsip</div>
            <div className="hero-sub">Arsip kategori musnah terdeteksi otomatis dari kode klasifikasi — {nf.format(menunggu)} permohonan menunggu</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => openCreate(false)}>
            <i className="bi bi-plus-lg me-1"></i>Buat Pengajuan
          </button>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-12 col-md-4">
          <div className="stat-mini">
            <div className="stat-mini-icon" style={{ background: 'var(--danger-light, #fee2e2)', color: 'var(--danger, #dc2626)' }}><i className="bi bi-archive"></i></div>
            <div><div className="stat-mini-value">{nf.format(candidates.length)}</div><div className="stat-mini-label">Arsip Kategori Musnah</div></div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="stat-mini">
            <div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-trash3"></i></div>
            <div><div className="stat-mini-value">{nf.format(rows.length)}</div><div className="stat-mini-label">Total Pemusnahan</div></div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="stat-mini">
            <div className="stat-mini-icon" style={{ background: 'var(--warning-light, #fef3c7)', color: 'var(--warning, #b45309)' }}><i className="bi bi-hourglass-split"></i></div>
            <div><div className="stat-mini-value">{nf.format(menunggu)}</div><div className="stat-mini-label">Menunggu Persetujuan</div></div>
          </div>
        </div>
      </div>

      {/* ═══ ARSIP AKAN DIMUSNAHKAN (OTOMATIS) ═══ */}
      <div className="card fade-up-d2 mb-3">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ padding: '0.85rem 1.25rem' }}>
          <div>
            <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-exclamation-triangle text-danger me-2"></i>Arsip Akan Dimusnahkan</h5>
            <small className="text-muted">Otomatis dari kode klasifikasi dengan penyusutan <strong>Musnah</strong></small>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle rounded-pill px-3 py-2">
              {nf.format(candidates.length)} arsip
            </span>
          </div>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Cari nomor / nama / kode klasifikasi / unit…"
                value={candQ}
                onChange={(e) => { setCandQ(e.target.value); setCandPage(1); }}
              />
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <small className="text-muted fw-600">{sel.size} dipilih · {nf.format(candFiltered.length)} hasil</small>
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill fw-700" style={{ fontSize: '0.7rem' }} onClick={pilihSemuaHasil} disabled={candFiltered.length === 0}>
                <i className="bi bi-check2-square me-1"></i>{candFiltered.length > 0 && candFiltered.every((a) => sel.has(String(a.id))) ? 'Batalkan Semua' : 'Pilih Semua'}
              </button>
              <button type="button" className="btn btn-sm btn-danger rounded-pill fw-800" style={{ fontSize: '0.7rem' }} onClick={() => openCreate(true)} disabled={sel.size === 0}>
                <i className="bi bi-send me-1"></i>Ajukan Pemusnahan
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data arsip…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : candFiltered.length === 0 ? (
            <div className="empty-state py-4">
              <i className="bi bi-check2-circle empty-icon text-success"></i>
              <p className="empty-title">Tidak Ada Arsip Kategori Musnah</p>
              <p className="empty-desc">Semua arsip dengan kode klasifikasi penyusutan “musnah” sudah diajukan atau dimusnahkan.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-premium datatable">
                  <thead className="sticky-top">
                    <tr>
                      <th style={{ width: 40 }} className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label="Pilih semua arsip pada halaman ini"
                          checked={candRows.length > 0 && candRows.every((a) => sel.has(String(a.id)))}
                          onChange={() => {
                            const ids = candRows.map((a) => String(a.id));
                            setSel((s) => {
                              const all = ids.every((id) => s.has(id));
                              const n = new Set(s);
                              ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
                              return n;
                            });
                          }}
                        />
                      </th>
                      <th>Arsip</th>
                      <th style={{ width: 210 }}>Kode Klasifikasi</th>
                      <th style={{ width: 120 }}>Status</th>
                      <th style={{ width: 140 }}>Retensi Berakhir</th>
                      <th style={{ width: 70 }} className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candRows.map((a, idx) => {
                      const id = String(a.id);
                      const expired = a.tanggalRetensiBerakhir && a.tanggalRetensiBerakhir <= tglHariIni;
                      return (
                        <tr key={id}>
                          <td className="text-center">
                            <input type="checkbox" className="form-check-input" checked={sel.has(id)} onChange={() => toggleSel(id)} aria-label={`Pilih ${a.nama}`} />
                          </td>
                          <td>
                            <div>
                              <span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{a.nomor || '—'}</span>
                              <a href="#" className="fw-800 text-decoration-none d-block" style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }} onClick={(e) => { e.preventDefault(); openArsip(a); }}>{a.nama || '—'}</a>
                              <div className="text-muted" style={{ fontSize: '0.7rem' }}><i className="bi bi-building me-1"></i>{a.unit || '—'}</div>
                            </div>
                          </td>
                          <td>
                            <span className="small fw-700 font-monospace" style={{ color: 'var(--ink-2)' }}>{a.kodeKlasifikasiTxt || '—'}</span>
                            {a.kodeKlasifikasiNama && <div className="text-muted" style={{ fontSize: '0.7rem' }}>{a.kodeKlasifikasiNama}</div>}
                          </td>
                          <td><span className={`status-badge status-${String(a.status ?? '').toLowerCase()}`}>{statusLabel(String(a.status ?? ''))}</span></td>
                          <td>
                            <span className="small fw-600">{a.tanggalRetensiBerakhir || '—'}</span>
                            {expired && <div><span className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle" style={{ fontSize: '0.62rem' }}>Retensi habis</span></div>}
                          </td>
                          <td className="text-center">
                            <div className="btn-crud-group">
                              <button type="button" className="btn-crud btn-crud-view" title="Detail arsip" onClick={() => openArsip(a)}><i className="bi bi-eye"></i></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
                <small className="text-muted fw-600">
                  Menampilkan <strong>{candFiltered.length === 0 ? 0 : (candCurPage - 1) * perPage + 1}</strong>–<strong>{Math.min(candCurPage * perPage, candFiltered.length)}</strong> dari <strong>{nf.format(candFiltered.length)}</strong> arsip
                </small>
                {candTotalPages > 1 && (
                  <nav><ul className="pagination pagination-sm mb-0">
                    <li className={`page-item${candCurPage <= 1 ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setCandPage(Math.max(1, candCurPage - 1)); }} title="Sebelum"><i className="bi bi-chevron-left"></i></a></li>
                    {Array.from({ length: candTotalPages }, (_, i) => i + 1)
                      .filter((pn) => pn === 1 || pn === candTotalPages || Math.abs(pn - candCurPage) <= 1)
                      .map((pn, i, arr) => (
                        <React.Fragment key={pn}>
                          {i > 0 && pn - arr[i - 1] > 1 && <li className="page-item disabled"><span className="page-link">…</span></li>}
                          <li className={`page-item${pn === candCurPage ? ' active' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setCandPage(pn); }}>{pn}</a></li>
                        </React.Fragment>
                      ))}
                    <li className={`page-item${candCurPage >= candTotalPages ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setCandPage(Math.min(candTotalPages, candCurPage + 1)); }} title="Berikut"><i className="bi bi-chevron-right"></i></a></li>
                  </ul></nav>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ ANTREAN PEMUSNAHAN ═══ */}
      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-trash3 text-danger me-2"></i>Antrean Pemusnahan</h5>
          <div className="input-group" style={{ maxWidth: 320 }}>
            <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Cari pengajuan…"
              value={draftQ}
              onChange={(e) => { setDraftQ(e.target.value); setPage(1); }}
            />
          </div>
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

    {/* Modal pengajuan pemusnahan */}
    {createOpen && (
      <div className="sm sm-show sm-xl" role="dialog" aria-modal="true">
        <div className="sm-overlay sm-show" onClick={() => setCreateOpen(false)} />
        <div className="sm-dialog"><div className="sm-content">
          <div className="sm-header">
            <div className="sm-header-left">
              <div className="sm-icon sm-icon-primary"><i className="bi bi-trash3" /></div>
              <div className="sm-title-group">
                <h5 className="sm-title">Buat Pengajuan Pemusnahan</h5>
                <p className="sm-subtitle">Arsip terpilih dari kategori kode klasifikasi “musnah”</p>
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
                <input type="search" className="form-control form-control-sm" value={candQ} onChange={(e) => setCandQ(e.target.value)} placeholder="Nomor / nama / kode klasifikasi / unit…" />
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <small className="text-muted fw-600">{sel.size} arsip dipilih · {nf.format(candFiltered.length)} arsip memenuhi kriteria</small>
              <button type="button" className="btn btn-sm btn-outline-primary rounded-pill fw-700" style={{ fontSize: '0.7rem' }} onClick={pilihSemuaHasil}>
                {candFiltered.length > 0 && candFiltered.every((a) => sel.has(String(a.id))) ? 'Batalkan Semua' : 'Pilih Semua'}
              </button>
            </div>
            <div style={{ maxHeight: '38vh', overflowY: 'auto' }}>
              <table className="table table-sm table-hover mb-0">
                <thead><tr><th style={{ width: 40 }}></th><th>Nomor</th><th>Nama</th><th>Kode Klasifikasi</th><th>Status</th></tr></thead>
                <tbody>
                  {candFiltered.slice(0, 300).map((a) => (
                    <tr key={a.id}>
                      <td><input type="checkbox" className="form-check-input" checked={sel.has(String(a.id))} onChange={() => toggleSel(String(a.id))} /></td>
                      <td><span className="small font-monospace fw-700">{a.nomor || '—'}</span></td>
                      <td><span className="small fw-600">{a.nama}</span></td>
                      <td><span className="small fw-600">{a.kodeKlasifikasiTxt || '—'}</span></td>
                      <td><span className={`status-badge status-${String(a.status ?? '').toLowerCase()}`}>{statusLabel(String(a.status ?? ''))}</span></td>
                    </tr>
                  ))}
                  {candFiltered.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">Tidak ada arsip kategori musnah yang belum diajukan.</td></tr>}
                </tbody>
              </table>
              {candFiltered.length > 300 && (
                <div className="text-center text-muted py-2" style={{ fontSize: '0.72rem' }}>Menampilkan 300 dari {nf.format(candFiltered.length)} — gunakan pencarian untuk mempersempit.</div>
              )}
            </div>
          </div>
          <div className="sm-footer">
            <button type="button" className="sm-btn sm-btn-cancel" onClick={() => setCreateOpen(false)}><i className="bi bi-x-lg me-1" />Batal</button>
            <button type="button" className="sm-btn sm-btn-confirm" disabled={busy || sel.size === 0} onClick={() => void submitCreate()}><i className="bi bi-send me-1" />Ajukan Pemusnahan ({sel.size})</button>
          </div>
        </div></div>
      </div>
    )}
    <ArsipDetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
};

export default PemusnahanPage;
