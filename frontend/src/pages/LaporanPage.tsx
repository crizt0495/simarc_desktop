/**
 * LaporanPage — pusat laporan SIMARC.
 * Satu komponen melayani seluruh menu laporan (arsip, digital, pemberkasan,
 * lokasi, klasifikasi, retensi, pemusnahan) plus ringkasan dashboard.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listArsipDetail, listPemberkasan, listPemusnahan, getArsipWindowStats,
  getArsipGrowth, exportArsipCSV, getMasterOptions,
} from '../lib/bindings';
import { useToast } from '../lib/toast';
import { type PageKey } from '../components/AppSidebar';
import SearchableSelect from '../components/SearchableSelect';

const nf = new Intl.NumberFormat('id-ID');

type Variant = 'overview' | 'arsip' | 'digital' | 'pemberkasan' | 'lokasi' | 'klasifikasi' | 'retensi' | 'pemusnahan';

const META: Record<Variant, { title: string; sub: string; icon: string }> = {
  overview: { title: 'Laporan Ringkasan', sub: 'Ringkasan kondisi arsip dan penyimpanan', icon: 'clipboard-data' },
  arsip: { title: 'Laporan Data Arsip', sub: 'Rekapitulasi seluruh arsip yang terdaftar', icon: 'file-earmark-text' },
  digital: { title: 'Laporan Arsip Digital', sub: 'Arsip yang telah memiliki berkas digital', icon: 'cloud-check' },
  pemberkasan: { title: 'Laporan Pemberkasan', sub: 'Rekapitulasi berkas dan isi pemberkasan', icon: 'folder' },
  lokasi: { title: 'Laporan Lokasi Arsip', sub: 'Sebaran penyimpanan arsip per lokasi', icon: 'geo-alt' },
  klasifikasi: { title: 'Laporan Klasifikasi', sub: 'Sebaran arsip berdasarkan klasifikasi', icon: 'tags' },
  retensi: { title: 'Laporan Retensi', sub: 'Arsip berdasarkan tanggal retensi berakhir', icon: 'calendar-check' },
  pemusnahan: { title: 'Laporan Pemusnahan', sub: 'Riwayat pengajuan dan pelaksanaan pemusnahan', icon: 'trash3' },
};

const variantOf = (page?: PageKey): Variant => {
  switch (page) {
    case 'laporan-arsip': return 'arsip';
    case 'laporan-digital': return 'digital';
    case 'laporan-pemberkasan': return 'pemberkasan';
    case 'laporan-lokasi': return 'lokasi';
    case 'laporan-klasifikasi': return 'klasifikasi';
    case 'laporan-retensi': return 'retensi';
    case 'laporan-pemusnahan': return 'pemusnahan';
    default: return 'overview';
  }
};

const statusLabel = (s: unknown) => (s ? String(s).replace(/_/g, ' ') : '—');

export const LaporanPage: React.FC<{ page?: PageKey }> = ({ page }) => {
  const variant = variantOf(page);
  const meta = META[variant];
  const { push } = useToast();
  const [arsip, setArsip] = useState<any[]>([]);
  const [berkas, setBerkas] = useState<any[]>([]);
  const [musnah, setMusnah] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [growth, setGrowth] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fUnit, setFUnit] = useState('');
  const [fKategori, setFKategori] = useState('');
  const [fLokasi, setFLokasi] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const perPage = 12;
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, m, s, g, o] = await Promise.all([
        listArsipDetail(), listPemberkasan(), listPemusnahan(),
        getArsipWindowStats(), getArsipGrowth(), getMasterOptions(),
      ]);
      setArsip(Array.isArray(a) ? a : []);
      setBerkas(Array.isArray(b) ? b : []);
      setMusnah(Array.isArray(m) ? m : []);
      setStats(s ?? {});
      setGrowth(Array.isArray(g) ? g : []);
      setOpts(o ?? {});
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPageNum(1); }, [variant, q, fStatus, fUnit, fKategori, fLokasi, start, end]);

  const arsipFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return arsip.filter((a) => {
      if (needle && ![a.nomor, a.nama, a.uraian, a.unit, a.kategori, a.lokasi].some((f) => String(f ?? '').toLowerCase().includes(needle))) return false;
      if (fStatus && String(a.status ?? '') !== fStatus) return false;
      if (fUnit && String(a.unitId ?? '') !== fUnit) return false;
      if (fKategori && String(a.jenisArsipId ?? '') !== fKategori) return false;
      if (fLokasi && String(a.lokasiArsipId ?? '') !== fLokasi) return false;
      if (start && String(a.tanggal ?? '') < start) return false;
      if (end && String(a.tanggal ?? '') > end) return false;
      if (variant === 'digital' && !a.berkas) return false;
      if (variant === 'retensi' && !a.tanggalRetensiBerakhir) return false;
      return true;
    });
  }, [arsip, q, fStatus, fUnit, fKategori, fLokasi, start, end, variant]);

  const berkasFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return berkas.filter((b) => !needle || [b.kodeBerkas, b.namaPemberkasan, b.unitKerja].some((f) => String(f ?? '').toLowerCase().includes(needle)));
  }, [berkas, q]);

  const musnahFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return musnah.filter((m) => !needle || [m.nomor, m.nama, m.namaKegiatan, m.userPengaju].some((f) => String(f ?? '').toLowerCase().includes(needle)));
  }, [musnah, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; total: number; aktif: number; inaktif: number; digital: number }>();
    arsipFiltered.forEach((a) => {
      const key = variant === 'lokasi' ? (a.lokasi || 'Belum ditentukan') : (a.kategori || 'Umum');
      const cur = map.get(key) ?? { key, total: 0, aktif: 0, inaktif: 0, digital: 0 };
      cur.total += 1;
      if (String(a.status ?? '') === 'aktif') cur.aktif += 1;
      if (String(a.status ?? '') === 'inaktif') cur.inaktif += 1;
      if (a.berkas) cur.digital += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((x, y) => y.total - x.total);
  }, [arsipFiltered, variant]);

  const tableRows = useMemo<any[]>(() => {
    if (variant === 'pemberkasan') return berkasFiltered;
    if (variant === 'pemusnahan') return musnahFiltered;
    if (variant === 'lokasi' || variant === 'klasifikasi') return grouped;
    return arsipFiltered;
  }, [variant, berkasFiltered, musnahFiltered, grouped, arsipFiltered]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / perPage));
  const curPage = Math.min(pageNum, totalPages);
  const pageRows = tableRows.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const summary = useMemo(() => {
    if (variant === 'pemberkasan') {
      const totalArsip = berkas.reduce((acc, b) => acc + Number(b.arsipCount ?? 0), 0);
      return [
        { label: 'Total Berkas', value: berkas.length, icon: 'folder', cls: 'icon-blue' },
        { label: 'Arsip Terberkaskan', value: totalArsip, icon: 'archive', cls: 'icon-green' },
        { label: 'Berkas Aktif', value: berkas.filter((b) => String(b.statusBerkas ?? '').toLowerCase().includes('aktif')).length, icon: 'check-circle', cls: 'icon-green' },
        { label: 'Berkas Ditutup', value: berkas.filter((b) => String(b.statusBerkas ?? '').toLowerCase().includes('tutup')).length, icon: 'lock', cls: 'icon-amber' },
      ];
    }
    if (variant === 'pemusnahan') {
      return [
        { label: 'Total Pengajuan', value: musnah.length, icon: 'trash3', cls: 'icon-blue' },
        { label: 'Menunggu', value: musnah.filter((m) => String(m.pemusnahanStatus ?? m.status ?? '').toLowerCase().includes('diajukan')).length, icon: 'hourglass-split', cls: 'icon-amber' },
        { label: 'Disetujui', value: musnah.filter((m) => String(m.pemusnahanStatus ?? m.status ?? '').toLowerCase().includes('disetujui')).length, icon: 'check-circle', cls: 'icon-green' },
        { label: 'Selesai', value: musnah.filter((m) => String(m.pemusnahanStatus ?? m.status ?? '').toLowerCase().includes('selesai')).length, icon: 'check2-all', cls: 'icon-green' },
      ];
    }
    if (variant === 'lokasi' || variant === 'klasifikasi') {
      return [
        { label: variant === 'lokasi' ? 'Total Lokasi' : 'Total Klasifikasi', value: grouped.length, icon: variant === 'lokasi' ? 'geo-alt' : 'tags', cls: 'icon-blue' },
        { label: 'Total Arsip', value: arsipFiltered.length, icon: 'archive', cls: 'icon-green' },
        { label: 'Arsip Aktif', value: arsipFiltered.filter((a) => String(a.status ?? '') === 'aktif').length, icon: 'check-circle', cls: 'icon-green' },
        { label: 'Arsip Digital', value: arsipFiltered.filter((a) => a.berkas).length, icon: 'cloud-check', cls: 'icon-amber' },
      ];
    }
    return [
      { label: 'Total Arsip', value: Number(stats.total ?? arsip.length), icon: 'archive', cls: 'icon-blue' },
      { label: 'Arsip Digital', value: Number(stats.digital ?? arsip.filter((a) => a.berkas).length), icon: 'cloud-check', cls: 'icon-green' },
      { label: 'Aktif', value: Number(stats.aktif ?? arsip.filter((a) => String(a.status ?? '') === 'aktif').length), icon: 'check-circle', cls: 'icon-green' },
      { label: 'Inaktif', value: Number(stats.inaktif ?? arsip.filter((a) => String(a.status ?? '') === 'inaktif').length), icon: 'pause-circle', cls: 'icon-amber' },
    ];
  }, [variant, berkas, musnah, grouped, arsipFiltered, stats, arsip]);

  const doExport = async () => {
    setBusy(true);
    try {
      const res = await exportArsipCSV();
      if (res?.cancelled) push('info', 'Ekspor dibatalkan');
      else push('success', `Berhasil mengekspor ${nf.format(Number(res?.rows ?? 0))} arsip ke CSV`);
    } catch (e) {
      push('danger', `Gagal mengekspor: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const showArsipFilters = !['pemberkasan', 'pemusnahan'].includes(variant);
  const maxGrowth = Math.max(1, ...growth.map((g) => Number(g.total ?? 0)));

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="laporan-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className={`bi bi-${meta.icon} me-2`}></i>{meta.title}</div>
            <div className="hero-sub">{meta.sub}</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.72rem' }} onClick={() => void load()} disabled={loading}>
              <i className="bi bi-arrow-repeat "></i></button>
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => void doExport()} disabled={busy}>
              <i className="bi bi-download "></i></button>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        {summary.map((s) => (
          <div className="col-6 col-md-3" key={s.label}>
            <div className="stat-mini">
              <div className={`stat-mini-icon ${s.cls}`}><i className={`bi bi-${s.icon}`}></i></div>
              <div><div className="stat-mini-value">{nf.format(s.value)}</div><div className="stat-mini-label">{s.label}</div></div>
            </div>
          </div>
        ))}
      </div>

      {variant === 'overview' && (
        <div className="card mb-3 fade-up-d1">
          <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
            <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-graph-up text-primary me-2"></i>Pertumbuhan Arsip per Bulan</h5>
          </div>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            {growth.length === 0 ? (
              <div className="empty-state py-3"><i className="bi bi-bar-chart empty-icon"></i><p className="empty-title">Belum Ada Data</p><p className="empty-desc">Data pertumbuhan arsip belum tersedia</p></div>
            ) : (
              <div className="d-flex align-items-end gap-2" style={{ height: 180 }}>
                {growth.slice(-12).map((g, i) => {
                  const h = Math.max(6, Math.round((Number(g.total ?? 0) / maxGrowth) * 150));
                  return (
                    <div className="flex-fill d-flex flex-column align-items-center gap-1" key={i} title={`${g.month ?? g.label ?? ''}: ${g.total ?? 0}`}>
                      <div className="fw-800" style={{ fontSize: '0.62rem', color: 'var(--ink-3)' }}>{nf.format(Number(g.total ?? 0))}</div>
                      <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg, var(--brand), var(--brand-2, #6366f1))', borderRadius: 6, opacity: 0.85 }} />
                      <div className="text-muted" style={{ fontSize: '0.6rem' }}>{String(g.month ?? g.label ?? '').slice(-2)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-table text-primary me-2"></i>Data Laporan</h5>
          <span className="badge badge-soft-primary">{nf.format(tableRows.length)} baris</span>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <label className="form-label">Pencarian</label>
              <div className="search-wrap">
                <input type="search" className="form-control form-control-sm" placeholder="Cari data laporan…" value={q} onChange={(e) => setQ(e.target.value)} />
                <i className="bi bi-search"></i>
              </div>
            </div>
            {showArsipFilters && (
              <>
                <div className="col-md-2">
                  <label className="form-label">Status</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Semua' },
                      { value: 'aktif', label: 'Aktif' },
                      { value: 'inaktif', label: 'Inaktif' },
                      { value: 'siap_penyusutan', label: 'Siap Penyusutan' },
                      { value: 'musnah', label: 'Musnah' },
                      { value: 'permanen', label: 'Permanen' },
                    ]}
                    value={fStatus}
                    onChange={(v) => setFStatus(v)}
                    placeholder="Semua"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Unit Kerja</label>
                  <SearchableSelect
                    options={(opts.unitKerja ?? []).map((o: any) => ({ value: o.id, label: o.name }))}
                    value={fUnit}
                    onChange={(v) => setFUnit(v)}
                    placeholder="Semua"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Kategori</label>
                  <SearchableSelect
                    options={(opts.jenisArsip ?? []).map((o: any) => ({ value: o.id, label: o.name }))}
                    value={fKategori}
                    onChange={(v) => setFKategori(v)}
                    placeholder="Semua"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Lokasi</label>
                  <SearchableSelect
                    options={(opts.lokasiArsip ?? []).map((o: any) => ({ value: o.id, label: o.name }))}
                    value={fLokasi}
                    onChange={(v) => setFLokasi(v)}
                    placeholder="Semua"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Dari Tanggal</label>
                  <input type="date" className="form-control form-control-sm" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Sampai Tanggal</label>
                  <input type="date" className="form-control form-control-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </>
            )}
          </div>

          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data laporan…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : tableRows.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Data</p><p className="empty-desc">Tidak ada data laporan yang sesuai filter</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  {variant === 'pemberkasan' ? (
                    <tr>
                      <th style={{ width: 44 }} className="text-center">#</th>
                      <th style={{ width: 130 }}>Kode</th>
                      <th>Nama Berkas</th>
                      <th style={{ width: 80 }}>Tahun</th>
                      <th style={{ width: 180 }}>Unit Kerja</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 100 }} className="text-center">Arsip</th>
                    </tr>
                  ) : variant === 'pemusnahan' ? (
                    <tr>
                      <th style={{ width: 44 }} className="text-center">#</th>
                      <th style={{ width: 140 }}>Nomor</th>
                      <th>Nama Arsip</th>
                      <th style={{ width: 180 }}>Kegiatan</th>
                      <th style={{ width: 130 }}>Pengaju</th>
                      <th style={{ width: 110 }}>Tanggal</th>
                      <th style={{ width: 110 }}>Status</th>
                    </tr>
                  ) : variant === 'lokasi' || variant === 'klasifikasi' ? (
                    <tr>
                      <th style={{ width: 44 }} className="text-center">#</th>
                      <th>{variant === 'lokasi' ? 'Lokasi' : 'Klasifikasi / Kategori'}</th>
                      <th style={{ width: 130 }} className="text-center">Total Arsip</th>
                      <th style={{ width: 110 }} className="text-center">Aktif</th>
                      <th style={{ width: 110 }} className="text-center">Inaktif</th>
                      <th style={{ width: 110 }} className="text-center">Digital</th>
                      <th style={{ width: 120 }} className="text-center">Porsi</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={{ width: 44 }} className="text-center">#</th>
                      <th style={{ width: 140 }}>Nomor</th>
                      <th>Nama Arsip</th>
                      <th style={{ width: 150 }}>Unit Kerja</th>
                      <th style={{ width: 110 }}>Tanggal</th>
                      <th style={{ width: 110 }}>Kategori</th>
                      <th style={{ width: 130 }}>Lokasi</th>
                      {variant === 'retensi' && <th style={{ width: 130 }}>Retensi Berakhir</th>}
                      <th style={{ width: 100 }}>Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {variant === 'pemberkasan' && pageRows.map((b, i) => (
                    <tr key={b.id ?? i}>
                      <td className="text-center text-muted fw-700 small">{startIdx + i + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{b.kodeBerkas || '—'}</span></td>
                      <td className="fw-600">{b.namaPemberkasan || '—'}</td>
                      <td><span className="small fw-600">{b.tahun || '—'}</span></td>
                      <td><span className="small fw-600">{b.unitKerja || '—'}</span></td>
                      <td><span className={`status-badge status-${String(b.statusBerkas ?? '').toLowerCase()}`}>{statusLabel(b.statusBerkas)}</span></td>
                      <td className="text-center"><span className="badge badge-soft-primary">{nf.format(Number(b.arsipCount ?? 0))}</span></td>
                    </tr>
                  ))}
                  {variant === 'pemusnahan' && pageRows.map((m, i) => (
                    <tr key={m.id ?? i}>
                      <td className="text-center text-muted fw-700 small">{startIdx + i + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{m.nomor || '—'}</span></td>
                      <td className="fw-600">{m.nama || '—'}</td>
                      <td><span className="small fw-600">{m.namaKegiatan || '—'}</span></td>
                      <td><span className="small fw-600">{m.userPengaju || '—'}</span></td>
                      <td><span className="small fw-600">{m.tanggalPengajuan || m.created || '—'}</span></td>
                      <td><span className={`status-badge status-${String(m.pemusnahanStatus ?? m.status ?? '').toLowerCase()}`}>{statusLabel(m.pemusnahanStatus ?? m.status)}</span></td>
                    </tr>
                  ))}
                  {(variant === 'lokasi' || variant === 'klasifikasi') && pageRows.map((g, i) => {
                    const pct = arsipFiltered.length ? Math.round((g.total / arsipFiltered.length) * 100) : 0;
                    return (
                      <tr key={g.key ?? i}>
                        <td className="text-center text-muted fw-700 small">{startIdx + i + 1}</td>
                        <td className="fw-700">{g.key}</td>
                        <td className="text-center"><span className="badge badge-soft-primary">{nf.format(g.total)}</span></td>
                        <td className="text-center"><span className="small fw-600">{nf.format(g.aktif)}</span></td>
                        <td className="text-center"><span className="small fw-600">{nf.format(g.inaktif)}</span></td>
                        <td className="text-center"><span className="small fw-600">{nf.format(g.digital)}</span></td>
                        <td className="text-center">
                          <div className="progress" style={{ height: 6 }}>
                            <div className="progress-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="small text-muted fw-600">{pct}%</span>
                        </td>
                      </tr>
                    );
                  })}
                  {!['pemberkasan', 'pemusnahan', 'lokasi', 'klasifikasi'].includes(variant) && pageRows.map((a, i) => (
                    <tr key={a.id ?? i}>
                      <td className="text-center text-muted fw-700 small">{startIdx + i + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{a.nomor || '—'}</span></td>
                      <td>
                        <div className="fw-700" style={{ fontSize: '0.85rem' }}>{a.nama || '—'}</div>
                        {a.uraian && <div className="text-muted" style={{ fontSize: '0.7rem' }}>{String(a.uraian).slice(0, 90)}</div>}
                      </td>
                      <td><span className="small fw-600"><i className="bi bi-building text-primary me-1"></i>{a.unit || '—'}</span></td>
                      <td><span className="small fw-600">{a.tanggal || '—'}</span></td>
                      <td><span className="status-badge" style={{ background: 'var(--brand-lt)', color: 'var(--brand)' }}>{a.kategori || 'Umum'}</span></td>
                      <td><span className="small fw-600">{a.lokasi || '—'}</span></td>
                      {variant === 'retensi' && <td><span className="small fw-600">{a.tanggalRetensiBerakhir || '—'}</span></td>}
                      <td><span className={`status-badge status-${String(a.status ?? '').toLowerCase()}`}>{statusLabel(a.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(tableRows.length)}</strong> baris · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
          {totalPages > 1 && (
            <nav><ul className="pagination pagination-sm mb-0">
              <li className={`page-item${curPage <= 1 ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPageNum(Math.max(1, curPage - 1)); }}><i className="bi bi-chevron-left"></i></a></li>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pn) => (
                <li key={pn} className={`page-item${pn === curPage ? ' active' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPageNum(pn); }}>{pn}</a></li>
              ))}
              <li className={`page-item${curPage >= totalPages ? ' disabled' : ''}`}><a className="page-link" href="#" onClick={(e) => { e.preventDefault(); setPageNum(Math.min(totalPages, curPage + 1)); }}><i className="bi bi-chevron-right"></i></a></li>
            </ul></nav>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaporanPage;
