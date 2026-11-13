/**
 * PengaturanPage — pengaturan aplikasi, institusi, database, dan sesi.
 * Nilai disimpan ke file .env milik aplikasi; perubahan koneksi DB aktif
 * setelah aplikasi dimulai ulang.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { appVersion, applyUpdate, getSettings, getUpdateInfo, restartApp, saveSettings, type UpdateInfo } from '../lib/bindings';
import { useToast } from '../lib/toast';
import SearchableSelect from '../components/SearchableSelect';

const nf = new Intl.NumberFormat('id-ID');

type Form = Record<string, any>;

const FIELD_MAP: Record<string, string> = {
  appName: 'APP_NAME',
  timezone: 'APP_TIMEZONE',
  debug: 'APP_DEBUG',
  window: 'SIMARC_WINDOW',
  institution: 'APP_INSTITUTION',
  institutionSub: 'APP_INSTITUTION_SUB',
  address: 'APP_ADDRESS',
  phone: 'APP_PHONE',
  fax: 'APP_FAX',
  email: 'APP_EMAIL',
  web: 'APP_WEB',
  dbHost: 'DB_HOST',
  dbPort: 'DB_PORT',
  dbName: 'DB_DATABASE',
  dbUser: 'DB_USERNAME',
  dbPassword: 'DB_PASSWORD',
  dbTLS: 'DB_TLS',
  dbDriver: 'DB_DRIVER',
  dbPath: 'DB_PATH',
  databaseUrl: 'DATABASE_URL',
  sessionKey: 'SESSION_KEY',
};

export const PengaturanPage: React.FC = () => {
  const { push } = useToast();
  const [form, setForm] = useState<Form>({});
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'app' | 'institution' | 'database' | 'security' | 'update'>('app');

  const [version, setVersion] = useState('');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    appVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  const checkUpdate = useCallback(async () => {
    setChecking(true);
    setUpdateMsg(null);
    try {
      const u = await getUpdateInfo();
      setUpdate(u);
      if (u?.error) setUpdateMsg(`Pemeriksaan gagal: ${u.error}`);
      else if (!u?.hasUpdate) setUpdateMsg(`Aplikasi sudah memakai versi terbaru (v${u?.current ?? version}).`);
    } catch (e) {
      setUpdateMsg(`Pemeriksaan gagal: ${String(e)}`);
    } finally {
      setChecking(false);
    }
  }, [version]);

  const doUpdate = useCallback(async () => {
    if (!update?.downloadURL) return;
    setApplying(true);
    setUpdateMsg(null);
    try {
      const res = await applyUpdate(update.downloadURL, update.sha256 ?? '');
      if (res?.restarting) {
        setUpdateMsg('Pembaruan dipasang. Aplikasi akan dibuka ulang otomatis…');
        return;
      }
      setUpdateMsg('Pembaruan terpasang. Membuka ulang aplikasi…');
      window.setTimeout(() => {
        void restartApp().catch(() => {
          setApplying(false);
          setUpdateMsg('Pembaruan terpasang. Silakan tutup lalu buka lagi aplikasi.');
        });
      }, 900);
    } catch (e) {
      setApplying(false);
      setUpdateMsg(`Gagal memperbarui: ${String(e)}`);
    }
  }, [update]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSettings();
      setMeta(s ?? {});
      setForm({
        ...s,
        dbPassword: '',
        databaseUrl: '',
        sessionKey: '',
        debug: Boolean(s?.debug),
      });
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      Object.entries(FIELD_MAP).forEach(([key, env]) => {
        const v = form[key];
        if (key === 'dbPassword' || key === 'databaseUrl' || key === 'sessionKey') {
          if (v !== undefined && String(v) !== '') payload[env] = String(v);
          return;
        }
        if (key === 'debug') {
          payload[env] = v ? 'true' : 'false';
          return;
        }
        if (v !== undefined) payload[env] = String(v ?? '');
      });
      const res = await saveSettings(payload);
      push('success', `Pengaturan disimpan${res?.restartRequired ? ' — mulai ulang aplikasi agar perubahan database aktif' : ''}`);
      await load();
    } catch (err) {
      push('danger', `Gagal menyimpan pengaturan: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const textField = (key: string, label: string, opts: { type?: string; placeholder?: string; help?: string; col?: number; disabled?: boolean } = {}) => (
    <div className={`col-md-${opts.col ?? 6}`}>
      <label className="form-label">{label}</label>
      <input
        className="form-control form-control-sm"
        type={opts.type ?? 'text'}
        value={form[key] ?? ''}
        placeholder={opts.placeholder}
        disabled={opts.disabled || loading}
        onChange={(e) => set(key, e.target.value)}
        style={{ fontSize: '0.85rem' }}
      />
      {opts.help && <small className="text-muted" style={{ fontSize: '0.7rem' }}>{opts.help}</small>}
    </div>
  );

  const selectField = (key: string, label: string, options: Array<{ value: string; label: string }>, help?: string, col = 6) => (
    <div className={`col-md-${col}`}>
      <label className="form-label">{label}</label>
      <SearchableSelect
        options={options}
        value={String(form[key] ?? '')}
        onChange={(v) => set(key, v)}
        disabled={loading}
        placeholder="— Pilih —"
      />
      {help && <small className="text-muted" style={{ fontSize: '0.7rem' }}>{help}</small>}
    </div>
  );

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="setting-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-gear me-2"></i>Pengaturan Sistem</div>
            <div className="hero-sub">Konfigurasi aplikasi, institusi, database, dan keamanan sesi</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.72rem' }} onClick={() => void load()} disabled={loading}>
            <i className="bi bi-arrow-repeat "></i></button>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.8rem' }}>{error}</div>}

      <div className="card fade-up-d1">
        <div className="card-header" style={{ padding: '0.75rem 1.25rem' }}>
          <div className="d-flex gap-2 flex-wrap">
            {([
              ['app', 'Aplikasi', 'window'],
              ['institution', 'Institusi', 'building'],
              ['database', 'Database', 'database'],
              ['security', 'Keamanan', 'shield-lock'],
              ['update', 'Pembaruan', 'arrow-up-circle'],
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
              <div className="text-center py-5"><div className="text-muted"><i className="bi bi-arrow-repeat d-block mb-2" style={{ fontSize: '2rem', opacity: 0.3 }}></i><h6 className="fw-700">Memuat pengaturan…</h6></div></div>
            ) : (
              <>
                {tab === 'app' && (
                  <div className="row g-3">
                    {textField('appName', 'Nama Aplikasi', { placeholder: 'SIMARC' })}
                    {textField('timezone', 'Zona Waktu', { placeholder: 'Asia/Jakarta', help: 'Contoh: Asia/Jakarta' })}
                    {selectField('window', 'Mode Jendela', [
                      { value: 'normal', label: 'Normal' },
                      { value: 'kiosk', label: 'Kiosk (layar penuh terkunci)' },
                      { value: 'fullscreen', label: 'Fullscreen' },
                    ], 'Mode awal saat aplikasi dibuka')}
                    <div className="col-md-6">
                      <label className="form-label d-block">Mode Debug</label>
                      <div className="form-check form-switch mt-2">
                        <input className="form-check-input" type="checkbox" id="pengaturan-debug" checked={Boolean(form.debug)} onChange={(e) => set('debug', e.target.checked)} />
                        <label className="form-check-label fw-600" htmlFor="pengaturan-debug" style={{ fontSize: '0.82rem' }}>Aktifkan log debug</label>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-info-circle me-1"></i>File konfigurasi: <code>{meta.envFile ?? '.env'}</code>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'institution' && (
                  <div className="row g-3">
                    {textField('institution', 'Nama Institusi', { col: 12, placeholder: 'Pemerintah Daerah …' })}
                    {textField('institutionSub', 'Sub Institusi', { col: 12, placeholder: 'Dinas …' })}
                    {textField('address', 'Alamat', { col: 12, placeholder: 'Jl. …' })}
                    {textField('phone', 'Telepon', { placeholder: '(021) …' })}
                    {textField('fax', 'Fax', { placeholder: '(021) …' })}
                    {textField('email', 'Email', { type: 'email', placeholder: 'arsip@instansi.go.id' })}
                    {textField('web', 'Website', { placeholder: 'https://…' })}
                  </div>
                )}

                {tab === 'database' && (
                  <div className="row g-3">
                    {selectField('dbDriver', 'Driver Database', [
                      { value: 'mysql', label: 'MySQL / TiDB' },
                      { value: 'sqlite', label: 'SQLite (lokal)' },
                    ], 'Perubahan driver memerlukan mulai ulang', 6)}
                    {textField('dbTLS', 'Mode TLS', { placeholder: 'true / skip-verify / false' })}
                    {textField('dbHost', 'Host', { placeholder: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com' })}
                    {textField('dbPort', 'Port', { placeholder: '4000' })}
                    {textField('dbName', 'Nama Database', { placeholder: 'simarc' })}
                    {textField('dbUser', 'Username', { placeholder: 'user.root' })}
                    {textField('dbPassword', 'Password', { type: 'password', placeholder: meta.dbPasswordSet ? '•••••••• (tidak diubah)' : 'Belum diatur', help: 'Isi hanya bila ingin mengganti password' })}
                    {textField('dbPath', 'Path SQLite', { placeholder: './simarc.db', help: 'Hanya dipakai bila driver SQLite' })}
                    {textField('databaseUrl', 'DATABASE_URL', { type: 'password', col: 12, placeholder: meta.databaseUrlSet ? '•••••••• (tidak diubah)' : 'Belum diatur', help: 'Alternatif koneksi penuh; kosongkan bila memakai host/port di atas' })}
                    <div className="col-12">
                      <div className="alert alert-warning py-2 px-3 mb-0" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-triangle me-1"></i>Perubahan koneksi database baru aktif setelah aplikasi dimulai ulang.
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'security' && (
                  <div className="row g-3">
                    {textField('sessionKey', 'SESSION_KEY', { type: 'password', col: 12, placeholder: meta.sessionKeySet ? '•••••••• (tidak diubah)' : 'Belum diatur', help: 'Kunci acak untuk penandatanganan sesi. Isi hanya bila ingin mengganti.' })}
                    <div className="col-12">
                      <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-shield-lock me-1"></i>Gunakan minimal 32 karakter acak untuk kunci sesi. Perubahan berlaku setelah mulai ulang.
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'update' && (
                  <div className="row g-3">
                    <div className="col-12">
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                          <div className="fw-800">Versi terpasang: v{version || '…'}</div>
                          <div className="text-muted small">
                            Pembaruan diambil dari GitHub Releases. Data di TiDB Cloud dan berkas arsip tidak terpengaruh.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm rounded-pill fw-700 px-3"
                          onClick={() => void checkUpdate()}
                          disabled={checking || applying}
                        >
                          <i className={`bi ${checking ? 'bi-arrow-repeat' : 'bi-cloud-arrow-down'} me-1`}></i>
                          {checking ? 'Memeriksa…' : 'Cek pembaruan'}
                        </button>
                      </div>
                    </div>

                    {update?.hasUpdate ? (
                      <div className="col-12">
                        <div className="alert alert-success py-3 px-3 mb-0" style={{ fontSize: '0.82rem' }}>
                          <div className="fw-800"><i className="bi bi-arrow-up-circle me-1"></i>Pembaruan v{update.latest} tersedia</div>
                          {update.notes && (
                            <div className="mt-2" style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
                              {update.notes}
                            </div>
                          )}
                          <div className="text-muted small mt-2">
                            {update.assetName ? `Paket: ${update.assetName}` : 'Paket pembaruan siap diunduh.'}
                          </div>
                          <button
                            type="button"
                            className="btn btn-success btn-sm rounded-pill fw-800 px-4 mt-3"
                            onClick={() => void doUpdate()}
                            disabled={applying || !update.downloadURL}
                          >
                            <i className={`bi ${applying ? 'bi-arrow-repeat' : 'bi-download'} me-1`}></i>
                            {applying ? 'Memperbarui…' : 'Unduh & pasang'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="col-12">
                        <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: '0.8rem' }}>
                          <i className="bi bi-info-circle me-1"></i>
                          {updateMsg ?? 'Klik "Cek pembaruan" untuk memeriksa rilis terbaru.'}
                        </div>
                      </div>
                    )}

                    {update?.hasUpdate && updateMsg && (
                      <div className="col-12">
                        <div className="alert alert-warning py-2 px-3 mb-0" style={{ fontSize: '0.8rem' }}>{updateMsg}</div>
                      </div>
                    )}

                    <div className="col-12">
                      <div className="alert alert-secondary py-2 px-3 mb-0" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-shield-check me-1"></i>
                        Paket diverifikasi dengan SHA-256 sebelum dipasang. Di Linux pemasangan <code>.deb</code> meminta
                        kata sandi administrator; di Windows installer berjalan otomatis tanpa menimpa <code>.env</code> dan <code>storage/</code>.
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="card-footer d-flex justify-content-between align-items-center" style={{ padding: '0.85rem 1.25rem' }}>
            <small className="text-muted fw-600"><i className="bi bi-database-check me-1"></i>{meta.dbName ? `Database: ${meta.dbName}` : 'Konfigurasi lokal'}</small>
            <button type="submit" className="btn btn-primary btn-sm rounded-pill fw-800 px-4" disabled={saving || loading}>
              <i className={`bi ${saving ? 'bi-arrow-repeat' : 'bi-check-lg'} me-1`}></i>{saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>

      <div className="card mt-3 fade-up-d2">
        <div className="card-body d-flex flex-wrap gap-3 justify-content-between align-items-center" style={{ padding: '1rem 1.25rem' }}>
          <div className="small text-muted fw-600">
            <i className="bi bi-info-circle me-1"></i>Jumlah field tersimpan: {nf.format(Object.keys(FIELD_MAP).length)} · File: <code>{meta.envFile ?? '.env'}</code>
          </div>
          <div className="d-flex gap-2">
            <span className={`status-badge ${meta.dbPasswordSet ? 'status-aktif' : 'status-inaktif'}`}>Password DB: {meta.dbPasswordSet ? 'diatur' : 'belum'}</span>
            <span className={`status-badge ${meta.sessionKeySet ? 'status-aktif' : 'status-inaktif'}`}>Session Key: {meta.sessionKeySet ? 'diatur' : 'belum'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PengaturanPage;
