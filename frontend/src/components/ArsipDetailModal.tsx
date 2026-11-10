/**
 * ArsipDetailModal — modal detail arsip (dipakai di ArsipPage & PublicSearchPage).
 * Menampilkan semua field arsip + uraian utuh (wrap text).
 */
import React from 'react';
import { type Status } from '../lib/bindings';

export interface ArsipDetail {
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
  filePath?: string | null;
  created?: string;
  updated?: string;
  lokasi?: string;
}

interface Props {
  detail: ArsipDetail | null;
  onClose: () => void;
  /** Naikkan z-index bila modal detail dibuka di atas modal lain (mis. daftar arsip per lokasi). */
  zIndex?: number;
  onUploadDigital?: (id: string) => void;
  onOpenDigital?: (id: string) => void;
  onDeleteDigital?: (id: string) => void;
  busyDigital?: boolean;
}

const nf = new Intl.NumberFormat('id-ID');

export const ArsipDetailModal: React.FC<Props> = ({ detail, onClose, zIndex, onUploadDigital, onOpenDigital, onDeleteDigital, busyDigital }) => {
  if (!detail) return null;
  const fields: Array<[string, React.ReactNode]> = [
    ['Nomor Arsip', detail.nomor],
    ['Nama Arsip', detail.nama],
    ['Status', (detail.status || '—').replace(/_/g, ' ')],
    ['Unit Kerja', detail.unit],
    ['Kategori', detail.kategori],
    ['Jenis Arsip', detail.jenisName || detail.kategori],
    ['Tanggal Dibuat', detail.tanggal],
    ['Jumlah', `${detail.jumlah ?? 0} ${detail.satuan || ''}`.trim()],
    ['Nilai Anggaran', detail.nilai != null && Number(detail.nilai) !== 0 ? `Rp ${nf.format(Number(detail.nilai))}` : '—'],
    ['Nomor SPM', detail.nomor_spm],
    ['Berkas Digital', detail.berkas ? (detail.filePath ? detail.filePath.split('/').pop() : 'Tersedia') : 'Belum ada'],
    ['Dibuat', detail.created],
    ['Diperbarui', detail.updated],
    ['Lokasi Arsip', detail.lokasi],
  ];

  return (
    <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ backgroundColor: 'rgba(15,23,42,.55)', zIndex: zIndex ?? 1055 }} onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <div className="modal-header" style={{ background: 'var(--surface-2)' }}>
            <div>
              <h5 className="modal-title fw-800 mb-0"><i className="bi bi-file-earmark-text me-2 text-primary"></i>Detail Arsip</h5>
              <div className="text-muted small">{detail.nomor || '—'} · {detail.nama || '—'}</div>
            </div>
            <button type="button" className="btn-close" aria-label="Tutup" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              {fields.map(([label, val]) => (
                <div className="col-md-6" key={String(label)}>
                  <div className="small text-muted fw-700" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                  <div className="fw-600" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{val || '—'}</div>
                </div>
              ))}
            </div>
            {detail.uraian && (
              <div className="mt-3 pt-3 border-top">
                <div className="small text-muted fw-700 mb-1" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Uraian</div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>{detail.uraian}</div>
              </div>
            )}
          </div>
          <div className="modal-footer d-flex flex-wrap gap-2">
            {detail.id && !detail.berkas && (
              <button type="button" className="btn btn-primary rounded-pill px-3" disabled={busyDigital} onClick={() => onUploadDigital?.(detail.id as string)}>
                <i className="bi bi-cloud-upload me-1"></i>{busyDigital ? 'Mengunggah…' : 'Upload Berkas Digital'}
              </button>
            )}
            {detail.id && detail.berkas && (
              <>
                <button type="button" className="btn btn-success rounded-pill px-3" disabled={busyDigital} onClick={() => onOpenDigital?.(detail.id as string)}>
                  <i className="bi bi-eye me-1"></i>Buka Berkas
                </button>
                <button type="button" className="btn btn-outline-danger rounded-pill px-3" disabled={busyDigital} onClick={() => onDeleteDigital?.(detail.id as string)}>
                  <i className="bi bi-trash me-1"></i>Hapus Berkas
                </button>
              </>
            )}
            <button type="button" className="btn btn-outline-secondary rounded-pill px-3 ms-auto" onClick={onClose}><i className="bi bi-x-lg me-1"></i>Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArsipDetailModal;
