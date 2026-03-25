import { post } from './client';

export function scrapeNow() {
  return post('/admin/scrape-now');
}

export function sendWeeklyReport() {
  return post('/admin/send-weekly-report');
}
