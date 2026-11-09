/**
 * QrCodePage — pembuat label QR arsip.
 * QR dapat dibuat dari data arsip terpilih maupun teks bebas, lalu diunduh
 * sebagai PNG atau dicetak sebagai label.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listArsipDetail, generateQrDataUrl } from '../lib/bindings';
import { useToast } from '../lib/toast';
import SearchableSelect from '../components/SearchableSelect';

const nf = new Intl.NumberFormat('id-ID');

export const QrCodePage: React.FC = () => {
  const { push } = useToast();
  const [arsip, setArsip] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [text, setText] = useState('');
  const [size, setSize] = useState(240);
  const [dataUrl, setDataUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await listArsipDetail();
        if (!cancelled) { setArsip(Array.isArray(r) ? r : []); setError(null); }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return arsip.filter((a) => !needle || [a.nomor, a.nama, a.unit, a.kategori].some((f) => String(f ?? '').toLowerCase().includes(needle))).slice(0, 200);
  }, [arsip, q]);

  const selected = arsip.find((a) => a.id === selectedId) ?? null;

  const pick = (a: any) => {
    setSelectedId(a.id);
    const payload = [
      'SIMARC',
      `Nomor: ${a.nomor || '-'}`,
      `Nama: ${a.nama || '-'}`,
      `Unit: ${a.unit || '-'}`,
      `Klasifikasi: ${a.kategori || '-'}`,
      `Lokasi: ${a.lokasi || '-'}`,
      a.id ? `ID: ${a.id}` : '',
    ].filter(Boolean).join('\n');
    setText(payload);
    setDataUrl('');
  };

  const generate = async () => {
    if (!text.trim()) { push('warning', 'Isi teks QR terlebih dahulu'); return; }
    setBusy(true);
    try {
      const url = await generateQrDataUrl(text.trim(), size);
      setDataUrl(url);
      push('success', 'QR Code berhasil dibuat');
    } catch (e) {
      push('danger', `Gagal membuat QR: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${selected?.nomor || 'simarc'}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const print = () => {
    if (!dataUrl) return;
    const w = window.open('', '_blank', 'width=640,height=720');
    if (!w) { push('warning', 'Popup diblokir oleh sistem'); return; }
    w.document.write(`<!doctype html><html><head><title>Label QR ${selected?.nomor ?? ''}</title><style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}h1{font-size:18px;margin:0 0 4px}p{margin:2px 0;font-size:12px;color:#444}img{width:${size}px;height:${size}px;margin:16px 0}</style></head><body><h1>${selected?.nomor ?? 'SIMARC'}</h1><p>${selected?.nama ?? ''}</p><img src="${dataUrl}" alt="QR" /><p>${selected?.unit ?? ''}</p><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="qrcode-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-qr-code me-2"></i>QR Code Arsip</div>
            <div className="hero-sub">Buat label QR untuk arsip fisik maupun tautan pencarian</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.72rem' }} onClick={download} disabled={!dataUrl}>
              <i className="bi bi-download "></i></button>
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={print} disabled={!dataUrl}>
              <i className="bi bi-printer "></i></button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.8rem' }}>{error}</div>}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card fade-up-d1">
            <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
              <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-list-ul text-primary me-2"></i>Pilih Arsip</h5>
            </div>
            <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
              <div className="search-wrap mb-2">
                <input type="search" className="form-control form-control-sm" placeholder="Cari nomor / nama / unit…" value={q} onChange={(e) => setQ(e.target.value)} />
                <i className="bi bi-search"></i>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {loading ? (
                  <div className="text-center py-4 text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '1.6rem', opacity: 0.3 }}></i>Memuat arsip…</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-4 text-muted small">Tidak ada arsip</div>
                ) : (
                  <table className="table table-sm table-hover mb-0">
                    <thead><tr><th style={{ width: 130 }}>Nomor</th><th>Nama</th><th style={{ width: 140 }}>Unit</th><th style={{ width: 70 }} /></tr></thead>
                    <tbody>
                      {filtered.map((a) => (
                        <tr key={a.id} className={selectedId === a.id ? 'table-active' : ''}>
                          <td><span className="font-monospace fw-700" style={{ fontSize: '0.75rem' }}>{a.nomor || '—'}</span></td>
                          <td><span className="small fw-600">{a.nama}</span></td>
                          <td><span className="small text-muted">{a.unit || '—'}</span></td>
                          <td className="text-end"><button type="button" className="btn btn-sm btn-outline-primary rounded-pill fw-700" style={{ fontSize: '0.65rem' }} onClick={() => pick(a)}>Pilih</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card fade-up-d2">
            <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
              <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-qr-code text-primary me-2"></i>Isi &amp; Pratinjau QR</h5>
            </div>
            <div className="card-body" style={{ padding: '1.25rem' }}>
              <div className="mb-2">
                <label className="form-label">Teks / Data QR</label>
                <textarea className="form-control" rows={5} value={text} onChange={(e) => { setText(e.target.value); setDataUrl(''); }} placeholder="Pilih arsip di samping atau ketik teks bebas…" style={{ fontSize: '0.82rem' }} />
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label">Ukuran (px)</label>
                  <SearchableSelect
                    options={[160, 200, 240, 300, 400, 500].map((s) => ({ value: String(s), label: `${s} px` }))}
                    value={String(size)}
                    onChange={(v) => setSize(Number(v))}
                  />
                </div>
                <div className="col-6 d-flex align-items-end">
                  <button type="button" className="btn btn-primary btn-sm rounded-pill fw-800 w-100" onClick={() => void generate()} disabled={busy}>
                    <i className={`bi ${busy ? 'bi-arrow-repeat' : 'bi-magic'} me-1`}></i>{busy ? 'Membuat…' : 'Buat QR'}
                  </button>
                </div>
              </div>
              <div className="text-center p-3 rounded-3" style={{ background: 'var(--surface-3)', minHeight: 240 }}>
                {dataUrl ? (
                  <img src={dataUrl} alt="QR Code" style={{ width: size, maxWidth: '100%', borderRadius: 8 }} />
                ) : (
                  <div className="text-muted d-flex flex-column align-items-center justify-content-center" style={{ minHeight: 200 }}>
                    <i className="bi bi-qr-code" style={{ fontSize: '3rem', opacity: 0.25 }}></i>
                    <span className="small fw-600 mt-2">Pratinjau QR akan tampil di sini</span>
                  </div>
                )}
              </div>
              {selected && (
                <div className="mt-3 small text-muted">
                  <div className="fw-700 text-truncate">{selected.nama}</div>
                  <div>{selected.nomor} · {selected.unit || '—'}</div>
                  <div>Total arsip tersedia: {nf.format(arsip.length)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QrCodePage;
