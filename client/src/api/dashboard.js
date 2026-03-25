import { get } from './client';

export function getSummary() {
  return get('/dashboard/summary');
}

export function getLeaderboard() {
  return get('/dashboard/leaderboard');
}

export function getRecent() {
  return get('/dashboard/recent');
}

export function getTimeline() {
  return get('/dashboard/timeline');
}
