const BASE = '/api';

async function request(path, options) {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};
