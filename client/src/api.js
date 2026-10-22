const BASE = '/api';

/** Error carrying the HTTP status and the server's `{ error }` message (if any). */
async function httpError(res) {
  const text = await res.text().catch(() => '');
  let serverMessage = '';
  try { serverMessage = JSON.parse(text).error || ''; } catch { /* not JSON */ }
  const err = new Error(`${res.status} ${res.statusText}: ${text}`);
  err.status = res.status;
  err.serverMessage = serverMessage;
  return err;
}

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
  if (!res.ok) throw await httpError(res);
  if (res.status === 204) return null;
  return res.json();
}

async function requestBlob(path) {
  const token = localStorage.getItem('auth_token');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.blob();
}

async function postForm(path, formData) {
  const token = localStorage.getItem('auth_token');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: formData });
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
  getBlob: (path) => requestBlob(path),
  postForm: (path, formData) => postForm(path, formData),
};
