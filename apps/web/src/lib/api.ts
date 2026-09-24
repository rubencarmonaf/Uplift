export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[] | undefined>;

  constructor(status: number, message: string, fieldErrors: ApiError['fieldErrors'] = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type ErrorBody = { message?: string | string[]; errors?: Record<string, string[]> };

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(res.status, message ?? res.statusText, body.errors);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
