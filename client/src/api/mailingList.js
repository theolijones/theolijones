import { get, post, patch, del } from './client';

export function getMailingList() {
  return get('/mailing-list');
}

export function addRecipient(data) {
  return post('/mailing-list', data);
}

export function updateRecipient(id, data) {
  return patch(`/mailing-list/${id}`, data);
}

export function deleteRecipient(id) {
  return del(`/mailing-list/${id}`);
}
