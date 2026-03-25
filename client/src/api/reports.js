import { get } from './client';

export function getReports() {
  return get('/reports');
}

export function getReport(id) {
  return get(`/reports/${id}`);
}
