/**
 * MonitoringRetensiPage — pantau arsip yang masa retensinya akan/dengan berakhir.
 */
import React, { useEffect, useState } from 'react';
import { listRetensiExpiring } from '../lib/bindings';
import { ArsipRowsTable } from '../components/ArsipRowsTable';

export const MonitoringRetensiPage: React.FC = () => {
  const [days, setDays] = useState(90);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (d: number) => {
    setLoading(true);
    try {
      const r = await listRetensiExpiring(d);
      setRows(Array.isArray(r) ? r : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(days); }, [days]);

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="mon-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-hourglass-split me-2"></i>Monitoring Retensi Arsip</div>
            <div className="hero-sub">Arsip yang retensi berakhir dalam 90 hari ke depan</div>
          </div>
          <div className="d-flex gap-2">
            {[30, 60, 90, 180].map((d) => (
              <button key={d} type="button" className={`btn btn-sm rounded-pill fw-700 px-3 ${days === d ? 'btn-light' : 'btn-outline-light'}`} style={{ fontSize: '0.7rem' }} onClick={() => setDays(d)}>
                <i className="bi bi-calendar-range me-1"></i>{d} hari
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-hourglass-split text-primary me-2"></i>Arsip Berisiko Retensi</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data monitoring retensi…</h6></div></div>
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
