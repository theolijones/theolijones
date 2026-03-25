import cron from 'node-cron';
import pool from '../db.js';
import { scrapeSocialAccount } from './apifyService.js';
import { processPendingPosts } from './ipAnalysisService.js';
import { sendWeeklyDigest } from './emailService.js';

// ---------------------------------------------------------------------------
// Lock helpers
// ---------------------------------------------------------------------------

async function acquireLock(key) {
  try {
    await pool.query(
      `INSERT INTO job_locks (key, locked_at) VALUES ($1, NOW())`,
      [key],
    );
    return true;
  } catch (err) {
    // Unique constraint violation means the lock is already held
    if (err.code === '23505') {
      console.log(`[SCHEDULER] Lock "${key}" already held — skipping`);
      return false;
    }
    throw err;
  }
}

async function releaseLock(key) {
  await pool.query(`DELETE FROM job_locks WHERE key = $1`, [key]);
}

// ---------------------------------------------------------------------------
// Scrape job logic
// ---------------------------------------------------------------------------

export async function runScrape() {
  const lockKey = 'scrape';
  const acquired = await acquireLock(lockKey);
  if (!acquired) return;

  try {
    console.log('[SCHEDULER] Starting scrape job');

    // Fetch all active social accounts
    const { rows: accounts } = await pool.query(
      `SELECT * FROM social_accounts WHERE is_active = true`,
    );

    console.log(`[SCHEDULER] Found ${accounts.length} active social accounts`);

    for (const account of accounts) {
      try {
        const posts = await scrapeSocialAccount(account);

        console.log(
          `[SCHEDULER] Scraped ${posts.length} posts for @${account.handle} (${account.platform})`,
        );

        let inserted = 0;

        for (const post of posts) {
          if (!post.platform_post_id) continue;

          try {
            // Deduplicate by (social_account_id, platform_post_id)
            await pool.query(
              `INSERT INTO posts (social_account_id, platform_post_id, caption, post_url, thumbnail_url, posted_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (social_account_id, platform_post_id) DO NOTHING`,
              [
                account.id,
                post.platform_post_id,
                post.caption,
                post.post_url,
                post.thumbnail_url,
                post.posted_at,
              ],
            );
            inserted++;
          } catch (insertErr) {
            console.error(
              `[SCHEDULER] Error inserting post ${post.platform_post_id}:`,
              insertErr.message,
            );
          }
        }

        console.log(
          `[SCHEDULER] Inserted/deduplicated ${inserted} posts for @${account.handle}`,
        );
      } catch (accountErr) {
        console.error(
          `[SCHEDULER] Error processing account ${account.id} (@${account.handle}):`,
          accountErr.message,
        );
      }
    }

    // After all scraping, process pending posts through IP analysis
    console.log('[SCHEDULER] Scrape complete — starting IP analysis');
    await processPendingPosts();

    console.log('[SCHEDULER] Scrape job finished');
  } catch (err) {
    console.error('[SCHEDULER] Scrape job error:', err.message);
  } finally {
    await releaseLock(lockKey);
  }
}

// ---------------------------------------------------------------------------
// Weekly report logic
// ---------------------------------------------------------------------------

export async function sendWeeklyReport() {
  try {
    console.log('[SCHEDULER] Starting weekly report');
    await sendWeeklyDigest();
    console.log('[SCHEDULER] Weekly report finished');
  } catch (err) {
    console.error('[SCHEDULER] Weekly report error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Cron scheduler
// ---------------------------------------------------------------------------

export function startScheduler() {
  // Scrape every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('[SCHEDULER] Cron triggered: scrape job');
    await runScrape();
  });

  console.log('[SCHEDULER] Scrape job scheduled: every 4 hours');

  // Weekly report: Monday 8am AEST = Sunday 10pm UTC
  // AEST is UTC+10, so Monday 08:00 AEST = Sunday 22:00 UTC
  cron.schedule('0 22 * * 0', async () => {
    console.log('[SCHEDULER] Cron triggered: weekly report');
    await sendWeeklyReport();
  });

  console.log('[SCHEDULER] Weekly report scheduled: Sunday 22:00 UTC (Monday 08:00 AEST)');
}
