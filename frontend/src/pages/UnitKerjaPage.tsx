/**
 * UnitKerjaPage — modul master data Unit Kerja (CRUD lengkap).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getMasterOptions, saveUnitKerja, deleteUnitKerja } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { FormModal } from '../components/FormModal';

const nf = new Intl.NumberFormat('id-ID');

export const UnitKerjaPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await getMasterOptions();
      setRows(Array.isArray(o?.unitKerja) ? o.unitKerja : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => [...rows].sort((x, y) => String(x.name ?? '').localeCompare(String(y.name ?? ''))), [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const submit = async (v: Record<string, any>) => {
    setBusy(true);
    try {
      await saveUnitKerja(target?.id ?? '', String(v.name ?? ''));
      push('success', target ? 'Unit kerja berhasil diperbarui' : 'Unit kerja berhasil ditambahkan');
      setFormOpen(false);
      setTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Hapus unit kerja "${row.name}"?`)) return;
    try {
      await deleteUnitKerja(row.id);
      push('success', 'Unit kerja berhasil dihapus');
      await load();
    } catch (e) {
      push('danger', `Gagal menghapus: ${e}`);
    }
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="unit-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-building me-2"></i>Unit Kerja</div>
            <div className="hero-sub">Kelola struktur organisasi dan unit kerja pengelola arsip</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => { setTarget(null); setFormOpen(true); }}>
            <i className="bi bi-plus-lg "></i></button>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-building text-primary me-2"></i>Daftar Unit Kerja</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data unit kerja…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Unit Kerja</p><p className="empty-desc">Tidak ada data unit kerja</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th>Nama Unit Kerja</th>
                    <th style={{ width: 100 }} className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((u, idx) => (
                    <tr key={u.id}>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td className="fw-600">{u.name}</td>
                      <td className="text-center"><div className="btn-crud-group">
                        <button type="button" className="btn-crud btn-crud-edit" title="Ubah" onClick={() => { setTarget(u); setFormOpen(true); }}><i className="bi bi-pencil "></i></button>
                        <button type="button" className="btn-crud btn-crud-del" title="Hapus" onClick={() => void remove(u)}><i className="bi bi-trash "></i></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> unit kerja · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
      </div>

      <FormModal
        open={formOpen}
        title={target ? 'Ubah Unit Kerja' : 'Tambah Unit Kerja'}
        subtitle="Nama unit kerja pengelola arsip"
        icon="building"
        size="sm"
        fields={[{ key: 'name', label: 'Nama Unit Kerja', required: true, col: 12, placeholder: 'Contoh: Bagian Pemerintahan' }]}
        initial={target ? { name: target.name } : undefined}
        busy={busy}
        submitLabel={target ? 'Simpan Perubahan' : 'Tambah Unit'}
        onClose={() => { if (!busy) { setFormOpen(false); setTarget(null); } }}
        onSubmit={submit}
      />
    </div>
  );
};
