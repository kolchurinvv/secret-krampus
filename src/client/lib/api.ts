// Tiny fetch wrapper for the JSON API. Errors carry the server's message.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "include", headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  const res = await fetch(path, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T = { ok: true }>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T = { ok: true }>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T = { ok: true }>(path: string) => request<T>("DELETE", path),
  /** Uploads a single file as multipart field "file". */
  upload: <T = { ok: true; avatarUrl: string }>(path: string, file: Blob, filename = "avatar") => {
    const fd = new FormData();
    fd.append("file", file, filename);
    return request<T>("POST", path, fd);
  },
};
