/**
 * AdvancedPage — Analitik Lanjutan: pertumbuhan jumlah arsip per bulan.
 */
import React, { useEffect, useState } from 'react';
import { getArsipGrowth } from '../lib/bindings';
import { useToast } from '../lib/toast';

export const AdvancedPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getArsipGrowth();
      setRows(Array.isArray(r) ? r : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const maxTotal = Math.max(1, ...rows.map((r) => Number(r.total ?? 0)));

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="advanced-header">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-cpu me-2"></i>Analitik Lanjutan</div>
            <div className="hero-sub">Dashboard analitik dan intelijen arsip tingkat lanjut</div>
          </div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-graph-up text-primary me-2"></i>Pertumbuhan Arsip per Bulan</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data pertumbuhan…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : rows.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Data</p><p className="empty-desc">Tidak ada data pertumbuhan arsip</p></div>
          ) : (
            <div className="row g-2">
              {rows.map((r) => (
                <div className="col-12" key={r.month}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <small className="fw-700" style={{ fontSize: '0.75rem' }}>{r.month}</small>
                    <span className="badge badge-soft-primary">{Number(r.total ?? 0)} arsip</span>
                  </div>
                  <div style={{ height: 12, background: 'var(--surface-3)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (Number(r.total ?? 0) / maxTotal) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--nb-primary-deep), var(--nb-primary))', borderRadius: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
