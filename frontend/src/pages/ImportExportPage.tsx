/**
 * ImportExportPage — pertukaran data arsip via CSV.
 * Ekspor memakai dialog simpan, impor memakai dialog buka. Format kolom CSV
 * mengikuti header: nomor, nama, uraian, status, kode_klasifikasi, unit_kerja,
 * kategori, lokasi, tanggal, jumlah, satuan, nilai, nomor_spm.
 */
import React, { useState } from 'react';
import { exportArsipCSV, importArsipCSV } from '../lib/bindings';
import { useToast } from '../lib/toast';

const nf = new Intl.NumberFormat('id-ID');

const TEMPLATE_HEADER = ['nomor', 'nama', 'uraian', 'status', 'kode_klasifikasi', 'unit_kerja', 'kategori', 'lokasi', 'tanggal', 'jumlah', 'satuan', 'nilai', 'nomor_spm'];

const TEMPLATE_ROWS = [
  ['ARS-2026-001', 'Contoh Arsip', 'Uraian singkat arsip', 'aktif', 'KEU.01', 'Bagian Keuangan', 'SP2D', 'Ruang Record Center Lt. 1', '2026-01-15', '1', 'Berkas', '1500000', '0001/SPM/2026'],
];

const toCsv = (rows: string[][]) => rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

export const ImportExportPage: React.FC = () => {
  const { push } = useToast();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doExport = async () => {
    setBusy('export');
    setError(null);
    try {
      const res = await exportArsipCSV();
      if (res?.cancelled) push('info', 'Ekspor dibatalkan');
      else push('success', `Ekspor selesai — ${nf.format(Number(res?.rows ?? 0))} baris disimpan`);
    } catch (e) {
      setError(String(e));
      push('danger', `Gagal mengekspor: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    setError(null);
    setResult(null);
    try {
      const res = await importArsipCSV();
      if (res?.cancelled) push('info', 'Impor dibatalkan');
      else {
        setResult(res);
        push('success', `Impor selesai — ${nf.format(Number(res?.imported ?? 0))} masuk, ${nf.format(Number(res?.skipped ?? 0))} dilewati`);
      }
    } catch (e) {
      setError(String(e));
      push('danger', `Gagal mengimpor: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = () => {
    const csv = toCsv([TEMPLATE_HEADER, ...TEMPLATE_ROWS]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_arsip.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push('success', 'Template CSV berhasil diunduh');
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="impexp-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-arrow-left-right me-2"></i>Import &amp; Export Data</div>
            <div className="hero-sub">Pindahkan data arsip antar sistem menggunakan berkas CSV</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={downloadTemplate}>
            <i className="bi bi-file-earmark-arrow-down "></i></button>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.8rem' }}>{error}</div>}

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100 fade-up-d1">
            <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
              <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-download text-primary me-2"></i>Export Arsip ke CSV</h5>
            </div>
            <div className="card-body d-flex flex-column" style={{ padding: '1.25rem' }}>
              <p className="small text-muted mb-3">Menyimpan seluruh data arsip ke berkas CSV lengkap dengan nomor, nama, uraian, status, klasifikasi, unit kerja, kategori, lokasi, tanggal, jumlah, nilai, dan nomor SPM.</p>
              <ul className="small text-muted ps-3 mb-4">
                <li>Format file: <strong>CSV</strong> (UTF-8, pemisah koma)</li>
                <li>Semua baris arsip aktif akan disertakan</li>
                <li>Anda memilih sendiri lokasi penyimpanan file</li>
              </ul>
              <button type="button" className="btn btn-primary rounded-pill fw-800 px-4 mt-auto align-self-start" onClick={() => void doExport()} disabled={busy !== null}>
                <i className={`bi ${busy === 'export' ? 'bi-arrow-repeat' : 'bi-file-earmark-excel'} me-1`}></i>{busy === 'export' ? 'Menulis CSV…' : 'Export Sekarang'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100 fade-up-d2">
            <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
              <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-upload text-primary me-2"></i>Import Arsip dari CSV</h5>
            </div>
            <div className="card-body d-flex flex-column" style={{ padding: '1.25rem' }}>
              <p className="small text-muted mb-3">Membaca berkas CSV lalu menambahkan arsip baru. Kolom <strong>nama</strong>, <strong>kode_klasifikasi</strong>, dan <strong>unit_kerja</strong> wajib cocok dengan master data.</p>
              <div className="table-responsive mb-3">
                <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.68rem' }}>
                  <thead className="table-light"><tr>{TEMPLATE_HEADER.slice(0, 6).map((h) => <th key={h} className="fw-800">{h}</th>)}<th className="text-muted">…</th></tr></thead>
                  <tbody><tr>{TEMPLATE_ROWS[0].slice(0, 6).map((c, i) => <td key={i}>{c}</td>)}<td className="text-muted">…</td></tr></tbody>
                </table>
              </div>
              <button type="button" className="btn btn-success rounded-pill fw-800 px-4 mt-auto align-self-start" onClick={() => void doImport()} disabled={busy !== null}>
                <i className={`bi ${busy === 'import' ? 'bi-arrow-repeat' : 'bi-file-earmark-arrow-up'} me-1`}></i>{busy === 'import' ? 'Mengimpor…' : 'Pilih & Import CSV'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="card mt-3 fade-up-d2">
          <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
            <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-clipboard-check text-primary me-2"></i>Hasil Import</h5>
          </div>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div className="row g-2 mb-3">
              <div className="col-6 col-md-3">
                <div className="stat-mini"><div className="stat-mini-icon icon-green"><i className="bi bi-check-circle"></i></div><div><div className="stat-mini-value">{nf.format(Number(result.imported ?? 0))}</div><div className="stat-mini-label">Berhasil</div></div></div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-mini"><div className="stat-mini-icon icon-amber"><i className="bi bi-skip-forward"></i></div><div><div className="stat-mini-value">{nf.format(Number(result.skipped ?? 0))}</div><div className="stat-mini-label">Dilewati</div></div></div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-mini"><div className="stat-mini-icon icon-blue"><i className="bi bi-list-check"></i></div><div><div className="stat-mini-value">{nf.format(Number(result.imported ?? 0) + Number(result.skipped ?? 0))}</div><div className="stat-mini-label">Total Baris</div></div></div>
              </div>
            </div>
            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div>
                <div className="fw-800 small text-danger mb-1"><i className="bi bi-exclamation-triangle me-1"></i>Catatan baris yang dilewati</div>
                <ul className="small text-muted mb-0" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            {(!Array.isArray(result.errors) || result.errors.length === 0) && (
              <div className="alert alert-success py-2 px-3 mb-0" style={{ fontSize: '0.8rem' }}><i className="bi bi-check-circle me-1"></i>Semua baris berhasil diimpor tanpa kendala.</div>
            )}
          </div>
        </div>
      )}

      <div className="card mt-3 fade-up-d2">
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div className="fw-800 small mb-2"><i className="bi bi-info-circle text-primary me-1"></i>Petunjuk singkat</div>
          <ol className="small text-muted mb-0 ps-3">
            <li>Unduh template CSV agar susunan kolom sesuai.</li>
            <li>Isi tiap baris; kolom <code>nama</code> wajib diisi.</li>
            <li>Nilai <code>kode_klasifikasi</code> dan <code>unit_kerja</code> harus sama dengan data master (boleh berupa kode atau nama).</li>
            <li>Simpan sebagai CSV lalu gunakan tombol <strong>Pilih &amp; Import CSV</strong>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ImportExportPage;
