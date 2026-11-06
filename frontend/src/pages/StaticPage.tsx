/**
 * StaticPage — shell halaman untuk modul yang datanya belum dibinding.
 * Setiap entri NIRU struktur halaman referensi yang sesuai: hero modul
 * (unit-hero / lokasi-hero / dst. — sesuai kelas enterprise.css) ATAU
 * page-header, tombol aksi kanan-atas yang sama, dan kartu tabel dengan
 * empty-state yang sama. Dibangun dari web/templates/<modul>.
 */
import React from 'react';
import { type PageKey } from '../components/AppSidebar';

export interface ModuleMeta {
  title: string;          // judul yang tampil
  sub: string;            // hero-sub / page-subtitle
  icon: string;           // bi-* icon di judul
  hero?: string;          // kelas hero-module (mis. 'unit-hero')
  action?: { label: string; icon: string };
}

export const MODULE_META: Partial<Record<PageKey, ModuleMeta>> = {
  'unit-kerja': { title: 'Unit Kerja', sub: 'Kelola struktur organisasi dan unit kerja pengelola arsip', icon: 'bi-building', hero: 'unit-hero', action: { label: 'Tambah Unit', icon: 'bi-plus-lg' } },
  'lokasi-arsip': { title: 'Lokasi Arsip', sub: 'Kelola lokasi penyimpanan fisik arsip di lingkungan record center', icon: 'bi-geo-alt', hero: 'lokasi-hero', action: { label: 'Tambah Lokasi', icon: 'bi-plus-lg' } },
  users: { title: 'Pengguna Sistem', sub: 'Kelola akun pengguna dan hak akses sistem kearsipan elektronik', icon: 'bi-people', hero: 'users-hero', action: { label: 'Tambah Pengguna', icon: 'bi-plus-lg' } },
  'kode-klasifikasi': { title: 'Daftar Kode Klasifikasi', sub: 'Kelola kode klasifikasi, retensi, dan keamanan arsip', icon: 'bi-tags', hero: 'kode-hero', action: { label: 'Tambah Kode', icon: 'bi-plus-lg' } },
  'jenis-arsip': { title: 'Jenis Arsip', sub: 'Kelola kategori dan jenis arsip untuk klasifikasi dokumen', icon: 'bi-folder', hero: 'jenis-hero', action: { label: 'Tambah Jenis', icon: 'bi-plus-lg' } },
  pemberkasan: { title: 'Pemberkasan', sub: 'Kelompokkan arsip ke dalam berkas-berkas sesuai dengan sistem pemberkasan', icon: 'bi-folder', hero: 'berkas-hero', action: { label: 'Tambah Berkas', icon: 'bi-plus-lg' } },
  pemusnahan: { title: 'Pemusnahan Arsip', sub: 'Kelola pengajuan pemusnahan arsip. Semua arsip berkategori musnah otomatis tampil di antrean — siap dimusnahkan maupun yang masih berjalan', icon: 'bi-trash3', hero: 'pemusnahan-hero', action: { label: 'Buat Pengajuan', icon: 'bi-plus-lg' } },
  peminjaman: { title: 'Peminjaman Arsip', sub: 'Kelola permohonan peminjaman dan pengembalian arsip', icon: 'bi-journal-check', hero: 'pinjam-hero', action: { label: 'Buat Permohonan', icon: 'bi-plus-lg' } },
  'peminjaman-create': { title: 'Peminjaman Arsip', sub: 'Ajukan permohonan peminjaman arsip record center', icon: 'bi-file-earmark-arrow-up', hero: 'pinjam-hero' },
  pemindahan: { title: 'Pemindahan Arsip', sub: 'Pilih arsip, tentukan lokasi tujuan, dan proses pemindahan secara batch', icon: 'bi-map', hero: 'pindah-hero' },
  'jadwal-retensi': { title: 'Jadwal Retensi Arsip', sub: 'Kelola jadwal pemusnahan, penyusutan, dan review arsip berdasarkan retensi', icon: 'bi-calendar-check', hero: 'retensi-hero', action: { label: 'Buat Jadwal', icon: 'bi-plus-lg' } },
  'monitoring-retensi': { title: 'Monitoring Retensi Arsip', sub: 'Pantau arsip yang masa retensinya akan atau telah berakhir untuk tindak lanjut', icon: 'bi-hourglass-split', hero: 'mon-hero' },
  disposal: { title: 'Dashboard Penyusutan Arsip', sub: 'Sistem otomatis berdasarkan Kode Klasifikasi & Masa Retensi', icon: 'bi-recycle' },
  roles: { title: 'Kontrol Akses & Keamanan', sub: 'Kelola role dan izin akses pengguna untuk menjaga integritas data kearsipan.', icon: 'bi-shield-check', hero: 'role-hero', action: { label: 'Tambah Role', icon: 'bi-plus-lg' } },
  search: { title: 'Hasil Pencarian', sub: 'Temukan arsip dengan kata kunci, kode klasifikasi, unit, atau lokasi', icon: 'bi-search' },
  advanced: { title: 'Analitik Lanjutan', sub: 'Dashboard analitik dan intelijen arsip tingkat lanjut', icon: 'bi-cpu' },
  laporan: { title: 'Dashboard Laporan', sub: 'Ringkasan laporan kearsipan yang siap cetak dan diekspor', icon: 'bi-graph-up' },
  'laporan-arsip': { title: 'Laporan Data Arsip', sub: 'Semua arsip dalam satu laporan siap cetak', icon: 'bi-file-earmark-text' },
  'laporan-digital': { title: 'Laporan Arsip Digital', sub: 'Progres digitalisasi berkas arsip', icon: 'bi-cloud-check' },
  'laporan-pemberkasan': { title: 'Laporan Pemberkasan', sub: 'Rekap berkas dan arsip yang diberkaskan', icon: 'bi-folder' },
  'laporan-lokasi': { title: 'Laporan Arsip per Lokasi', sub: 'Sebaran arsip di setiap lokasi penyimpanan', icon: 'bi-geo-alt' },
  'laporan-klasifikasi': { title: 'Laporan per Kode Klasifikasi', sub: 'Rekap arsip berdasarkan kode klasifikasi', icon: 'bi-tags' },
  'laporan-retensi': { title: 'Laporan Retensi Arsip', sub: 'Arsip dinilai dari masa retensi aktif & inaktif', icon: 'bi-hourglass-split' },
  'laporan-pemusnahan': { title: 'Laporan Pemusnahan Arsip', sub: 'Riwayat dan rencana pemusnahan arsip', icon: 'bi-trash' },
  'log-aktivitas': { title: 'Laporan Aktivitas', sub: 'Log aktivitas petugas pada sistem kearsipan', icon: 'bi-clock-history' },
  statistik: { title: 'Laporan Statistik Arsip', sub: 'Statistik lengkap koleksi arsip record center', icon: 'bi-pie-chart' },
  blockchain: { title: 'Blockchain Explorer', sub: 'Catatan perubahan data anti-manipulasi (hash chain)', icon: 'bi-shield-check' },
  integrasi: { title: 'Integrasi Google Sheet', sub: 'Sinkronkan data arsip dengan Google Spreadsheet', icon: 'bi-table' },
  qrcode: { title: 'QR Code Arsip', sub: 'Cetak dan pindai label QR untuk arsip record center', icon: 'bi-qr-code' },
  'import-export': { title: 'Import / Export', sub: 'Pindahkan data arsip dari dan ke sistem lain', icon: 'bi-arrow-left-right' },
  profil: { title: 'Profil Saya', sub: 'Kelola informasi akun dan keamanan pengguna', icon: 'bi-person-circle' },
  pengaturan: { title: 'Pengaturan', sub: 'Konfigurasi aplikasi, database, dan tampilan', icon: 'bi-gear' },
  backup: { title: 'Backup & Restore', sub: 'Cadangkan dan pulihkan database arsip', icon: 'bi-database' },
  sinkronisasi: { title: 'Sinkronisasi', sub: 'Status database lokal dan replikasi ke server pusat', icon: 'bi-arrow-left-right' },
};

export const StaticPage: React.FC<{ page: PageKey }> = ({ page }) => {
  const meta = MODULE_META[page] ?? { title: 'SIMARC', sub: '', icon: 'bi-archive' };

  const actions = (
    <div className="page-actions">
      {meta.action ? (
        <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }}>
          <i className={`bi ${meta.action.icon} me-1`}></i>{meta.action.label}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="container-fluid py-3 py-xl-4">
      {meta.hero ? (
        <div className={`${meta.hero} mb-3`}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="hero-title"><i className={`bi ${meta.icon} me-2`}></i>{meta.title}</h1>
              <div className="hero-sub">{meta.sub}</div>
            </div>
            {actions}
          </div>
        </div>
      ) : (
        <div className="page-header mb-3">
          <div>
            <h1 className="page-title mb-0"><i className={`bi ${meta.icon} text-brand me-2`}></i>{meta.title}</h1>
            <p className="page-subtitle mb-0">{meta.sub}</p>
          </div>
          {actions}
        </div>
      )}

      <div className="card border-0 shadow-sm fade-up-d1" style={{ border: '1px solid var(--border) !important', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div className="card-body" style={{ padding: '1.25rem' }}>
          <div className="table-responsive">
            <div className="empty-state py-4">
              <i className="bi bi-inbox empty-icon"></i>
              <p className="empty-title">Belum ada data</p>
              <p className="empty-desc">Data modul ini akan tampil di sini setelah backend modul terhubung</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
