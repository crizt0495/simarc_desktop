/**
 * Seluruh komunikasi frontend → backend Golang berjalan lewat modul ini
 * (Wails bindings). Frontend TIDAK PUNYA akses database/http server langsung.
 */
import {
  GetStatus,
  PingBackend,
  ListArsip,
  ListArsipDetail,
  ListPeminjaman,
  ListPemberkasan,
  ListPemusnahan,
  ListPenyusutan,
  ListRetensiExpiring,
  ListActivityLogs,
  ListUsers,
  GetArsipGrowth,
  GetBlockchainVerify,
  ListRoles,
  CreatePeminjaman,
  CreateArsip,
  GetDashboardStats,
  GetDashboardExtras,
  GetMasterOptions,
  GetProfile,
} from '../../wailsjs/go/main/App';

export type Status = {
  app: string; db_ok: boolean; os: string; arch: string;
};

export type Profile = {
  name: string; role: string;
};

export async function getStatus(): Promise<Status> {
  return (await GetStatus()) as unknown as Status;
}

export async function pingBackend(): Promise<string> {
  return (await PingBackend()) as unknown as string;
}

export async function listArsip(): Promise<any[]> {
  return (await ListArsip()) as unknown as any[];
}

export async function listArsipDetail(): Promise<any[]> {
  return (await ListArsipDetail()) as unknown as any[];
}

export async function listPeminjaman(): Promise<any[]> {
  return (await ListPeminjaman()) as unknown as any[];
}

export async function listPemberkasan(): Promise<any[]> {
  return (await ListPemberkasan()) as unknown as any[];
}

export async function listPemusnahan(): Promise<any[]> {
  return (await ListPemusnahan()) as unknown as any[];
}

export async function listPenyusutan(): Promise<any[]> {
  return (await ListPenyusutan()) as unknown as any[];
}

export async function listRetensiExpiring(days: number): Promise<any[]> {
  return (await ListRetensiExpiring(days)) as unknown as any[];
}

export async function listRoles(): Promise<any[]> {
  return (await ListRoles()) as unknown as any[];
}

export async function listActivityLogs(): Promise<any[]> {
  return (await ListActivityLogs()) as unknown as any[];
}

export async function listUsers(): Promise<any[]> {
  return (await ListUsers()) as unknown as any[];
}

export async function createPeminjaman(arsipId: string, userId: string, keperluan: string, tanggalPinjam: string, tanggalKembaliRencana: string): Promise<Record<string, any>> {
  return (await CreatePeminjaman(arsipId, userId, keperluan, tanggalPinjam, tanggalKembaliRencana)) as unknown as Record<string, any>;
}

export async function createArsip(nomor: string, nama: string, uraian: string, status: string, kelas: string, unit: string, lokasi: string, nilai: string): Promise<Record<string, any>> {
  return (await CreateArsip(nomor, nama, uraian, status, kelas, unit, lokasi, nilai)) as unknown as Record<string, any>;
}

export async function getDashboardStats(): Promise<Record<string, any>> {
  return (await GetDashboardStats()) as unknown as Record<string, any>;
}

export async function getArsipGrowth(): Promise<Array<Record<string, any>>> {
  return (await GetArsipGrowth()) as unknown as Array<Record<string, any>>;
}

export async function getBlockchainVerify(): Promise<Record<string, any>> {
  return (await GetBlockchainVerify()) as unknown as Record<string, any>;
}

export async function getDashboardExtras(): Promise<Record<string, any>> {
  return (await GetDashboardExtras()) as unknown as Record<string, any>;
}

export async function getMasterOptions(): Promise<Record<string, any[]>> {
  return (await GetMasterOptions()) as unknown as Record<string, any[]>;
}

export async function getProfile(): Promise<Profile> {
  return (await GetProfile()) as unknown as Profile;
}

/* ── Autentikasi (backend App.Login/Logout; dibedakan pakai window.go
      agar tidak bergantung pada wailsjs hasil generasi lama) ── */
export async function login(username: string, password: string): Promise<Profile> {
  const goApp = (window as any)?.go?.main?.App;
  if (!goApp?.Login) throw new Error('binding Login tidak tersedia');
  return (await goApp.Login(username, password)) as unknown as Profile;
}

export async function logout(): Promise<void> {
  const goApp = (window as any)?.go?.main?.App;
  if (goApp?.Logout) await goApp.Logout();
}
