/**
 * DisposalPage — Dashboard Penyusutan: daftar arsip yang memenuhi kriteria retensi (siap diproses).
 */
import React, { useEffect, useState } from 'react';
import { listPenyusutan } from '../lib/bindings';
import { ArsipRowsTable } from '../components/ArsipRowsTable';

export const DisposalPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listPenyusutan();
      setRows(Array.isArray(r) ? r : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const total = rows.length;

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="page-header mb-3">
        <div>
          <h1 className="page-title mb-0"><i className="bi bi-recycle text-brand me-2"></i>Dashboard Penyusutan Arsip</h1>
          <p className="page-subtitle mb-0">Arsip yang masa retensinya telah berakhir dan siap diproses pemusnahan</p>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-recycle"></i></div><div><div className="stat-mini-value">{total}</div><div className="stat-mini-label">Siap Penyusutan</div></div></div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data penyusutan…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : (
            <ArsipRowsTable rows={rows} perPage={10} />
          )}
        </div>
      </div>
    </div>
  );
};
