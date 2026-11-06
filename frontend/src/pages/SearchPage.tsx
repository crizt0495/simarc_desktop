/**
 * SearchPage — Pencarian Arsip: cari arsip berdasarkan kata kunci.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listArsipDetail } from '../lib/bindings';
import { ArsipRowsTable, type ArsipRow } from '../components/ArsipRowsTable';

export const SearchPage: React.FC = () => {
  const [rows, setRows] = useState<ArsipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await listArsipDetail();
        if (cancelled) return;
        setRows(Array.isArray(r) ? (r as ArsipRow[]) : []);
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

  const filtered = useMemo(() => {
    const needle = (q || '').trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((a) => [a.nomor, a.nama, a.uraian, a.unit, a.kategori].some((f) => (f || '').toString().toLowerCase().includes(needle)));
  }, [rows, q]);

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="search-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-search me-2"></i>Pencarian Arsip</div>
            <div className="hero-sub">Temukan arsip dengan kata kunci, kode klasifikasi, unit, atau lokasi</div>
          </div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-search text-primary me-2"></i>Hasil Pencarian</h5>
          <input type="search" className="form-control form-control-sm" style={{ width: 'auto', minWidth: '240px', fontSize: '0.8rem' }} placeholder="Cari arsip…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data arsip…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : (
            <ArsipRowsTable rows={filtered} perPage={10} />
          )}
        </div>
      </div>
    </div>
  );
};
