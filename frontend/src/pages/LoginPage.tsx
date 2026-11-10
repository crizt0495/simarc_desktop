/**
 * LoginPage — halaman login petugas (dipanggil dari tombol "Login" pojok
 * kanan atas landing page). Verifikasi bcrypt via backend App.Login.
 */
import React, { useState } from 'react';
import { login, type Profile } from '../lib/bindings';
import { WindowControls } from '../components/WindowControls';

export interface LoginPageProps {
  onSuccess: (profile: Profile) => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await login(username.trim(), password);
      onSuccess(profile);
    } catch (err) {
      const raw = String(err);
      // Wails membungkus error Go dengan path file — bersihkan pesannya
      const m = raw.match(/([\w-]+(?: [\w-]+)*)$/);
      setError(raw.includes('tidak ditemukan') ? 'Username tidak ditemukan'
        : raw.includes('password salah') ? 'Password salah'
        : m ? m[1] : raw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <WindowControls floating />
      <div className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: '70vh' }}>
        <div className="card shadow-sm" style={{ width: '100%', maxWidth: 420 }}>
          <div className="card-body p-4">
            <div className="text-center mb-4">
              <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white mb-3" style={{ width: 56, height: 56 }}>
                <i className="bi bi-archive-fill" style={{ fontSize: '1.5rem' }}></i>
              </span>
              <h5 className="mb-1">Masuk SIMARC</h5>
              <div className="text-muted small">Akun petugas arsip (bcrypt · tabel users)</div>
            </div>

            {error && (
              <div className="alert alert-danger alert-dismissible small py-2" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>{error}
                <button type="button" className="btn-close btn-sm" aria-label="Tutup" onClick={() => setError(null)}></button>
              </div>
            )}

            <form onSubmit={submit} autoComplete="off">
              <div className="mb-3">
                <label className="form-label small fw-semibold">Username</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-person"></i></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="form-label small fw-semibold">Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-100 rounded-pill py-2" disabled={busy}>
                {busy
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Memeriksa…</>
                  : <><i className="bi bi-box-arrow-in-right me-2"></i>Masuk</>}
              </button>
            </form>

            <div className="text-center mt-3">
              <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={onBack}>
                <i className="bi bi-arrow-left "></i></button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
