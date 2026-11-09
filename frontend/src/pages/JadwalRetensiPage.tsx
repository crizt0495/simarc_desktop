/**
 * JadwalRetensiPage — kelola jadwal retensi, penyusutan, dan review arsip.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { listJadwalRetensi, saveJadwalRetensi, deleteJadwalRetensi, prosesJadwalRetensi, getMasterOptions } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { FormModal } from '../components/FormModal';

const nf = new Intl.NumberFormat('id-ID');
const toOpts = (arr: any[] | undefined) => (arr ?? []).map((o: any) => ({ value: String(o.id), label: String(o.name ?? o.id) }));

const JENIS = [
  { value: 'retensi', label: 'Retensi' },
  { value: 'penyusutan', label: 'Penyusutan' },
  { value: 'review', label: 'Review' },
];
const STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'berjalan', label: 'Berjalan' },
  { value: 'selesai', label: 'Selesai' },
];
const NASIB = [
  { value: 'musnah', label: 'Musnah' },
  { value: 'permanen', label: 'Permanen' },
  { value: 'dinilai_kembali', label: 'Dinilai Kembali' },
];

export const JadwalRetensiPage: React.FC = () => {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([listJadwalRetensi(), getMasterOptions()]);
      setRows(Array.isArray(r) ? r : []);
      setOpts(o ?? {});
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (v: Record<string, any>) => {
    setBusy(true);
    try {
      await saveJadwalRetensi({ ...v, id: target?.id ?? '' });
      push('success', target ? 'Jadwal retensi diperbarui' : 'Jadwal retensi dibuat');
      setFormOpen(false);
      setTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Hapus jadwal "${row.nama}"?`)) return;
    try {
      await deleteJadwalRetensi(row.id);
      push('success', 'Jadwal retensi dihapus');
      await load();
    } catch (e) {
      push('danger', `Gagal menghapus: ${e}`);
    }
  };

  const proses = async (row: any) => {
    if (!window.confirm(`Proses jadwal "${row.nama}"? Status arsip yang cocok akan diperbarui otomatis.`)) return;
    try {
      const res = await prosesJadwalRetensi(row.id);
      push('success', `Jadwal diproses: ${res?.processed ?? 0} arsip diperbarui`);
      await load();
    } catch (e) {
      push('danger', `Gagal memproses: ${e}`);
    }
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="retensi-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-calendar-check me-2"></i>Jadwal Retensi Arsip</div>
            <div className="hero-sub">Kelola jadwal pemusnahan, penyusutan, dan review arsip berdasarkan retensi</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => { setTarget(null); setFormOpen(true); }}>
            <i className="bi bi-plus-lg "></i></button>
        </div>
      </div>

      <div className="card fade-up-d2">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
          <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-calendar-check text-primary me-2"></i>Daftar Jadwal</h5>
        </div>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          {loading ? (
            <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat jadwal retensi…</h6></div></div>
          ) : error ? (
            <div className="empty-state py-4"><i className="bi bi-exclamation-triangle empty-icon"></i><p className="empty-title">Gagal Memuat Data</p><p className="empty-desc">{error}</p></div>
          ) : rows.length === 0 ? (
            <div className="empty-state py-4"><i className="bi bi-inbox empty-icon"></i><p className="empty-title">Belum Ada Jadwal</p><p className="empty-desc">Buat jadwal retensi pertama Anda</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-premium datatable">
                <thead className="sticky-top">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">#</th>
                    <th>Nama Jadwal</th>
                    <th style={{ width: 120 }}>Jenis</th>
                    <th style={{ width: 110 }}>Tanggal</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 120 }}>Nasib</th>
                    <th style={{ width: 110 }} className="text-center">Diproses</th>
                    <th style={{ width: 230 }} className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j, idx) => (
                    <tr key={j.id}>
                      <td className="text-center text-muted fw-700 small">{idx + 1}</td>
                      <td>
                        <div className="fw-700" style={{ fontSize: '0.85rem' }}>{j.nama}</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>{j.deskripsi || j.kodeKlasifikasi || '—'}</div>
                      </td>
                      <td><span className="badge badge-soft-primary">{j.jenis || '—'}</span></td>
                      <td><span className="small fw-600">{j.tanggal || '—'}</span></td>
                      <td><span className={`status-badge status-${String(j.status ?? '').replace(/\s+/g, '_')}`}>{j.status || '—'}</span></td>
                      <td><span className="small fw-600">{j.nasib || '—'}</span></td>
                      <td className="text-center"><span className="badge badge-soft-primary">{nf.format(Number(j.arsipDiproses ?? 0))}/{nf.format(Number(j.totalArsip ?? 0))}</span></td>
                      <td className="text-center"><div className="btn-crud-group">
                        <button type="button" className="btn-crud btn-crud-success" title="Proses Retensi" onClick={() => void proses(j)}><i className="bi bi-play-fill"></i></button>
                        <button type="button" className="btn-crud btn-crud-edit" title="Ubah Jadwal" onClick={() => { setTarget(j); setFormOpen(true); }}><i className="bi bi-pencil"></i></button>
                        <button type="button" className="btn-crud btn-crud-del" title="Hapus Jadwal" onClick={() => void remove(j)}><i className="bi bi-trash"></i></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <FormModal
        open={formOpen}
        title={target ? 'Ubah Jadwal Retensi' : 'Buat Jadwal Retensi'}
        subtitle="Jadwal pemusnahan / penyusutan arsip"
        icon="calendar-check"
        size="lg"
        fields={[
          { key: 'nama', label: 'Nama Jadwal', required: true, col: 12, placeholder: 'Contoh: Penyusutan Arsip Keuangan 2020' },
          { key: 'deskripsi', label: 'Deskripsi', type: 'textarea', rows: 2, placeholder: 'Keterangan jadwal…' },
          { key: 'jenis', label: 'Jenis Jadwal', type: 'select', options: JENIS, placeholder: 'Retensi' },
          { key: 'status', label: 'Status', type: 'select', options: STATUS, placeholder: 'Draft' },
          { key: 'tanggal', label: 'Tanggal Jadwal', type: 'date' },
          { key: 'nasib', label: 'Nasib Akhir', type: 'select', options: NASIB, placeholder: '— Pilih —' },
          { key: 'kodeKlasifikasiId', label: 'Kode Klasifikasi', type: 'select', options: toOpts(opts.kodeKlasifikasi), placeholder: '— Semua klasifikasi —' },
          { key: 'unitKerjaId', label: 'Unit Kerja', type: 'select', options: toOpts(opts.unitKerja), placeholder: '— Semua unit —' },
          { key: 'retensiAktif', label: 'Retensi Aktif (th)', type: 'number', min: 0 },
          { key: 'retensiInaktif', label: 'Retensi Inaktif (th)', type: 'number', min: 0 },
          { key: 'catatan', label: 'Catatan', type: 'textarea', rows: 2, placeholder: 'Catatan tambahan…' },
        ]}
        initial={target ? {
          nama: target.nama ?? '', deskripsi: target.deskripsi ?? '', jenis: target.jenis ?? 'retensi',
          status: target.status ?? 'draft', tanggal: target.tanggal ?? '', nasib: target.nasib ?? '',
          kodeKlasifikasiId: target.kodeKlasifikasiId ?? '', unitKerjaId: target.unitKerjaId ?? '',
          retensiAktif: target.retensiAktif ?? 0, retensiInaktif: target.retensiInaktif ?? 0, catatan: target.catatan ?? '',
        } : { jenis: 'retensi', status: 'draft' }}
        busy={busy}
        submitLabel={target ? 'Simpan Perubahan' : 'Buat Jadwal'}
        onClose={() => { if (!busy) { setFormOpen(false); setTarget(null); } }}
        onSubmit={submit}
      />
    </div>
  );
};
