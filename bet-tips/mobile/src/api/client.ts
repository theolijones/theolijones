import Constants from "expo-constants";
import { storage } from "../auth/storage";

const BASE =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "";

if (!BASE) console.warn("apiUrl not set in app.json extra.");

interface RequestOpts {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const doFetch = async (
  path: string,
  opts: RequestOpts,
  accessToken: string | null
): Promise<Response> => {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.auth && accessToken) headers["authorization"] = `Bearer ${accessToken}`;
  return fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
};

const refresh = async (): Promise<boolean> => {
  const rt = await storage.getRefresh();
  if (!rt) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) {
    await storage.clear();
    return false;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  await storage.set(data.accessToken, data.refreshToken);
  return true;
};

export const api = async <T>(path: string, opts: RequestOpts = {}): Promise<T> => {
  const useAuth = opts.auth !== false;
  const access = await storage.getAccess();
  let res = await doFetch(path, { ...opts, auth: useAuth }, access);
  // The API Gateway HTTP authorizer returns 403 (not 401) when the JWT is
  // expired or invalid; treat both as "needs refresh" signals.
  if ((res.status === 401 || res.status === 403) && useAuth && (await refresh())) {
    const newAccess = await storage.getAccess();
    res = await doFetch(path, { ...opts, auth: useAuth }, newAccess);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
};
