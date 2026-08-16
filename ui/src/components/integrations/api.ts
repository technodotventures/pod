/** Tiny fetch helpers used by the connection wizard components. Mirrors
 *  the getJson/postJson helpers in main.tsx but lives in this module so
 *  the new components don't have to be hoisted there. */

function authHeaders(token?: string): HeadersInit {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders(token) });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('coffee-pod-session-expired'));
    throw new Error(`${path} 401 session expired`);
  }
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('coffee-pod-session-expired'));
    throw new Error(`${path} 401 session expired`);
  }
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error((parsed as { message?: string })?.message ?? `${path} ${res.status}`);
  return parsed as T;
}

export async function deleteJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE', headers: authHeaders(token) });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('coffee-pod-session-expired'));
    throw new Error(`${path} 401 session expired`);
  }
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}
