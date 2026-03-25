import { get, post, patch, del } from './client';

export function getUsers() {
  return get('/users');
}

export function createUser(data) {
  return post('/users', data);
}

export function updateUser(id, data) {
  return patch(`/users/${id}`, data);
}

export function deleteUser(id) {
  return del(`/users/${id}`);
}
