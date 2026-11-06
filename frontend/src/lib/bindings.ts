/**
 * Seluruh komunikasi frontend → backend Golang berjalan lewat modul ini
 * (Wails bindings). Frontend TIDAK PUNYA akses database/http server langsung.
 */
import {
  GetStatus,
  PingBackend,
  ListArsip,
  ListArsipDetail,
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

export async function getDashboardStats(): Promise<Record<string, any>> {
  return (await GetDashboardStats()) as unknown as Record<string, any>;
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
