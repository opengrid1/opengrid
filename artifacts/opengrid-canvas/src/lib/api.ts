export interface ApiOpts extends RequestInit {
  json?: unknown;
}

export async function apiFetch(path: string, opts: ApiOpts = {}): Promise<Response> {
  const { json, headers, body, ...rest } = opts;
  const h = new Headers(headers);
  let finalBody = body;
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
    finalBody = JSON.stringify(json);
  }
  // credentials:"include" ensures the HttpOnly session cookie rides along
  // even when API and SPA are served from different origins in dev.
  return fetch(path, { ...rest, headers: h, body: finalBody, credentials: "include" });
}

export async function apiJson<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
  const r = await apiFetch(path, opts);
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
    const err = (data && (data as { error?: string }).error) || `HTTP ${r.status}`;
    throw new Error(err);
  }
  return data as T;
}
