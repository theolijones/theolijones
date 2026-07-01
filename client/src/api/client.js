const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  };

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401) {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;

  return res.json();
}

export function get(path) {
  return request('GET', path);
}

export function post(path, body) {
  return request('POST', path, body);
}

export function patch(path, body) {
  return request('PATCH', path, body);
}

export function del(path) {
  return request('DELETE', path);
}
