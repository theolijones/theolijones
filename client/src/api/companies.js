import { get, post, patch, del } from './client';

export function getCompanies() {
  return get('/companies');
}

export function createCompany(data) {
  return post('/companies', data);
}

export function updateCompany(id, data) {
  return patch(`/companies/${id}`, data);
}

export function deleteCompany(id) {
  return del(`/companies/${id}`);
}

export function getAccounts(companyId) {
  return get(`/companies/${companyId}/accounts`);
}

export function createAccount(companyId, data) {
  return post(`/companies/${companyId}/accounts`, data);
}

export function deleteAccount(accountId) {
  return del(`/accounts/${accountId}`);
}

export function toggleAccount(accountId, is_active) {
  return patch(`/accounts/${accountId}`, { is_active });
}
