const BASE = import.meta.env.VITE_API_URL as string | undefined;
if (!BASE) console.warn("VITE_API_URL is not set.");

const ACCESS_KEY = "bettips.admin.access";
const REFRESH_KEY = "bettips.admin.refresh";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

const doFetch = async (path: string, opts: RequestOpts, accessToken: string | null): Promise<Response> => {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.auth && accessToken) headers["authorization"] = `Bearer ${accessToken}`;
  return fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
};

const refreshAccess = async (): Promise<boolean> => {
  const rt = tokens.refresh;
  if (!rt) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) {
    tokens.clear();
    return false;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  tokens.set(data.accessToken, data.refreshToken);
  return true;
};

export const api = async <T>(path: string, opts: RequestOpts = {}): Promise<T> => {
  const useAuth = opts.auth !== false;
  let res = await doFetch(path, { ...opts, auth: useAuth }, tokens.access);
  if (res.status === 401 && useAuth && (await refreshAccess())) {
    res = await doFetch(path, { ...opts, auth: useAuth }, tokens.access);
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
