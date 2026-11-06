/**
 * ArsipRowsTable — tabel ringkas untuk daftar arsip (disposal, retensi, pencarian…).
 * Kolom: #, Nomor, Identitas & Uraian, Unit Kerja, Tanggal, Kategori, Status, Aksi(Detail).
 */
import React, { useMemo, useState } from 'react';
import { useToast } from '../lib/toast';
import { ArsipDetailModal } from './ArsipDetailModal';

const nf = new Intl.NumberFormat('id-ID');
const statusLabel = (s: string) => (s ? s.replace(/_/g, ' ') : '—');

export interface ArsipRow {
  id?: string;
  nomor?: string;
  nama?: string;
  uraian?: string;
  status?: string;
  unit?: string;
  kategori?: string;
  jenisName?: string;
  tanggal?: string;
  jumlah?: number;
  satuan?: string;
  nilai?: number | string | null;
  nomor_spm?: string;
  berkas?: boolean;
  created?: string;
  updated?: string;
  [k: string]: any;
}

interface Props {
  rows: ArsipRow[];
  perPage?: number;
}

export const ArsipRowsTable: React.FC<Props> = ({ rows, perPage = 10 }) => {
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<ArsipRow | null>(null);

  const filtered = useMemo(() => [...rows], [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const openDetail = (r: ArsipRow) => { if (r && r.nomor) setDetail(r); };

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover table-premium datatable">
          <thead className="sticky-top">
            <tr>
              <th style={{ width: 44 }} className="text-center">#</th>
              <th style={{ width: 140 }}>Nomor</th>
              <th>Identitas &amp; Uraian</th>
              <th style={{ width: 140 }}>Unit Kerja</th>
              <th style={{ width: 110 }}>Tanggal</th>
              <th style={{ width: 110 }}>Kategori</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 100 }} className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((a, idx) => (
              <tr key={a.id}>
                <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{a.nomor || '—'}</span></td>
                <td>
                  <div>
                    <a href="#" className="fw-800 text-decoration-none" style={{ fontSize: '0.88rem', color: 'var(--ink-2)' }} onClick={(e) => { e.preventDefault(); openDetail(a); }}>{a.nama || '—'}</a>
                    {a.uraian && <div className="text-muted mt-1" style={{ fontSize: '0.7rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>{String(a.uraian)}</div>}
                  </div>
                </td>
                <td><span className="small fw-600"><i className="bi bi-building text-primary me-1"></i>{a.unit || '-'}</span></td>
                <td><span className="small fw-600" style={{ color: 'var(--ink-3)' }}><i className="bi bi-calendar3 me-1"></i>{a.tanggal || '-'}</span></td>
                <td><span className="status-badge" style={{ background: 'var(--brand-lt)', color: 'var(--brand)' }}>{a.kategori || 'Umum'}</span></td>
                <td><span className={`status-badge status-${String(a.status ?? 'aktif').toLowerCase()}`}>{statusLabel(String(a.status ?? ''))}</span></td>
                <td className="text-center"><div className="d-flex justify-content-center gap-1">
                  <button type="button" className="btn-crud btn-crud-view" title="Detail" onClick={() => openDetail(a)}><i className="bi bi-eye me-1"></i>Detail</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-5"><div className="text-muted"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i><h6 className="fw-700">Belum Ada Data</h6><small className="text-muted">Tidak ada data yang sesuai</small></div></div>
        )}
      </div>
      <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
        <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> data · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
      <ArsipDetailModal detail={detail as any} onClose={() => setDetail(null)} />
    </>
  );
};

export default ArsipRowsTable;
