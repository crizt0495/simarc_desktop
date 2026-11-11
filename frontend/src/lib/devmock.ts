/**
 * devmock — dipakai HANYA saat frontend dibuka di browser biasa
 * (vite dev/preview) tanpa embedding Wails, agar shell & semua halaman
 * bisa diuji visual dengan data contoh. Di dalam aplikasi Wails asli,
 * `window.go` selalu di-inject runtime → shim ini tak pernah aktif.
 */
import type { } from './bindings';

export function installDevMock(): boolean {
  if (typeof window === 'undefined' || (window as any).go) return false;
  const stats = {
    total: 4194, total_items: 11217, aktif: 3129, inaktif: 904,
    siap_penyusutan: 35, musnah: 12, with_file: 1626, without_file: 2568,
    spj: 1143, non_spj: 2987, unclassified: 41, pemberkasan: 128,
  };
  const extras = {
    recentActivities: [
      { userName: 'Administrator', description: 'Menambahkan arsip baru "SK Tim Pembina KORPS Musik Manggala Praja Pemerintahan Kota Probolinggo Sandbox"', action: 'create', createdAt: '06 Feb 2026 09:12' },
      { userName: 'Arsiparis', description: 'Memperbarui lokasi penyimpanan box RC ke A-01-02', action: 'update', createdAt: '06 Feb 2026 08:54' },
      { userName: 'Administrator', description: 'Backup database berhasil dijalankan', action: 'backup', createdAt: '06 Feb 2026 08:30' },
      { userName: 'Arsiparis', description: 'Klasifikasi ulang arsip SPJ tahun 2020', action: 'update', createdAt: '05 Feb 2026 16:41' },
      { userName: 'Administrator', description: 'Membuat berkas pemberkasan baru 2026', action: 'create', createdAt: '05 Feb 2026 15:02' },
    ],
    digitalFile: { with: 1626, without: 2568, percent: 38.77 },
    boxStats: {
      totalRcBoxes: 48, boxMurniSpj: 18, boxMurniNonSpj: 22, boxCampuran: 8,
      rcDigitalPercent: 34, listAll: [], listMurniSpj: [], listMurniNonSpj: [], listCampuran: [],
    },
    forecast: Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i + 1);
      return { month: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), predictedCount: 3600 + i * 140 };
    }),
    observed: [1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
  };
  const arsip = Array.from({ length: 6 }, (_, i) => ({
    id: `a${i}`,
    nomor: `KO39/0${11153210 + i}`,
    nama: 'SK Tim Pembina KORPS Musik Manggala Praja Pemerintah Kota Probolinggo' + (i ? ' ' + (i + 1) : ''),
    uraian: 'Surat No.188.45/137/425.012/2020 dari Walikota Probolinggo tentang pembinaan korps musik kota.',
    status: i % 3 === 0 ? 'aktif' : i % 3 === 1 ? 'inaktif' : 'diberkaskan',
    unit: 'Bagian Pemerintahan',
    unitId: 'unit-1',
    lokasiArsipId: 'lok-1',
    kategori: 'Kawalan Digital SPJ',
    tanggal: `2026-0${(i % 8) + 1}-1${i % 9}`,
    jumlah: i + 2,
    satuan: 'Berkas',
    nilai: i % 2 ? 12500000.5 : null,
    nomor_spm: '',
    berkas: i % 2 === 0,
    created: '2026-02-01 09:00:00',
    updated: '2026-02-05 10:00:00',
  }));
  const opts = {
    unitKerja: [{ id: 'unit-1', name: 'Bagian Pemerintahan' }],
    kodeKlasifikasi: [{ id: 'kl-1', name: 'KEU - Keuangan' }],
    lokasiArsip: [{ id: 'lok-1', name: 'Ruang Record Center Lt. 1' }],
    jenisArsip: [{ id: 'jns-1', name: 'Kawalan Digital SPJ' }],
    pemberkasan: [{ id: 'pem-1', name: 'Berkas 2026' }],
  };
  (window as any).go = {
    main: {
      App: {
        GetStatus: async () => ({ app: 'SIMARC', db_ok: true, os: 'linux', arch: 'amd64' }),
        GetProfile: async () => ({ name: 'Administrator', role: 'Admin' }),
        PingBackend: async () => 'pong @ 00:00:00',
        QuitApp: async () => { document.title = 'quit'; },
        ListArsip: async () => arsip,
        ListArsipDetail: async () => arsip,
        GetDashboardStats: async () => stats,
        GetDashboardExtras: async () => extras,
        GetMasterOptions: async () => opts,
      },
    },
  };
  return true;
}
