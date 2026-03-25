import { ApifyClient } from 'apify-client';
import pool from '../db.js';

// TODO: REPLACE WITH REAL APIFY ACTOR
const DEFAULT_ACTORS = {
  instagram: 'apify/instagram-scraper',
  facebook: 'apify/facebook-posts-scraper',
  tiktok: 'apify/tiktok-scraper',
  x: 'apify/twitter-scraper',
};

/**
 * Scrape the most recent posts for a given social account via Apify.
 *
 * @param {object} socialAccount - Row from social_accounts table
 * @returns {Array<{platform_post_id, caption, post_url, thumbnail_url, posted_at}>}
 */
export async function scrapeSocialAccount(socialAccount) {
  try {
    const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

    const actorId = socialAccount.apify_actor_id || DEFAULT_ACTORS[socialAccount.platform];

    if (!actorId) {
      console.error(`[SCRAPE] No actor ID for platform "${socialAccount.platform}" (account ${socialAccount.id})`);
      return [];
    }

    console.log(
      `[SCRAPE] Starting scrape for @${socialAccount.handle} on ${socialAccount.platform} using actor ${actorId}`,
    );

    // Build platform-specific input
    const input = buildActorInput(socialAccount);

    const run = await client.actor(actorId).call(input, {
      timeoutSecs: 300, // 5 minute timeout
    });

    console.log(`[SCRAPE] Run ${run.id} finished with status ${run.status}`);

    if (run.status !== 'SUCCEEDED') {
      console.error(`[SCRAPE] Run did not succeed: ${run.status}`);
      return [];
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[SCRAPE] Retrieved ${items.length} raw items for @${socialAccount.handle}`);

    const normalized = items.map((item) => normalizePost(item, socialAccount.platform));

    return normalized.filter((p) => p.platform_post_id);
  } catch (err) {
    console.error(`[SCRAPE] Error scraping account ${socialAccount.id} (@${socialAccount.handle}):`, err.message);
    return [];
  }
}

/**
 * Build actor-specific input payload.
 */
function buildActorInput(socialAccount) {
  const { platform, handle } = socialAccount;

  switch (platform) {
    case 'instagram':
      return {
        usernames: [handle],
        resultsLimit: 50,
        resultsType: 'posts',
      };
    case 'facebook':
      return {
        startUrls: [{ url: socialAccount.account_url || `https://facebook.com/${handle}` }],
        resultsLimit: 50,
      };
    case 'tiktok':
      return {
        profiles: [handle],
        resultsPerPage: 50,
        shouldDownloadVideos: false,
      };
    case 'x':
      return {
        handle: [handle],
        maxTweets: 50,
      };
    default:
      return { handle, limit: 50 };
  }
}

/**
 * Normalize a raw Apify result item into our standard post shape.
 */
function normalizePost(item, platform) {
  switch (platform) {
    case 'instagram':
      return {
        platform_post_id: item.id || item.shortCode || '',
        caption: item.caption || '',
        post_url: item.url || (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : ''),
        thumbnail_url: item.displayUrl || item.thumbnailUrl || '',
        posted_at: item.timestamp ? new Date(item.timestamp).toISOString() : null,
      };
    case 'facebook':
      return {
        platform_post_id: item.postId || item.id || '',
        caption: item.text || item.message || '',
        post_url: item.postUrl || item.url || '',
        thumbnail_url: item.imageUrl || item.thumbnailUrl || '',
        posted_at: item.time ? new Date(item.time).toISOString() : null,
      };
    case 'tiktok':
      return {
        platform_post_id: item.id || item.videoId || '',
        caption: item.text || item.desc || '',
        post_url: item.webVideoUrl || item.url || '',
        thumbnail_url: item.coverUrl || item.thumbnailUrl || '',
        posted_at: item.createTime ? new Date(item.createTime * 1000).toISOString() : null,
      };
    case 'x':
      return {
        platform_post_id: item.id || item.id_str || '',
        caption: item.full_text || item.text || '',
        post_url: item.url || '',
        thumbnail_url: item.media?.[0]?.media_url_https || '',
        posted_at: item.created_at ? new Date(item.created_at).toISOString() : null,
      };
    default:
      return {
        platform_post_id: item.id || '',
        caption: item.text || item.caption || '',
        post_url: item.url || '',
        thumbnail_url: item.thumbnailUrl || '',
        posted_at: item.date ? new Date(item.date).toISOString() : null,
      };
  }
}
