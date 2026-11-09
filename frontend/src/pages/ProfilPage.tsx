/**
 * ProfilPage — profil pengguna aktif dan keamanan akun.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getProfile, updateProfile, changePassword, type Profile } from '../lib/bindings';
import { useToast } from '../lib/toast';

export const ProfilPage: React.FC = () => {
  const { push } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getProfile();
      setProfile(p);
      setName(String(p?.name ?? ''));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { push('warning', 'Nama tidak boleh kosong'); return; }
    setSavingName(true);
    try {
      const res = await updateProfile(name.trim());
      setProfile((p) => ({ ...(p ?? { name: '', role: 'Pengguna' }), ...(res as any) }));
      push('success', 'Nama profil berhasil diperbarui');
    } catch (err) {
      push('danger', `Gagal memperbarui profil: ${err}`);
    } finally {
      setSavingName(false);
    }
  };

  const savePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass) { push('warning', 'Lengkapi password lama dan baru'); return; }
    if (newPass.length < 6) { push('warning', 'Password baru minimal 6 karakter'); return; }
    if (newPass !== confirmPass) { push('warning', 'Konfirmasi password tidak sama'); return; }
    setSavingPass(true);
    try {
      await changePassword(oldPass, newPass);
      push('success', 'Password berhasil diperbarui');
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (err) {
      push('danger', `Gagal mengganti password: ${err}`);
    } finally {
      setSavingPass(false);
    }
  };

  const initial = (profile?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="container-fluid py-3 py-xl-4">
      <div className="profil-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="hero-title"><i className="bi bi-person-circle me-2"></i>Profil Pengguna</div>
            <div className="hero-sub">Kelola identitas akun dan keamanan kata sandi</div>
          </div>
          <button type="button" className="btn btn-light btn-sm rounded-pill fw-700 px-3" style={{ fontSize: '0.72rem' }} onClick={() => void load()} disabled={loading}>
            <i className="bi bi-arrow-repeat me-1"></i>Muat Ulang
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.8rem' }}>{error}</div>}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100 fade-up-d1">
            <div className="card-body text-center" style={{ padding: '2rem 1.25rem' }}>
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 96, height: 96, background: 'linear-gradient(135deg, var(--brand), var(--brand-2, #6366f1))', color: '#fff', fontSize: '2.4rem', fontWeight: 800, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                {loading ? <i className="bi bi-arrow-repeat" /> : initial}
              </div>
              <h5 className="fw-800 mb-1">{profile?.name || 'Pengguna'}</h5>
              <span className="badge badge-soft-primary mb-3">{profile?.role || 'Pengguna'}</span>
              <div className="small text-muted mb-0">
                <div className="d-flex justify-content-between py-1 border-top"><span>Status akun</span><span className="fw-700">Aktif</span></div>
                <div className="d-flex justify-content-between py-1 border-top"><span>Hak akses</span><span className="fw-700">{profile?.role || 'Pengguna'}</span></div>
                <div className="d-flex justify-content-between py-1 border-top"><span>Mode aplikasi</span><span className="fw-700">Desktop</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card mb-3 fade-up-d1">
            <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
              <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-person-vcard text-primary me-2"></i>Data Profil</h5>
            </div>
            <form onSubmit={saveName}>
              <div className="card-body" style={{ padding: '1.25rem' }}>
                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label">Nama Lengkap</label>
                    <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama pengguna" disabled={loading} style={{ fontSize: '0.85rem' }} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Role</label>
                    <input className="form-control" value={profile?.role || ''} readOnly disabled style={{ fontSize: '0.85rem' }} />
                  </div>
                </div>
              </div>
              <div className="card-footer d-flex justify-content-end" style={{ padding: '0.85rem 1.25rem' }}>
                <button type="submit" className="btn btn-primary btn-sm rounded-pill fw-800 px-4" disabled={savingName || loading}>
                  <i className={`bi ${savingName ? 'bi-arrow-repeat' : 'bi-check-lg'} me-1`}></i>{savingName ? 'Menyimpan…' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          </div>

          <div className="card fade-up-d2">
            <div className="card-header" style={{ padding: '0.85rem 1.25rem' }}>
              <h5 className="fw-800 mb-0" style={{ fontSize: '0.9rem' }}><i className="bi bi-shield-lock text-primary me-2"></i>Ganti Password</h5>
            </div>
            <form onSubmit={savePass}>
              <div className="card-body" style={{ padding: '1.25rem' }}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Password Lama</label>
                    <input className="form-control form-control-sm" type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="••••••••" style={{ fontSize: '0.85rem' }} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Password Baru</label>
                    <input className="form-control form-control-sm" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Minimal 6 karakter" style={{ fontSize: '0.85rem' }} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Konfirmasi Password</label>
                    <input className="form-control form-control-sm" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Ulangi password baru" style={{ fontSize: '0.85rem' }} />
                  </div>
                </div>
              </div>
              <div className="card-footer d-flex justify-content-end" style={{ padding: '0.85rem 1.25rem' }}>
                <button type="submit" className="btn btn-primary btn-sm rounded-pill fw-800 px-4" disabled={savingPass || loading}>
                  <i className={`bi ${savingPass ? 'bi-arrow-repeat' : 'bi-key'} me-1`}></i>{savingPass ? 'Menyimpan…' : 'Perbarui Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilPage;
