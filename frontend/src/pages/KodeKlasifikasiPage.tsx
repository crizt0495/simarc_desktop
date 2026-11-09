/**
 * KodeKlasifikasiPage — modul master data Kode Klasifikasi (CRUD lengkap).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getMasterOptions, saveKodeKlasifikasi, deleteKodeKlasifikasi } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { FormModal } from '../components/FormModal';

const nf = new Intl.NumberFormat('id-ID');

const PENYUSUTAN = [
  { value: 'musnah', label: 'Musnah' },
  { value: 'permanen', label: 'Permanen' },
  { value: 'dinilai_kembali', label: 'Dinilai Kembali' },
];
const KEAMANAN = [
  { value: 'biasa', label: 'Biasa' },
  { value: 'terbatas', label: 'Terbatas' },
  { value: 'rahasia', label: 'Rahasia' },
  { value: 'sangat_rahasia', label: 'Sangat Rahasia' },
];

export const KodeKlasifikasiPage: React.FC = () => {
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
      setRows(Array.isArray(o?.kodeKlasifikasi) ? o.kodeKlasifikasi : []);
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
      await saveKodeKlasifikasi({ ...v, id: target?.id ?? '' });
      push('success', target ? 'Kode klasifikasi berhasil diperbarui' : 'Kode klasifikasi berhasil ditambahkan');
      setFormOpen(false);
      setTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Hapus kode klasifikasi "${row.name}"?`)) return;
    try {
      await deleteKodeKlasifikasi(row.id);
      push('success', 'Kode klasifikasi berhasil dihapus');
      await load();
    } catch (e) {
      push('danger', `Gagal menghapus: ${e}`);
    }
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="kode-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-tags me-2"></i>Kode Klasifikasi</div>
            <div className="hero-sub">Kelola kode klasifikasi, retensi, dan keamanan arsip</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => { setTarget(null); setFormOpen(true); }}>
            <i className="bi bi-plus-lg "></i></button>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-tags text-primary me-2"></i>Daftar Kode Klasifikasi</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat data kode klasifikasi…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Kode Klasifikasi</p><p className="empty-desc">Tidak ada data kode klasifikasi</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th style={{ width: 110 }}>Kode</th>
                    <th>Nama Klasifikasi</th>
                    <th style={{ width: 100 }}>Aktif</th>
                    <th style={{ width: 100 }}>Inaktif</th>
                    <th style={{ width: 120 }}>Penyusutan</th>
                    <th style={{ width: 120 }}>Keamanan</th>
                    <th style={{ width: 100 }} className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((k, idx) => (
                    <tr key={k.id}>
                      <td className="text-center text-muted fw-700 small">{startIdx + idx + 1}</td>
                      <td><span className="fw-800 font-monospace" style={{ fontSize: '0.78rem' }}>{String(k.kode ?? String(k.name ?? '').split(' - ')[0]) || '—'}</span></td>
                      <td className="fw-600">{k.nama ?? String(k.name ?? '').split(' - ')[1] ?? k.name}</td>
                      <td><span className="small fw-600">{k.retensiAktif || 0} th</span></td>
                      <td><span className="small fw-600">{k.retensiInaktif || 0} th</span></td>
                      <td><span className="small fw-600">{k.penyusutanArsip || '—'}</span></td>
                      <td><span className="small fw-600">{k.klasifikasiKeamanan || '—'}</span></td>
                      <td className="text-center"><div className="btn-crud-group">
                        <button type="button" className="btn-crud btn-crud-edit" title="Ubah" onClick={() => { setTarget(k); setFormOpen(true); }}><i className="bi bi-pencil "></i></button>
                        <button type="button" className="btn-crud btn-crud-del" title="Hapus" onClick={() => void remove(k)}><i className="bi bi-trash "></i></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top flex-wrap gap-2 mt-2" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <small className="text-muted fw-600">Menampilkan <strong>{nf.format(filtered.length)}</strong> kode klasifikasi · Halaman <strong>{curPage}</strong> dari <strong>{totalPages}</strong></small>
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
        title={target ? 'Ubah Kode Klasifikasi' : 'Tambah Kode Klasifikasi'}
        subtitle="Kode, retensi, dan tingkat keamanan arsip"
        icon="tags"
        size="lg"
        fields={[
          { key: 'kode', label: 'Kode Klasifikasi', required: true, placeholder: 'Contoh: KEU.01' },
          { key: 'nama', label: 'Nama Klasifikasi', required: true, placeholder: 'Contoh: Keuangan' },
          { key: 'retensiAktif', label: 'Retensi Aktif (tahun)', type: 'number', min: 0, placeholder: '0' },
          { key: 'retensiInaktif', label: 'Retensi Inaktif (tahun)', type: 'number', min: 0, placeholder: '0' },
          { key: 'penyusutanArsip', label: 'Penyusutan Akhir', type: 'select', options: PENYUSUTAN, placeholder: '— Pilih —' },
          { key: 'klasifikasiKeamanan', label: 'Klasifikasi Keamanan', type: 'select', options: KEAMANAN, placeholder: '— Pilih —' },
          { key: 'unitPengolah', label: 'Unit Pengolah', col: 12, placeholder: 'Unit kerja pengolah arsip' },
        ]}
        initial={target ? {
          kode: target.kode ?? String(target.name ?? '').split(' - ')[0] ?? '',
          nama: target.nama ?? String(target.name ?? '').split(' - ')[1] ?? '',
          retensiAktif: target.retensiAktif ?? 0,
          retensiInaktif: target.retensiInaktif ?? 0,
          penyusutanArsip: target.penyusutanArsip ?? '',
          klasifikasiKeamanan: target.klasifikasiKeamanan ?? '',
          unitPengolah: target.unitPengolah ?? '',
        } : undefined}
        busy={busy}
        submitLabel={target ? 'Simpan Perubahan' : 'Tambah Kode'}
        onClose={() => { if (!busy) { setFormOpen(false); setTarget(null); } }}
        onSubmit={submit}
      />
    </div>
  );
};
