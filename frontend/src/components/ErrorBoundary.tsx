/**
 * ErrorBoundary — memastikan tidak ada error render React yang
 * menghapus seluruh halaman (blank screen). Jika terjadi, tampilkan
 * fallback panel error dengan tombol kembali ke halaman dashboard.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: undefined };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err?.message };
  }

  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.error('[SIMARC ErrorBoundary]', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container-fluid py-3 py-xl-4">
          <div className="card">
            <div className="card-body text-center p-5">
              <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: '2.5rem' }}></i>
              <h4 className="fw-800 mt-3">Terjadi Kesalahan</h4>
              <p className="text-muted">Halaman tidak dapat ditampilkan. Coba muat ulang halaman.</p>
              <button type="button" className="btn btn-primary rounded-pill px-4" onClick={() => window.location.hash = ''}>
                <i className="bi bi-arrow-left me-1"></i>Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
