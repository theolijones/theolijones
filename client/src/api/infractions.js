import { get, patch } from './client';

export function getInfractions(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      query.set(k, v);
    }
  });
  const qs = query.toString();
  return get(`/infractions${qs ? `?${qs}` : ''}`);
}

export function getInfraction(id) {
  return get(`/infractions/${id}`);
}

export function dismissInfraction(id, reason) {
  return patch(`/infractions/${id}/dismiss`, { reason });
}
