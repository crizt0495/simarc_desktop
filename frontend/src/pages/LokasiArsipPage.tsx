/**
 * LokasiArsipPage — modul master data Lokasi Arsip (CRUD lengkap).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getMasterOptions, saveLokasiArsip, deleteLokasiArsip, listArsipDetail } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { FormModal } from '../components/FormModal';
import { ArsipFormModal } from '../components/ArsipFormModal';

const nf = new Intl.NumberFormat('id-ID');

export const LokasiArsipPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState<any | null>(null);
  const [arsipFormOpen, setArsipFormOpen] = useState(false);
  const [arsipLokasi, setArsipLokasi] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [arsipList, setArsipList] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await getMasterOptions();
      setRows(Array.isArray(o?.lokasiArsip) ? o.lokasiArsip : []);
      setOpts(o ?? {});
      const arsip = await listArsipDetail();
      setArsipList(Array.isArray(arsip) ? arsip : []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => [...rows].sort((x, y) => String(x.name ?? '').localeCompare(String(y.name ?? ''))), [rows]);
  const arsipCountByLokasi = useMemo(() => {
    const m = new Map<string, number>();
    arsipList.forEach((a) => {
      const k = String(a?.lokasiArsipId ?? '');
      if (!k) return;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [arsipList]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const startIdx = (curPage - 1) * perPage;

  const submit = async (v: Record<string, any>) => {
    setBusy(true);
    try {
      await saveLokasiArsip({ ...v, id: target?.id ?? '' });
      push('success', target ? 'Lokasi berhasil diperbarui' : 'Lokasi berhasil ditambahkan');
      setFormOpen(false);
      setTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Hapus lokasi "${row.name}"?`)) return;
    try {
      await deleteLokasiArsip(row.id);
      push('success', 'Lokasi berhasil dihapus');
      await load();
    } catch (e) {
      push('danger', `Gagal menghapus: ${e}`);
    }
  };

  const openAddArsip = (l: any) => {
    setArsipLokasi(l);
    setArsipFormOpen(true);
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="lokasi-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-geo-alt me-2"></i>Lokasi Arsip</div>
            <div className="hero-sub">Kelola lokasi penyimpanan fisik arsip di lingkungan record center</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => { setTarget(null); setFormOpen(true); }}>
            <i className="bi bi-plus-lg "></i></button>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-geo-alt text-primary me-2"></i>Daftar Lokasi Penyimpanan</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data lokasi…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Lokasi</p><p className="empty-desc">Tidak ada data lokasi penyimpanan</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th style={{ width: 80 }}>ID</th>
                    <th>Nama Lokasi</th>
                    <th>Deskripsi</th>
                    <th style={{ width: 120 }}>Kapasitas</th>
                    <th style={{ width: 110 }} className="text-center">Jumlah Arsip</th>
                    <th style={{ width: 120 }} className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((l, idx) => (
                    <tr key={l.id}>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{l.id}</span></td>
                      <td className="fw-600">{l.name}</td>
                      <td><span className="small text-muted">{l.deskripsi || '—'}</span></td>
                      <td><span className="small fw-600">{l.kapasitas || '—'}</span></td>
                      <td className="text-center"><span className="small fw-700">{nf.format(arsipCountByLokasi.get(String(l.id)) ?? 0)}</span></td>
                      <td className="text-center">
                        <div className="btn-crud-group">
                          <button type="button" className="btn-crud btn-crud-primary" title="Tambah Arsip di Lokasi Ini" onClick={() => openAddArsip(l)}><i className="bi bi-plus-circle"></i></button>
                          <button type="button" className="btn-crud btn-crud-edit" title="Ubah Lokasi" onClick={() => { setTarget(l); setFormOpen(true); }}><i className="bi bi-pencil"></i></button>
                          <button type="button" className="btn-crud btn-crud-del" title="Hapus Lokasi" onClick={() => void remove(l)}><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> lokasi · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
        title={target ? 'Ubah Lokasi Arsip' : 'Tambah Lokasi Arsip'}
        subtitle="Lokasi fisik penyimpanan arsip"
        icon="geo-alt"
        fields={[
          { key: 'nama', label: 'Nama Lokasi', required: true, col: 12, placeholder: 'Contoh: Ruang Record Center Lt. 1' },
          { key: 'deskripsi', label: 'Deskripsi', type: 'textarea', rows: 2, placeholder: 'Keterangan lokasi…' },
          { key: 'kapasitas', label: 'Kapasitas', placeholder: 'Contoh: 120 box' },
        ]}
        initial={target ? { nama: target.name, deskripsi: target.deskripsi ?? '', kapasitas: target.kapasitas ?? '' } : undefined}
        busy={busy}
        submitLabel={target ? 'Simpan Perubahan' : 'Tambah Lokasi'}
        onClose={() => { if (!busy) { setFormOpen(false); setTarget(null); } }}
        onSubmit={submit}
      />

      <ArsipFormModal
        open={arsipFormOpen}
        initial={arsipLokasi ? { lokasiArsipId: arsipLokasi.id } : null}
        opts={opts}
        onClose={() => { setArsipFormOpen(false); setArsipLokasi(null); }}
        onSaved={() => { void load(); setArsipFormOpen(false); setArsipLokasi(null); }}
      />
    </div>
  );
};
