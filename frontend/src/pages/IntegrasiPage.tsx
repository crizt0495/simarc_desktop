/**
 * IntegrasiPage — integrasi Google Drive, sinkronisasi antar-node, dan
 * backup offsite. Juga dipakai untuk menu "Sinkronisasi".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings, getSyncStatus, runSyncNow } from '../lib/bindings';
import { useToast } from '../lib/toast';
import { type PageKey } from '../components/AppSidebar';

const nf = new Intl.NumberFormat('id-ID');

export const IntegrasiPage: React.FC<{ page?: PageKey }> = ({ page }) => {
  const { push } = useToast();
  const [form, setForm] = useState<Record<string, any>>({});
  const [sync, setSync] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'drive' | 'sync' | 'offsite'>(page === 'sinkronisasi' ? 'sync' : 'drive');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([getSettings(), getSyncStatus()]);
      setForm({ ...(s ?? {}), syncHubToken: '', syncHubDbPass: '', offsiteDbPass: '', offsiteS3SecretKey: '' });
      setSync(st ?? {});
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setTab(page === 'sinkronisasi' ? 'sync' : 'drive'); }, [page]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        GOOGLE_DRIVE_CLIENT_ID: form.googleDriveClientId ?? '',
        GOOGLE_DRIVE_FOLDER_ID: form.googleDriveFolderId ?? '',
        SYNC_ENABLED: form.syncEnabled ? 'true' : 'false',
        SYNC_NODE_ID: form.syncNodeId ?? '',
        SYNC_INTERVAL_MINUTES: form.syncInterval ?? '5',
        SYNC_HUB_URL: form.syncHubUrl ?? '',
        OFFSITE_ENABLED: form.offsiteEnabled ? 'true' : 'false',
        OFFSITE_HOUR: form.offsiteHour ?? '2',
        OFFSITE_MINUTE: form.offsiteMinute ?? '0',
      };
      const secretFields: Array<[string, string]> = [
        ['syncHubToken', 'SYNC_HUB_TOKEN'], ['syncHubDbPass', 'SYNC_HUB_DB_PASS'],
        ['offsiteDbPass', 'OFFSITE_DB_PASS'], ['offsiteS3SecretKey', 'OFFSITE_S3_SECRET_KEY'],
      ];
      secretFields.forEach(([k, env]) => { if (String(form[k] ?? '') !== '') payload[env] = String(form[k]); });
      const plainFields: Array<[string, string]> = [
        ['syncHubDbHost', 'SYNC_HUB_DB_HOST'], ['syncHubDbPort', 'SYNC_HUB_DB_PORT'],
        ['syncHubDbName', 'SYNC_HUB_DB_NAME'], ['syncHubDbUser', 'SYNC_HUB_DB_USER'],
        ['syncHubDbTls', 'SYNC_HUB_DB_TLS'],
        ['offsiteDbHost', 'OFFSITE_DB_HOST'], ['offsiteDbPort', 'OFFSITE_DB_PORT'],
        ['offsiteDbName', 'OFFSITE_DB_NAME'], ['offsiteDbUser', 'OFFSITE_DB_USER'],
        ['offsiteDbTls', 'OFFSITE_DB_TLS'],
        ['offsiteS3Endpoint', 'OFFSITE_S3_ENDPOINT'], ['offsiteS3Region', 'OFFSITE_S3_REGION'],
        ['offsiteS3Bucket', 'OFFSITE_S3_BUCKET'], ['offsiteS3AccessKey', 'OFFSITE_S3_ACCESS_KEY'],
        ['offsiteS3Prefix', 'OFFSITE_S3_PREFIX'],
      ];
      plainFields.forEach(([k, env]) => { if (form[k] !== undefined) payload[env] = String(form[k] ?? ''); });
      await saveSettings(payload);
      push('success', 'Konfigurasi integrasi disimpan. Mulai ulang aplikasi agar perubahan aktif.');
      await load();
    } catch (err) {
      push('danger', `Gagal menyimpan: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const doSync = async () => {
    setRunning(true);
    try {
      const res = await runSyncNow();
      push('success', `Sinkronisasi selesai — ${nf.format(Number(res?.pushed ?? 0))} dikirim, ${nf.format(Number(res?.pulled ?? 0))} diterima`);
      await load();
    } catch (e) {
      push('danger', `Sinkronisasi gagal: ${e}`);
    } finally {
      setRunning(false);
    }
  };

  const statusBadge = (ok: boolean, yes: string, no: string) => (
    <span className={`status-badge ${ok ? 'status-aktif' : 'status-inaktif'}`}>{ok ? yes : no}</span>
  );

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="integrasi-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-plug me-2"></i>Integrasi &amp; Sinkronisasi</div>
            <div className="hero-sub">Hubungkan SIMARC dengan Google Drive, node pusat, dan penyimpanan offsite</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.72rem' }} onClick={() => void load()} disabled={loading}>
              <i className="bi bi-arrow-repeat me-1"></i>Muat Ulang
            </button>
            <button type="button" className="btn btn-light btn-sm rounded-pill fw-800 px-3" style={{ fontSize: '0.75rem' }} onClick={() => void doSync()} disabled={running}>
              <i className={`bi ${running ? 'bi-arrow-repeat' : 'bi-arrow-left-right'} me-1`}></i>{running ? 'Menyinkronkan…' : 'Sinkron Sekarang'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.8rem' }}>{error}</div>}

      <div className="row g-2 mb-3 fade-up-d1">
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-blue"><i className="bi bi-arrow-left-right"></i></div><div><div className="stat-mini-value" style={{ fontSize: '0.95rem' }}>{statusBadge(Boolean(sync.enabled), 'Aktif', 'Nonaktif')}</div><div className="stat-mini-label">Sinkronisasi</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-green"><i className="bi bi-cloud-check"></i></div><div><div className="stat-mini-value" style={{ fontSize: '0.95rem' }}>{statusBadge(Boolean(sync.ready), 'Siap', 'Belum')}</div><div className="stat-mini-label">Kesiapan Node</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon icon-amber"><i className="bi bi-hourglass-split"></i></div><div><div className="stat-mini-value">{nf.format(Number(sync.pendingChanges ?? 0))}</div><div className="stat-mini-label">Perubahan Tertunda</div></div></div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-mini"><div className="stat-mini-icon" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><i className="bi bi-clock"></i></div><div><div className="stat-mini-value" style={{ fontSize: '0.95rem' }}>{sync.intervalMinutes ?? '—'} mnt</div><div className="stat-mini-label">Interval</div></div></div>
        </div>
      </div>

      <div className="card fade-up-d1">
        <div className="card-header" style={{ padding: '0.75rem 1.25rem' }}>
          <div className="d-flex gap-2 flex-wrap">
            {([
              ['drive', 'Google Drive', 'google'],
              ['sync', 'Sinkronisasi Node', 'arrow-left-right'],
              ['offsite', 'Offsite Backup', 'cloud-arrow-up'],
            ] as const).map(([key, label, icon]) => (
              <button key={key} type="button" className={`btn btn-sm rounded-pill fw-700 px-3 ${tab === key ? 'btn-primary' : 'btn-outline-primary'}`} style={{ fontSize: '0.72rem' }} onClick={() => setTab(key)}>
                <i className={`bi bi-${icon} me-1`}></i>{label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            {loading ? (
              <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat konfigurasi…</h6></div></div>
            ) : tab === 'drive' ? (
              <div className="row g-3">
                <div className="col-12">
                  <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-info-circle me-1"></i>Buat OAuth Client ID di Google Cloud Console dengan scope Drive, lalu isi folder tujuan penyimpanan berkas digital.
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Google Drive Client ID</label>
                  <input className="form-control form-control-sm" value={form.googleDriveClientId ?? ''} onChange={(e) => set('googleDriveClientId', e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" style={{ fontSize: '0.85rem' }} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Folder ID Tujuan</label>
                  <input className="form-control form-control-sm" value={form.googleDriveFolderId ?? ''} onChange={(e) => set('googleDriveFolderId', e.target.value)} placeholder="1AbC…" style={{ fontSize: '0.85rem' }} />
                </div>
              </div>
            ) : tab === 'sync' ? (
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label d-block">Aktifkan Sinkronisasi</label>
                  <div className="form-check form-switch mt-2">
                    <input className="form-check-input" type="checkbox" id="sync-enabled" checked={Boolean(form.syncEnabled)} onChange={(e) => set('syncEnabled', e.target.checked)} />
                    <label className="form-check-label fw-600" htmlFor="sync-enabled" style={{ fontSize: '0.82rem' }}>Kirim &amp; terima perubahan antar-node</label>
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Node ID</label>
                  <input className="form-control form-control-sm" value={form.syncNodeId ?? ''} onChange={(e) => set('syncNodeId', e.target.value)} placeholder="simpus-01" style={{ fontSize: '0.85rem' }} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Interval (menit)</label>
                  <input className="form-control form-control-sm" type="number" min="1" value={form.syncInterval ?? ''} onChange={(e) => set('syncInterval', e.target.value)} placeholder="5" style={{ fontSize: '0.85rem' }} />
                </div>
                <div className="col-md-8">
                  <label className="form-label">URL Hub</label>
                  <input className="form-control form-control-sm" value={form.syncHubUrl ?? ''} onChange={(e) => set('syncHubUrl', e.target.value)} placeholder="https://hub.simarc.go.id" style={{ fontSize: '0.85rem' }} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Token Hub</label>
                  <input className="form-control form-control-sm" type="password" value={form.syncHubToken ?? ''} onChange={(e) => set('syncHubToken', e.target.value)} placeholder={form.syncHubTokenSet ? '•••••••• (tidak diubah)' : 'Token akses hub'} style={{ fontSize: '0.85rem' }} />
                </div>
                <div className="col-12"><hr className="my-1" /><div className="fw-800 small text-muted">Database Hub (opsional bila sinkron lewat DB langsung)</div></div>
                <div className="col-md-3"><label className="form-label">Host</label><input className="form-control form-control-sm" value={form.syncHubDbHost ?? ''} onChange={(e) => set('syncHubDbHost', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-3"><label className="form-label">Port</label><input className="form-control form-control-sm" value={form.syncHubDbPort ?? ''} onChange={(e) => set('syncHubDbPort', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-3"><label className="form-label">Database</label><input className="form-control form-control-sm" value={form.syncHubDbName ?? ''} onChange={(e) => set('syncHubDbName', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-3"><label className="form-label">User</label><input className="form-control form-control-sm" value={form.syncHubDbUser ?? ''} onChange={(e) => set('syncHubDbUser', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-6"><label className="form-label">Password Hub</label><input className="form-control form-control-sm" type="password" value={form.syncHubDbPass ?? ''} onChange={(e) => set('syncHubDbPass', e.target.value)} placeholder="•••••••• (tidak diubah)" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-6"><label className="form-label">TLS Hub</label><input className="form-control form-control-sm" value={form.syncHubDbTls ?? ''} onChange={(e) => set('syncHubDbTls', e.target.value)} placeholder="true / skip-verify" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-12">
                  <div className="d-flex flex-wrap gap-3 small fw-600">
                    <span>Node: <strong>{sync.nodeId || '—'}</strong></span>
                    <span>Hub: <strong>{sync.hubHost || '—'}</strong></span>
                    <span>Database: <strong>{sync.hubDatabase || '—'}</strong></span>
                    <span>Berjalan: <strong>{sync.running ? 'Ya' : 'Tidak'}</strong></span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label d-block">Aktifkan Offsite Backup</label>
                  <div className="form-check form-switch mt-2">
                    <input className="form-check-input" type="checkbox" id="offsite-enabled" checked={Boolean(form.offsiteEnabled)} onChange={(e) => set('offsiteEnabled', e.target.checked)} />
                    <label className="form-check-label fw-600" htmlFor="offsite-enabled" style={{ fontSize: '0.82rem' }}>Jadwalkan salinan otomatis</label>
                  </div>
                </div>
                <div className="col-md-3"><label className="form-label">Jam</label><input className="form-control form-control-sm" type="number" min="0" max="23" value={form.offsiteHour ?? ''} onChange={(e) => set('offsiteHour', e.target.value)} placeholder="2" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-3"><label className="form-label">Menit</label><input className="form-control form-control-sm" type="number" min="0" max="59" value={form.offsiteMinute ?? ''} onChange={(e) => set('offsiteMinute', e.target.value)} placeholder="0" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-12"><hr className="my-1" /><div className="fw-800 small text-muted">Database Offsite</div></div>
                <div className="col-md-4"><label className="form-label">Host</label><input className="form-control form-control-sm" value={form.offsiteDbHost ?? ''} onChange={(e) => set('offsiteDbHost', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Port</label><input className="form-control form-control-sm" value={form.offsiteDbPort ?? ''} onChange={(e) => set('offsiteDbPort', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Database</label><input className="form-control form-control-sm" value={form.offsiteDbName ?? ''} onChange={(e) => set('offsiteDbName', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">User</label><input className="form-control form-control-sm" value={form.offsiteDbUser ?? ''} onChange={(e) => set('offsiteDbUser', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Password</label><input className="form-control form-control-sm" type="password" value={form.offsiteDbPass ?? ''} onChange={(e) => set('offsiteDbPass', e.target.value)} placeholder="•••••••• (tidak diubah)" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">TLS</label><input className="form-control form-control-sm" value={form.offsiteDbTls ?? ''} onChange={(e) => set('offsiteDbTls', e.target.value)} placeholder="true / skip-verify" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-12"><hr className="my-1" /><div className="fw-800 small text-muted">Object Storage (S3 Compatible)</div></div>
                <div className="col-md-4"><label className="form-label">Endpoint</label><input className="form-control form-control-sm" value={form.offsiteS3Endpoint ?? ''} onChange={(e) => set('offsiteS3Endpoint', e.target.value)} placeholder="https://s3…" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Region</label><input className="form-control form-control-sm" value={form.offsiteS3Region ?? ''} onChange={(e) => set('offsiteS3Region', e.target.value)} placeholder="ap-southeast-1" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Bucket</label><input className="form-control form-control-sm" value={form.offsiteS3Bucket ?? ''} onChange={(e) => set('offsiteS3Bucket', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Access Key</label><input className="form-control form-control-sm" value={form.offsiteS3AccessKey ?? ''} onChange={(e) => set('offsiteS3AccessKey', e.target.value)} style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Secret Key</label><input className="form-control form-control-sm" type="password" value={form.offsiteS3SecretKey ?? ''} onChange={(e) => set('offsiteS3SecretKey', e.target.value)} placeholder="•••••••• (tidak diubah)" style={{ fontSize: '0.85rem' }} /></div>
                <div className="col-md-4"><label className="form-label">Prefix / Folder</label><input className="form-control form-control-sm" value={form.offsiteS3Prefix ?? ''} onChange={(e) => set('offsiteS3Prefix', e.target.value)} placeholder="simarc/backup" style={{ fontSize: '0.85rem' }} /></div>
              </div>
            )}
          </div>
          <div className="card-footer d-flex justify-content-end" style={{ padding: '0.85rem 1.25rem' }}>
            <button type="submit" className="btn btn-primary btn-sm rounded-pill fw-800 px-4" disabled={saving || loading}>
              <i className={`bi ${saving ? 'bi-arrow-repeat' : 'bi-check-lg'} me-1`}></i>{saving ? 'Menyimpan…' : 'Simpan Konfigurasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IntegrasiPage;
