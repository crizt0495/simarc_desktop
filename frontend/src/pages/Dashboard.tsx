/**
 * Dashboard — ringkasan status kearsipan organisasi.
 * Tata letak memakai design system enterprise.css; penyesuaian kerapian
 * (chart, daftar box pada modal, dan tabel aktivitas) ada di dashboard.css.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { PageKey } from '../components/AppSidebar';
import { getDashboardExtras, getDashboardStats, type Status } from '../lib/bindings';
import { SimarcModal, SmModal } from '../lib/modal';
import './dashboard.css';

type StatCardData = {
  key: string;
  accent: string;
  iconCls: string;
  icon: string;
  chip: React.ReactNode;
  chipCls?: string;
  value: React.ReactNode;
  label: string;
  foot?: React.ReactNode;
  progress?: { pct: number; fill: string };
  link?: React.ReactNode;
};

const StatCard: React.FC<{ card: StatCardData }> = ({ card }) => (
  <div className={`stat-card dash-stat ${card.accent}`}>
    <div className="stat-card-top">
      <div className={`stat-card-icon ${card.iconCls}`}><i className={`bi ${card.icon}`}></i></div>
      <span className={`stat-card-chip ${card.chipCls ?? ''}`}>{card.chip}</span>
    </div>
    <div className="stat-card-value">{card.value}</div>
    <div className="stat-card-label">{card.label}</div>
    {card.progress ? (
      <div className="stat-card-progress">
        <div className="progress-track">
          <div
            className={`progress-fill ${card.progress.fill}`}
            style={{ width: Math.max(0, Math.min(100, card.progress.pct)) + '%' }}
          ></div>
        </div>
      </div>
    ) : card.link ? (
      <span className="stat-card-link">{card.link}</span>
    ) : (
      <div className="stat-card-foot">{card.foot}</div>
    )}
  </div>
);

const BoxList: React.FC<{ items: string[] }> = ({ items }) =>
  items.length ? (
    <div className="sm-box-list">
      {items.map((b) => (
        <div key={b} className="sm-box-item">
          <i className="bi bi-box text-muted small"></i>
          <span>{b}</span>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-muted text-center py-3 mb-0">
      <i className="bi bi-inbox me-2"></i>Tidak ada box
    </p>
  );

export const Dashboard: React.FC<{
  status: Status | null;
  userName: string;
  onNavigate?: (page: PageKey) => void;
}> = ({ status, userName, onNavigate }) => {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [extras, setExtras] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = async (showBusy: boolean) => {
    if (showBusy) setBusy(true);
    try {
      const [s, ex] = await Promise.all([getDashboardStats(), getDashboardExtras()]);
      if (!s || (s as any).error) throw new Error(String(s?.error ?? 'database belum siap'));
      setStats(s);
      setExtras(ex);
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

  // Persentase kecil (mis. 1 berkas dari 4.000 arsip) tidak boleh tampil 0%.
  const pctLabel = (value: number) => (value > 0 && value < 1 ? '<1' : String(Math.round(value)));
  const pctWidth = (value: number) => (value > 0 && value < 2 ? 2 : Math.round(value));

  const digital = extras?.digitalFile;
  const boxStats = extras?.boxStats;
  const forecast = Array.isArray(extras?.forecast) ? (extras.forecast as any[]) : [];
  const activities = Array.isArray(extras?.recentActivities) ? (extras.recentActivities as any[]) : [];

  /* ── Chart identik dengan drawForecast() referensi ── */
  const drawForecast = () => {
    const canvas = canvasRef.current;
    if (!canvas || !(window as any).Chart || !forecast.length) return;
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
        labels: forecast.map((m) => m.month),
        datasets: [{
          label: 'Prediksi',
          data: forecast.map((m) => m.predictedCount),
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

  if (!ready || !stats) {
    return (
      <div className="container-fluid py-3 py-xl-4 dashboard-page">
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

  /* Semua KPI memakai satu pola kartu agar tinggi, jarak, dan tipografi seragam. */
  const statUtama: StatCardData[] = [
    {
      key: 'total', accent: 'stat-accent-blue', iconCls: 'icon-blue', icon: 'bi-archive',
      chip: 'Semua Data', value: stats.total, label: 'Total Arsip',
      foot: <React.Fragment><i className="bi bi-box"></i> Seluruh arsip</React.Fragment>,
    },
    {
      key: 'items', accent: 'stat-accent-indigo', iconCls: 'icon-indigo', icon: 'bi-box-seam',
      chip: 'Item Fisik', value: stats.total_items, label: 'Total Item Fisik',
      foot: <React.Fragment><i className="bi bi-collection"></i> {stats.total ?? 0} arsip</React.Fragment>,
    },
    {
      key: 'aktif', accent: 'stat-accent-green', iconCls: 'icon-green', icon: 'bi-check-circle',
      chip: `${pct(Number(stats.aktif ?? 0))}% dari total`, chipCls: 'stat-chip-pct',
      value: stats.aktif, label: 'Arsip Aktif',
      progress: { pct: pct(Number(stats.aktif ?? 0)), fill: 'progress-fill-green' },
    },
    {
      key: 'inaktif', accent: 'stat-accent-purple', iconCls: 'icon-purple', icon: 'bi-pause-circle',
      chip: `${pct(Number(stats.inaktif ?? 0))}% dari total`, chipCls: 'stat-chip-pct',
      value: stats.inaktif, label: 'Arsip Inaktif',
      progress: { pct: pct(Number(stats.inaktif ?? 0)), fill: 'progress-fill-purple' },
    },
    {
      key: 'musnah', accent: 'stat-accent-amber', iconCls: 'icon-amber', icon: 'bi-exclamation-triangle',
      chip: Number(stats.siap_penyusutan ?? 0) !== 0 ? 'Perlu Review' : 'Aman',
      chipCls: Number(stats.siap_penyusutan ?? 0) !== 0 ? 'stat-chip-danger' : 'stat-chip-success',
      value: stats.siap_penyusutan ?? 0, label: 'Siap Musnah',
      foot: <React.Fragment><i className="bi bi-trash"></i> Menunggu penyusutan</React.Fragment>,
    },
  ];

  const statKategori: StatCardData[] = [
    {
      key: 'spj', accent: 'stat-accent-blue', iconCls: 'icon-blue', icon: 'bi-file-text',
      chip: 'SPJ', value: stats.spj, label: 'Arsip SPJ',
      foot: <React.Fragment><i className="bi bi-receipt"></i> Pertanggungjawaban</React.Fragment>,
    },
    {
      key: 'non-spj', accent: 'stat-accent-purple', iconCls: 'icon-purple', icon: 'bi-files',
      chip: 'Non-SPJ', value: stats.non_spj, label: 'Arsip Non-SPJ',
      foot: <React.Fragment><i className="bi bi-collection"></i> Dokumen lain</React.Fragment>,
    },
    {
      key: 'digital', accent: 'stat-accent-green', iconCls: 'icon-green', icon: 'bi-cloud-check',
      chip: `${pctLabel(Number(digital?.percent ?? 0))}% dari total`, chipCls: 'stat-chip-pct',
      value: digital?.with ?? 0, label: 'Sudah Digital',
      progress: { pct: pctWidth(Number(digital?.percent ?? 0)), fill: 'progress-fill-green' },
    },
    {
      key: 'belum-digital', accent: 'stat-accent-red', iconCls: 'icon-red', icon: 'bi-cloud-slash',
      chip: Number(stats.unclassified ?? 0) !== 0 ? 'Perlu Klasifikasi' : 'Belum Digital',
      chipCls: Number(stats.unclassified ?? 0) !== 0 ? 'stat-chip-warning' : '',
      value: stats.without_file, label: 'Belum Digital',
      link: Number(stats.unclassified ?? 0) !== 0
        ? <React.Fragment>{stats.unclassified} belum terklasifikasi <i className="bi bi-arrow-right"></i></React.Fragment>
        : undefined,
      foot: Number(stats.unclassified ?? 0) !== 0
        ? undefined
        : <React.Fragment><i className="bi bi-cloud-download"></i> Siap digitalisasi</React.Fragment>,
    },
  ];

  const boxItems = (key: string): string[] => {
    const value = boxStats?.[key];
    return Array.isArray(value) ? (value as string[]) : [];
  };

  return (
    <div className="dashboard-page">
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

      {/* Ringkasan utama */}
      <div className="kpi-grid kpi-grid-5 mb-4">
        {statUtama.map((card) => <StatCard key={card.key} card={card} />)}
      </div>

      {/* Kategori arsip & digitalisasi */}
      <div className="kpi-grid kpi-grid-4 mb-4">
        {statKategori.map((card) => <StatCard key={card.key} card={card} />)}
      </div>

      {/* Grafik prediksi & inventaris box */}
      <div className="row g-3 mb-4 dashboard-lower-grid">
        <div className="col-xl-8">
          <div className="card h-100 dash-chart-card">
            <div className="card-header">
              <span className="card-title"><i className="bi bi-graph-up-arrow text-brand"></i>Prediksi Pertumbuhan Arsip (6 Bulan)</span>
              <span className="badge badge-primary">Linear Regression</span>
            </div>
            <div className="card-body chart-card-body">
              <div className="chart-wrap">
                {forecast.length
                  ? <canvas id="forecastChart" ref={canvasRef}></canvas>
                  : <div className="chart-empty"><i className="bi bi-graph-up"></i><span>Belum ada data prediksi</span></div>}
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card h-100 dash-box-card">
            <div className="card-header">
              <span className="card-title"><i className="bi bi-boxes text-brand"></i>Inventaris Box RC</span>
              <span className="badge badge-outline dash-box-total" onClick={() => SimarcModal.show('modalTotalBox')}>{Number(boxStats?.totalRcBoxes ?? 0)} Total</span>
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
                    <div className="box-stat-value text-brand">{pctLabel(Number(boxStats?.rcDigitalPercent ?? 0))}%</div>
                    <div className="box-stat-label">Digitalisasi</div>
                  </div>
                </div>
              </div>
              <div className="box-stats-footer">
                <span className="text-muted"><i className="bi bi-info-circle"></i> Klik angka untuk lihat daftar box</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal daftar box */}
      <SmModal id="modalTotalBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Daftar Box RC</h5><p className="sm-subtitle">Semua box yang terdaftar</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalTotalBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body"><BoxList items={boxItems('listAll')} /></div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalTotalBox')}><i className="bi bi-x-lg"></i> Tutup</button></div>
      </SmModal>
      <SmModal id="modalSpjBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Box Khusus SPJ</h5><p className="sm-subtitle">Box dengan arsip SPJ murni</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalSpjBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body"><BoxList items={boxItems('listMurniSpj')} /></div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalSpjBox')}><i className="bi bi-x-lg"></i> Tutup</button></div>
      </SmModal>
      <SmModal id="modalNonSpjBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Box Non-SPJ</h5><p className="sm-subtitle">Box dengan arsip Non-SPJ murni</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalNonSpjBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body"><BoxList items={boxItems('listMurniNonSpj')} /></div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalNonSpjBox')}><i className="bi bi-x-lg"></i> Tutup</button></div>
      </SmModal>
      <SmModal id="modalCampuranBox" size="sm">
        <div className="sm-header"><div className="sm-title-group"><h5 className="sm-title">Box Campuran</h5><p className="sm-subtitle">Box dengan arsip campuran</p></div><button type="button" className="sm-close" onClick={() => SimarcModal.hide('modalCampuranBox')} aria-label="Tutup"><i className="bi bi-x-lg"></i></button></div>
        <div className="sm-body"><BoxList items={boxItems('listCampuran')} /></div>
        <div className="sm-footer"><button type="button" className="sm-btn sm-btn-cancel" onClick={() => SimarcModal.hide('modalCampuranBox')}><i className="bi bi-x-lg"></i> Tutup</button></div>
      </SmModal>

      {/* Aktivitas terbaru */}
      <div className="card dash-activity-card">
        <div className="card-header">
          <span className="card-title"><i className="bi bi-clock-history text-brand"></i>Aktivitas Terbaru</span>
          <div className="dash-activity-actions">
            <span className="badge badge-neutral">{activities.length} entri</span>
            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => onNavigate?.('log-aktivitas')}>
              Lihat Semua <i className="bi bi-arrow-right"></i>
            </button>
          </div>
        </div>
        {activities.length ? (
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
                {activities.map((a: any, i: number) => (
                  <tr key={String(a.createdAt ?? '') + String(i)}>
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
          </div>
        ) : (
          <div className="empty-state py-4">
            <i className="bi bi-inbox"></i>
            <p className="empty-title">Belum ada aktivitas</p>
            <p className="empty-desc">Aktivitas terbaru akan muncul di sini</p>
          </div>
        )}
      </div>
    </div>
  );
};
