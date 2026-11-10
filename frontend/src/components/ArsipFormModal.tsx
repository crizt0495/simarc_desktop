/**
 * ArsipFormModal — form Tambah / Ubah arsip (modul inti SIMARC).
 * Field mengikuti struktur tabel arsip + master data.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FormModal, type FieldDef } from './FormModal';
import { createArsipFull, updateArsip } from '../lib/bindings';
import { useToast } from '../lib/toast';

const STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'inaktif', label: 'Inaktif' },
  { value: 'diberkaskan', label: 'Diberkaskan' },
  { value: 'siap_penyusutan', label: 'Siap Penyusutan' },
  { value: 'musnah', label: 'Musnah' },
  { value: 'permanen', label: 'Permanen' },
];

const toOpts = (arr: any[] | undefined) => (arr ?? []).map((o: any) => ({ value: String(o.id), label: String(o.name ?? o.id) }));

export const ArsipFormModal: React.FC<{
  open: boolean;
  initial?: Record<string, any> | null;
  opts: Record<string, any[]>;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, initial, opts, onClose, onSaved }) => {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial?.id);
  const [jenisId, setJenisId] = useState<string>('');

  useEffect(() => {
    if (open) {
      setJenisId(String((initial as any)?.jenisArsipId ?? ''));
    }
  }, [open]);

  const selectedJenis = ((opts.jenisArsip ?? []) as any[]).find(
    (o) => String(o?.value ?? o?.id ?? '') === String(jenisId),
  ) ?? null;

  const isSpj = (() => {
    const s = `${selectedJenis?.name ?? ''} ${selectedJenis?.kodeJenis ?? ''} ${selectedJenis?.label ?? ''}`.toUpperCase().trim();
    if (!s) return false;
    if (s.startsWith('NON')) return false;
    return s.includes('SPJ');
  })();

  // PENTING: opts dimuat async oleh parent. baseFields WAJIB ikut dihitung
  // ulang saat opts berubah — jika tidak, dropdown tetap kosong karena memo
  // menyimpan opsi dari render pertama (opts masih {}).
  const baseFields: FieldDef[] = useMemo(() => [
    { key: 'nomor', label: 'Nomor Arsip', placeholder: 'Kosongkan untuk dibuat otomatis', help: 'Nomor unik arsip; boleh dikosongkan.' },
    { key: 'nama', label: 'Nama / Identitas Arsip', required: true, placeholder: 'Contoh: SK Pembinaan Kearsipan 2026' },
    { key: 'uraian', label: 'Uraian / Deskripsi', type: 'textarea', rows: 3, placeholder: 'Ringkasan isi arsip…' },
    { key: 'kodeKlasifikasiId', label: 'Kode Klasifikasi', type: 'select', required: true, options: toOpts(opts.kodeKlasifikasi), placeholder: '— Pilih klasifikasi —' },
    { key: 'unitKerjaId', label: 'Unit Kerja', type: 'select', required: true, options: toOpts(opts.unitKerja), placeholder: '— Pilih unit kerja —' },
    { key: 'jenisArsipId', label: 'Kategori / Jenis Arsip', type: 'select', options: toOpts(opts.jenisArsip), placeholder: '— Umum —' },
    { key: 'lokasiArsipId', label: 'Lokasi Penyimpanan', type: 'select', options: toOpts(opts.lokasiArsip), placeholder: '— Belum ditentukan —' },
    { key: 'pemberkasanId', label: 'Berkas Pemberkasan', type: 'select', options: toOpts(opts.pemberkasan), placeholder: '— Tanpa berkas —' },
    { key: 'status', label: 'Status Arsip', type: 'select', options: STATUS_OPTIONS, placeholder: 'Aktif' },
    { key: 'tanggalDibuat', label: 'Tanggal Arsip', type: 'date' },
    { key: 'jumlah', label: 'Jumlah', type: 'number', min: 1, placeholder: '1' },
    { key: 'satuan', label: 'Satuan', placeholder: 'Berkas' },
    { key: 'nilaiAnggaran', label: 'Nilai Anggaran (Rp)', type: 'number', step: '0.01', placeholder: '0' },
    { key: 'nomorSPM', label: 'Nomor SPM', placeholder: 'Opsional' },
    // opts sengaja jadi dependency agar opsi ikut terbarui setelah data dimuat.
  ], [opts]);

  const fields: FieldDef[] = useMemo(() => {
    const spjExtras: FieldDef[] = isSpj
      ? [
          { key: 'nomorSPM', label: 'Nomor SPM', placeholder: 'Nomor SPM terkait arsip' },
          { key: 'nilaiAnggaran', label: 'Nominal Anggaran (Rp)', type: 'number', step: '0.01', placeholder: '0' },
        ]
      : [];
    const core = baseFields.filter((f) => f.key !== 'nomorSPM' && f.key !== 'nilaiAnggaran');
    return [...core, ...spjExtras];
  }, [baseFields, isSpj]);

  const submit = async (v: Record<string, any>) => {
    setBusy(true);
    try {
      const payload = {
        ...v,
        jumlah: v.jumlah ? Number(v.jumlah) : 1,
        nilaiAnggaran: v.nilaiAnggaran ? String(v.nilaiAnggaran) : '',
        status: v.status || 'aktif',
        satuan: v.satuan || 'Berkas',
      };
      if (editing) {
        await updateArsip(String(initial!.id), payload);
        push('success', 'Data arsip berhasil diperbarui');
      } else {
        const res = await createArsipFull(payload);
        push('success', `Arsip ${res?.nomor ?? ''} berhasil ditambahkan`);
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const init = initial
    ? {
        id: initial.id,
        nomor: initial.nomor ?? '',
        nama: initial.nama ?? '',
        uraian: initial.uraian ?? '',
        status: initial.status ?? 'aktif',
        kodeKlasifikasiId: initial.kodeKlasifikasiId ?? '',
        unitKerjaId: initial.unitId ?? initial.unitKerjaId ?? '',
        jenisArsipId: initial.jenisArsipId ?? '',
        pemberkasanId: initial.pemberkasanId ?? '',
        lokasiArsipId: initial.lokasiArsipId ?? '',
        tanggalDibuat: initial.tanggal ?? initial.tanggalDibuat ?? '',
        jumlah: initial.jumlah ?? 1,
        satuan: initial.satuan ?? 'Berkas',
        nilaiAnggaran: initial.nilai ?? '',
        nomorSPM: initial.nomorSPM ?? initial.nomor_spm ?? '',
      }
    : undefined;

  return (
    <FormModal
      open={open}
      title={editing ? 'Ubah Data Arsip' : 'Tambah Arsip Baru'}
      subtitle={editing ? `Perbarui data ${initial?.nomor ?? 'arsip'}` : 'Lengkapi data arsip yang akan disimpan'}
      icon={editing ? 'pencil-square' : 'plus-circle'}
      size="xl"
      fields={fields}
      initial={init}
      busy={busy}
      submitLabel={editing ? 'Simpan Perubahan' : 'Simpan Arsip'}
      onClose={onClose}
      onSubmit={submit}
      onValuesChange={(v) => setJenisId(String(v?.jenisArsipId ?? ''))}
    />
  );
};

export default ArsipFormModal;
