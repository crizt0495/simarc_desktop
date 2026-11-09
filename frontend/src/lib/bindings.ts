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

export async function createArsip(nomor: string, nama: string, uraian: string, status: string, kelas: string, unit: string, lokasi: string, nilai: number): Promise<Record<string, any>> {
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

/* ── Modul lengkap (dipanggil dinamis lewat window.go agar tidak
      bergantung pada hasil generate wailsjs) ─────────────────────────── */
const goApp = (): any => (window as any)?.go?.main?.App;

async function call<T>(name: string, ...args: any[]): Promise<T> {
  const app = goApp();
  if (!app?.[name]) throw new Error(`binding ${name} tidak tersedia`);
  return (await app[name](...args)) as T;
}

export const createArsipFull = (input: Record<string, any>) => call<Record<string, any>>('CreateArsipFull', input);
export const updateArsip = (id: string, input: Record<string, any>) => call<Record<string, any>>('UpdateArsip', id, input);
export const deleteArsip = (id: string) => call<void>('DeleteArsip', id);
export const moveArsip = (ids: string[], lokasiId: string) => call<Record<string, any>>('MoveArsip', ids, lokasiId);

export const saveUnitKerja = (id: string, nama: string) => call<Record<string, any>>('SaveUnitKerja', id, nama);
export const deleteUnitKerja = (id: string) => call<void>('DeleteUnitKerja', id);
export const saveLokasiArsip = (input: Record<string, any>) => call<Record<string, any>>('SaveLokasiArsip', input);
export const deleteLokasiArsip = (id: string) => call<void>('DeleteLokasiArsip', id);
export const saveKodeKlasifikasi = (input: Record<string, any>) => call<Record<string, any>>('SaveKodeKlasifikasi', input);
export const deleteKodeKlasifikasi = (id: string) => call<void>('DeleteKodeKlasifikasi', id);
export const saveJenisArsip = (input: Record<string, any>) => call<Record<string, any>>('SaveJenisArsip', input);
export const deleteJenisArsip = (id: string) => call<void>('DeleteJenisArsip', id);
export const saveRole = (input: Record<string, any>) => call<Record<string, any>>('SaveRole', input);
export const deleteRole = (id: string) => call<void>('DeleteRole', id);
export const saveUser = (input: Record<string, any>) => call<Record<string, any>>('SaveUser', input);
export const deleteUser = (id: string) => call<void>('DeleteUser', id);

export const savePemberkasan = (input: Record<string, any>) => call<Record<string, any>>('SavePemberkasan', input);
export const deletePemberkasan = (id: string) => call<void>('DeletePemberkasan', id);
export const assignArsipToPemberkasan = (ids: string[], pemberkasanId: string) => call<Record<string, any>>('AssignArsipToPemberkasan', ids, pemberkasanId);
export const updatePeminjamanStatus = (id: string, status: string, catatan: string) => call<void>('UpdatePeminjamanStatus', id, status, catatan);
export const createPeminjamanFull = (input: Record<string, any>) => call<Record<string, any>>('CreatePeminjamanFull', input);
export const createPemusnahan = (ids: string[], namaKegiatan: string, alasan: string) => call<Record<string, any>>('CreatePemusnahan', ids, namaKegiatan, alasan);
export const updatePemusnahanStatus = (id: string, status: string, catatan: string) => call<void>('UpdatePemusnahanStatus', id, status, catatan);

export const listJadwalRetensi = () => call<any[]>('ListJadwalRetensi');
export const saveJadwalRetensi = (input: Record<string, any>) => call<Record<string, any>>('SaveJadwalRetensi', input);
export const deleteJadwalRetensi = (id: string) => call<void>('DeleteJadwalRetensi', id);
export const prosesJadwalRetensi = (id: string) => call<Record<string, any>>('ProsesJadwalRetensi', id);

export const getSettings = () => call<Record<string, any>>('GetSettings');
export const saveSettings = (updates: Record<string, any>) => call<Record<string, any>>('SaveSettings', updates);
export const getSyncStatus = () => call<Record<string, any>>('GetSyncStatus');
export const runSyncNow = () => call<Record<string, any>>('RunSyncNow');

export const listBackupLogs = () => call<any[]>('ListBackupLogs');
export const createBackup = () => call<Record<string, any>>('CreateBackup');
export const restoreBackup = () => call<Record<string, any>>('RestoreBackup');
export const exportArsipCSV = () => call<Record<string, any>>('ExportArsipCSV');
export const importArsipCSV = () => call<Record<string, any>>('ImportArsipCSV');

export const generateQrDataUrl = (text: string, size = 220) => call<string>('GenerateQrDataURL', text, size);
export const extractOcrFromFile = () => call<Record<string, any>>('ExtractOcrFromFile');
export const updateProfile = (name: string) => call<Record<string, any>>('UpdateProfile', name);
export const changePassword = (oldPassword: string, newPassword: string) => call<void>('ChangePassword', oldPassword, newPassword);
export const getArsipWindowStats = () => call<Record<string, any>>('GetArsipWindowStats');
export const queryArsipLaporan = (unitId: string, kodeId: string, lokasiId: string, status: string) => call<any[]>('QueryArsipLaporan', unitId, kodeId, lokasiId, status);
