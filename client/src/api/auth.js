import { get, post } from './client';

export function login(email, password) {
  return post('/auth/login', { email, password });
}

export function logout() {
  return post('/auth/logout');
}

export function getMe() {
  return get('/auth/me');
}
