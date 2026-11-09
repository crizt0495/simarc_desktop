/**
 * BlockchainPage — Blockchain Audit: verifikasi integritas hash chain.
 */
import React, { useEffect, useState } from 'react';
import { getBlockchainVerify } from '../lib/bindings';
import { useToast } from '../lib/toast';

export const BlockchainPage: React.FC = () => {
  const { push } = useToast();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getBlockchainVerify();
      setResult(r);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const total = Number(result?.total_blocks ?? 0);
  const invalid = Number(result?.invalid_blocks ?? 0);
  const isValid = Boolean(result?.is_valid);

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="explorer-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-shield-check me-2"></i>Blockchain Explorer</div>
            <div className="hero-sub">Catatan perubahan data anti-manipulasi (hash chain)</div>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon icon-blue"><i className="bi bi-link-45deg"></i></div><div><div className="stat-mini-value">{total}</div><div className="stat-mini-label">Total Blok</div></div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: isValid ? 'var(--success-lt)' : 'var(--danger-lt)', color: isValid ? 'var(--success-dk)' : 'var(--danger-dk)' }}><i className="bi bi-shield-lock"></i></div><div><div className="stat-mini-value">{isValid ? 'Aman' : 'Rusak'}</div><div className="stat-mini-label">Status Rantai</div></div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-x-octagon"></i></div><div><div className="stat-mini-value">{invalid}</div><div className="stat-mini-label">Blok Tidak Valid</div></div></div>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-shield-check text-primary me-2"></i>Verifikasi Rantai Blockchain</h5>
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill fw-700 px-3" style={{ fontSize: '0.7rem' }} onClick={() => void load()}>
            <i className="bi bi-arrow-repeat "></i></button>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memverifikasi rantai blockchain…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : (
            <div>
              <div className="row g-2">
                <div className="col-md-4"><div className="stat-mini"><div className="stat-mini-value" style={{ color: isValid ? 'var(--success-dk)' : 'var(--danger-dk)' }}>{isValid ? 'Rantai Valid' : 'Rantai Rusak'}</div><div className="stat-mini-label">Hasil Verifikasi</div></div></div>
                <div className="col-md-4"><div className="stat-mini"><div className="stat-mini-value">{total}</div><div className="stat-mini-label">Blok Diambil Tangan</div></div></div>
                <div className="col-md-4"><div className="stat-mini"><div className="stat-mini-value">{invalid}</div><div className="stat-mini-label">Blok Bermasalah</div></div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
