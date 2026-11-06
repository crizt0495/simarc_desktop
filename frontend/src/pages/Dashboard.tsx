/**
 * Dashboard — replika 1:1 web/templates/dashboard/index.html (referensi):
 * page-header, baris 5 KPI (stat-card + chip + progress), baris 4 KPI,
 * kartu chart prediksi (Chart.js, opsi identik) + Inventaris Box RC,
 * lalu tabel Aktivitas Terbaru + empty state.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getDashboardExtras, getDashboardStats, listArsipDetail, type Status } from '../lib/bindings';
import { SimarcModal, SmModal } from '../lib/modal';

export const Dashboard: React.FC<{ status: Status | null; userName: string }> = ({ status, userName }) => {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [extras, setExtras] = useState<Record<string, any> | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = async (showBusy: boolean) => {
    if (showBusy) setBusy(true);
    try {
      const [s, ex, a] = await Promise.all([getDashboardStats(), getDashboardExtras(), listArsipDetail()]);
      if (!s || (s as any).error) throw new Error(String(s?.error ?? 'database belum siap'));
      setStats(s);
      setExtras(ex);
      setRows(a);
      setReady(true);
    } catch {
      /* status lama tetap ditampilkan */
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(true); }, [status?.db_ok]);

  const pct = (part: number) => {
    const total = Number(stats?.total ?? 0);
    if (!total) return 0;
    return Math.round((part / total) * 100);
  };

  const digital = extras?.digitalFile;

  /* ── Chart identik dengan drawForecast() referensi ── */
  const drawForecast = () => {
    const canvas = canvasRef.current;
    if (!canvas || !(window as any).Chart || !extras?.forecast) return;
    const css = getComputedStyle(document.documentElement);
    const brand = css.getPropertyValue('--brand').trim();
    const brandLt = css.getPropertyValue('--brand-lt').trim();
    const ink3 = css.getPropertyValue('--ink-3').trim();
    const border = css.getPropertyValue('--border').trim();
    const existing = (window as any).Chart.getChart(canvas);
    if (existing) existing.destroy();
    new (window as any).Chart(canvas, {
      type: 'line',
      data: {
        labels: (extras.forecast as any[]).map((m) => m.month),
        datasets: [{
          label: 'Prediksi',
          data: (extras.forecast as any[]).map((m) => m.predictedCount),
          borderColor: brand || '#2563EB',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          backgroundColor: brandLt || '#EFF4FF',
          pointBackgroundColor: '#fff',
          pointBorderColor: brand || '#2563EB',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: border }, ticks: { color: ink3, font: { size: 12 } } },
          x: { grid: { display: false }, ticks: { color: ink3, font: { size: 12 } } },
        },
      },
    });
  };

  useEffect(() => {
    const t = setTimeout(drawForecast, 50);
    const onTheme = () => setTimeout(drawForecast, 50);
    window.addEventListener('themeChanged', onTheme as EventListener);
    return () => {
      clearTimeout(t);
      window.removeEventListener('themeChanged', onTheme as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(extras)]);

  const refreshDashboard = async () => {
    await load(false);
    drawForecast();
  };

  const boxStats = extras?.boxStats;

  const statCard1 = useMemo(() => ([
    {
      cls: 'stat-accent-blue', iconCls: 'icon-blue', icon: 'bi-archive', chip: 'Semua Data',
      value: stats?.total ?? '—', label: 'Total Arsip',
      foot: <React.Fragment><i className="bi bi-box"></i> Seluruh arsip</React.Fragment>,
    },
    {
      cls: 'stat-accent-indigo', iconCls: 'icon-indigo', icon: 'bi-box-seam', chip: 'Item Fisik',
      value: stats?.total_items ?? '—', label: 'Total Item Fisik',
      foot: <React.Fragment><i className="bi bi-collection"></i> {stats?.total ?? 0} arsip</React.Fragment>,
    },
  ]), [stats]);

  if (!ready || !stats) {
    return (
      <div className="container-fluid py-3 py-xl-4">
        <div className="page-header dashboard-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle d-none d-md-block">Selamat datang, <strong>{userName}</strong> — ringkasan status kearsipan organisasi</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body d-flex align-items-center justify-content-center" style={{ minHeight: 180 }}>
            <span className="spinner" role="status"></span>
            <span className="ms-2 text-muted">Memuat ringkasan…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle d-none d-md-block">Selamat datang, <strong>{userName}</strong> — ringkasan status kearsipan organisasi</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-soft-refresh" id="btnRefresh" onClick={refreshDashboard} disabled={busy}>
            {busy
              ? <React.Fragment><span className="spinner"></span> Memperbarui...</React.Fragment>
              : <React.Fragment><i className="bi bi-arrow-clockwise"></i><span className="d-none d-sm-inline"> Perbarui Data</span></React.Fragment>}
          </button>
        </div>
      </div>

      {/* KPI Stats Row 1 (5 cards) */}
      <div className="kpi-grid kpi-grid-5 mb-4">
        {statCard1.map((c) => (
          <div key={c.label} className={`stat-card dash-stat cursor-pointer ${c.cls}`}>
            <div className="stat-card-top">
              <div className={`stat-card-icon ${c.iconCls}`}><i className={`bi ${c.icon}`}></i></div>
              <span className="stat-card-chip">{c.chip}</span>
            </div>
            <div className="stat-card-value">{c.value}</div>
            <div className="stat-card-label">{c.label}</div>
            <div className="stat-card-foot">{c.foot}</div>
          </div>
        ))}
        <div className="stat-card dash-stat cursor-pointer stat-accent-green">
          <div className="stat-card-top">
            <div className="stat-card-icon icon-green"><i className="bi bi-check-circle"></i></div>
            <span className="stat-card-chip stat-chip-pct">{pct(stats.aktif)}% dari total</span>
          </div>
          <div className="stat-card-value">{stats.aktif}</div>
          <div className="stat-card-label">Arsip Aktif</div>
          <div className="stat-card-progress"><div className="progress-track"><div className="progress-fill progress-fill-green" style={{ width: pct(stats.aktif) + '%' }}></div></div></div>
        </div>
        <div className="stat-card dash-stat cursor-pointer stat-accent-purple">
          <div className="stat-card-top">
            <div className="stat-card-icon icon-purple"><i className="bi bi-pause-circle"></i></div>
            <span className="stat-card-chip stat-chip-pct">{pct(stats.inaktif)}% dari total</span>
          </div>
          <div className="stat-card-value">{stats.inaktif}</div>
          <div className="stat-card-label">Arsip Inaktif</div>
          <div className="stat-card-progress"><div className="progress-track"><div className="progress-fill progress-fill-purple" style={{ width: pct(stats.inaktif) + '%' }}></div></div></div>
        </div>
        <div className="stat-card dash-stat cursor-pointer stat-accent-amber">
          <div className="stat-card-top">
            <div className="stat-card-icon icon-amber"><i className="bi bi-exclamation-triangle"></i></div>
            {Number(stats.siap_penyusutan ?? 0) !== 0
              ? <span className="stat-card-chip stat-chip-danger">Perlu Review</span>
              : <span className="stat-card-chip stat-chip-success">Aman</span>}
          </div>
          <div className="stat-card-value">{stats.siap_penyusutan ?? 0}</div>
          <div className="stat-card-label">Siap Musnah</div>
          <div className="stat-card-foot"><i className="bi bi-trash"></i> Menunggu penyusutan</div>
        </div>
      </div>

      {/* KPI Stats Row 2 (4 cards) */}
      <div className="kpi-grid kpi-grid-4 mb-4">
        <div className="stat-card dash-stat stat-accent-blue">
          <div className="stat-card-top">
            <div className="stat-card-icon icon-blue"><i className="bi bi-file-text"></i></div>
            <span className="stat-card-chip">SPJ</span>
          </div>
          <div className="stat-card-value">{stats.spj}</div>
          <div className="stat-card-label">Arsip SPJ</div>
          <div className="stat-card-foot"><i className="bi bi-receipt"></i> Pertanggungjawaban</div>
        </div>
        <div className="stat-card dash-stat stat-accent-purple">
          <div className="stat-card-top">
            <div className="stat-card-icon icon-purple"><i className="bi bi-files"></i></div>
            <span className="stat-card-chip">Non-SPJ</span>
          </div>
          <div className="stat-card-value">{stats.non_spj}</div>
          <div className="stat-card-label">Arsip Non-SPJ</div>
          <div className="stat-card-foot"><i className="bi bi-collection"></i> Dokumen lain</div>
        </div>
        <div className="stat-card dash-stat stat-accent-green">
          <div className="stat-card-top">
            <div className="stat-card-icon icon-green"><i className="bi bi-cloud-check"></i></div>
            <span className="stat-card-chip stat-chip-pct">{Math.round(Number(digital?.percent ?? 0))}% dari total</span>
          </div>
          <div className="stat-card-value">{digital?.with ?? 0}</div>
          <div className="stat-card-label">Sudah Digital</div>
          <div className="stat-card-progress"><div className="progress-track"><div className="progress-fill progress-fill-green" style={{ width: Math.round(Number(digital?.percent ?? 0)) + '%' }}></div></div></div>
        </div>
        <div className="stat-card dash-stat stat-accent-red">
          <div className="stat-card-top">
            <div className="stat-card-icon icon-red"><i className="bi bi-cloud-slash"></i></div>
            {Number(stats.unclassified ?? 0) !== 0
              ? <span className="stat-card-chip stat-chip-warning">Perlu Klasifikasi</span>
              : <span className="stat-card-chip">Belum Digital</span>}
          </div>
          <div className="stat-card-value">{stats.without_file}</div>
          <div className="stat-card-label">Belum Digital</div>
          {Number(stats.unclassified ?? 0) !== 0
            ? <span className="stat-card-link">{stats.unclassified} belum terklasifikasi <i className="bi bi-arrow-right"></i></span>
            : <div className="stat-card-foot"><i className="bi bi-cloud-download"></i> Siap digitalisasi</div>}
        </div>
      </div>

      {/* Chart & Box Stats */}
      <div className="row g-3 mb-4 dashboard-lower-grid">
        <div className="col-xl-8">
          <div className="card h-100 dash-chart-card">
            <div className="card-header">
              <span className="card-title"><i className="bi bi-graph-up-arrow text-brand me-2"></i>Prediksi Pertumbuhan Arsip (6 Bulan)</span>
              <span className="badge badge-primary">Linear Regression</span>
            </div>
            <div className="card-body chart-card-body">
              <div className="chart-wrap">
                <canvas id="forecastChart" ref={canvasRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card h-100 dash-box-card">
            <div className="card-header">
              <span className="card-title"><i className="bi bi-boxes text-brand me-2"></i>Inventaris Box RC</span>
              <span className="badge badge-outline" style={{ cursor: 'pointer' }} onClick={() => SimarcModal.show('modalTotalBox')}>{Number(boxStats?.totalRcBoxes ?? 0)} Total</span>
            </div>
            <div className="card-body box-stats-body">
              <div className="box-stats-grid">
                <div className="box-stat-item box-stat-spj" onClick={() => SimarcModal.show('modalSpjBox')}>
                  <div className="box-stat-icon"><i className="bi bi-receipt"></i></div>
                  <div className="box-stat-data">
                    <div className="box-stat-value">{Number(boxStats?.boxMurniSpj ?? 0)}</div>
                    <div className="box-stat-label">Box SPJ</div>
                  </div>
                </div>
                <div className="box-stat-item box-stat-non" onClick={() => SimarcModal.show('modalNonSpjBox')}>
                  <div className="box-stat-icon"><i className="bi bi-files"></i></div>
                  <div className="box-stat-data">
                    <div className="box-stat-value">{Number(boxStats?.boxMurniNonSpj ?? 0)}</div>
                    <div className="box-stat-label">Box Non-SPJ</div>
                  </div>
                </div>
                <div className="box-stat-item box-stat-mix" onClick={() => SimarcModal.show('modalCampuranBox')}>
                  <div className="box-stat-icon"><i className="bi bi-shuffle"></i></div>
                  <div className="box-stat-data">
                    <div className="box-stat-value">{Number(boxStats?.boxCampuran ?? 0)}</div>
                    <div className="box-stat-label">Box Campuran</div>
                  </div>
                </div>
                <div className="box-stat-item box-stat-digital">
                  <div className="box-stat-icon box-stat-icon-brand"><i className="bi bi-cloud-check"></i></div>
                  <div className="box-stat-data">
                    <div className="box-stat-value text-brand">{Math.round(Number(boxStats?.rcDigitalPercent ?? 0))}%</div>
                    <div className="box-stat-label">Digitalisasi</div>
                  </div>
                </div>
              </div>
              <div className="box-stats-footer">
                <span className="text-muted"><i className="bi bi-info-circle me-1"></i>Klik angka untuk lihat daftar box</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Box modals */}
      <SmModal id="modalTotalBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Daftar Box RC</h5><p className="sm-subtitle">Semua box yang terdaftar</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalTotalBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body">
          {(boxStats?.listAll ?? []).length
            ? (boxStats.listAll as string[]).map((b) => <div key={b} className="list-group list-group-flush"><div className="list-group-item px-0 d-flex align-items-center gap-2"><i className="bi bi-box text-muted small"></i><span className="small">{b}</span></div></div>)
            : <p className="text-muted text-center py-3 mb-0"><i className="bi bi-inbox me-2"></i>Tidak ada box</p>}
        </div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalTotalBox')}><i className="bi bi-x-lg me-1"></i>Tutup</button></div>
      </SmModal>
      <SmModal id="modalSpjBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Box Khusus SPJ</h5><p className="sm-subtitle">Box dengan arsip SPJ murni</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalSpjBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body">
          {(boxStats?.listMurniSpj ?? []).length
            ? (boxStats.listMurniSpj as string[]).map((b) => <div key={b} className="list-group-item px-0 d-flex align-items-center gap-2"><i className="bi bi-box" style={{ color: 'var(--ink-2)', fontSize: '0.85rem' }}></i><span className="small">{b}</span></div>)
            : <p className="text-muted text-center py-3 mb-0"><i className="bi bi-inbox me-2"></i>Tidak ada box</p>}
        </div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalSpjBox')}><i className="bi bi-x-lg me-1"></i>Tutup</button></div>
      </SmModal>
      <SmModal id="modalNonSpjBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Box Non-SPJ</h5><p className="sm-subtitle">Box dengan arsip Non-SPJ murni</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalNonSpjBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body">
          {(boxStats?.listMurniNonSpj ?? []).length
            ? (boxStats.listMurniNonSpj as string[]).map((b) => <div key={b} className="list-group-item px-0 d-flex align-items-center gap-2"><i className="bi bi-box" style={{ color: 'var(--ink-2)', fontSize: '0.85rem' }}></i><span className="small">{b}</span></div>)
            : <p className="text-muted text-center py-3 mb-0"><i className="bi bi-inbox me-2"></i>Tidak ada box</p>}
        </div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalNonSpjBox')}><i className="bi bi-x-lg me-1"></i>Tutup</button></div>
      </SmModal>
      <SmModal id="modalCampuranBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Box Campuran</h5><p className="sm-subtitle">Box dengan arsip campuran</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalCampuranBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body">
          {(boxStats?.listCampuran ?? []).length
            ? (boxStats.listCampuran as string[]).map((b) => <div key={b} className="list-group-item px-0 d-flex align-items-center gap-2"><i className="bi bi-box text-muted small"></i><span className="small">{b}</span></div>)
            : <p className="text-muted text-center py-3 mb-0"><i className="bi bi-inbox me-2"></i>Tidak ada box</p>}
        </div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalCampuranBox')}><i className="bi bi-x-lg me-1"></i>Tutup</button></div>
      </SmModal>

      {/* Recent Activities */}
      <div className="card dash-activity-card">
        <div className="card-header">
          <span className="card-title"><i className="bi bi-clock-history text-brand me-2"></i>Aktivitas Terbaru</span>
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => undefined}>Lihat Semua <i className="bi bi-arrow-right ms-1"></i></button>
        </div>
        <div className="table-wrap table-responsive">
          <table className="table table-hover table-sm align-middle datatable" id="activityTable">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Aktivitas</th>
                <th>Aksi</th>
                <th className="text-end">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {(extras?.recentActivities ?? []).map((a: any, i: number) => (
                <tr key={a.createdAt + String(i) || String(i)}>
                  <td>
                    <div className="activity-user-cell">
                      <div className="activity-avatar">{a.userName ? a.userName.charAt(0).toUpperCase() : '?'}</div>
                      <div className="activity-user-info"><span className="fw-semibold activity-username">{a.userName}</span></div>
                    </div>
                  </td>
                  <td><span className="text-muted">{a.description}</span></td>
                  <td><span className="badge badge-neutral">{a.action}</span></td>
                  <td className="text-end"><span className="text-muted activity-time">{a.createdAt}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(extras?.recentActivities ?? []).length && (
            <div className="empty-state">
              <i className="bi bi-inbox empty-icon"></i>
              <p className="empty-title">Belum ada aktivitas</p>
              <p className="empty-desc">Aktivitas terbaru akan muncul di sini</p>
            </div>
          )}
        </div>
      </div>
      {rows.length > 0 && null}
    </div>
  );
};
