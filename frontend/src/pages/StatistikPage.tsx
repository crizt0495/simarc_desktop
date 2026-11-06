/**
 * StatistikPage — Laporan Statistik Arsip: ringkasan KPI koleksi.
 */
import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../lib/bindings';
import { useToast } from '../lib/toast';

const nf = new Intl.NumberFormat('id-ID');

export const StatistikPage: React.FC = () => {
  const { push } = useToast();
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const s = await getDashboardStats();
        if (cancelled) return;
        setStats(s || {});
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const cards: Array<[string, string, any]> = [
    ['Total Arsip', 'bi-file-earmark-text', stats.total],
    ['Item Arsip', 'bi-archive', stats.total_items],
    ['Aktif', 'bi-check-circle', stats.aktif],
    ['Inaktif', 'bi-pause-circle', stats.inaktif],
    ['Siap Penyusutan', 'bi-hourglass-split', stats.siap_penyusutan],
    ['Musnah', 'bi-trash3', stats.musnah],
    ['Berkas Digital', 'bi-cloud-check', Number(stats.with_file ?? 0)],
    ['Belum Digital', 'bi-cloud-slash', Number(stats.without_file ?? 0)],
    ['SPJ', 'bi-journal-text', stats.spj],
    ['Non SPJ', 'bi-journal-x', stats.non_spj],
    ['Belum Terklasifikasi', 'bi-question-circle', stats.unclassified],
  ];

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="page-header mb-3">
        <div>
          <h1 className="page-title mb-0"><i className="bi bi-pie-chart text-brand me-2"></i>Statistik Arsip</h1>
          <p className="page-subtitle mb-0">Statistik lengkap koleksi arsip record center</p>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        {cards.map(([label, icon, val]) => (
          <div className="col-6 col-md-4" key={label}>
            <div className="stat-mini"><div className="stat-mini-icon icon-blue"><i className={`bi ${icon}`}></i></div><div><div className="stat-mini-value">{nf.format(Number(val ?? 0))}</div><div className="stat-mini-label">{label}</div></div></div>
          </div>
        ))}
      </div>

      {loading && <div className="text-center py-4"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data statistik…</h6></div></div>}
      {error && <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>}
    </div>
  );
};
