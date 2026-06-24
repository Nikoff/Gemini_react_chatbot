const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class APIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string;
  raw?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method, headers = {}, body, token, raw } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...headers,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error || text;
    } catch {}
    throw new APIError(res.status, message);
  }

  if (raw) return res as unknown as T;
  return res.json() as Promise<T>;
}

export function apiStream(path: string, options: { body?: unknown; token?: string } = {}): Promise<Response> {
  const { body, token } = options;
  return api<Response>(path, {
    method: 'POST',
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body,
    token,
    raw: true,
  });
}
