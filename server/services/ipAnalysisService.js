import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { sendImmediateAlert } from './emailService.js';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an IP compliance analyst for the AFL (Australian Football League) and NRL (National Rugby League).
Your job is to identify whether social media posts from betting companies contain unauthorised use of
AFL or NRL intellectual property.

AFL IP includes: AFL logo, team logos (all 18 clubs), player likenesses/images, game footage,
match scores/statistics presented in a way that implies official partnership, Brownlow Medal imagery,
finals series branding, and any official AFL broadcast graphics.

NRL IP includes: NRL logo, club logos (all 17 teams), player likenesses/images, game footage,
match scores/statistics presented in a way that implies official partnership, State of Origin branding,
finals series branding, and any official NRL broadcast graphics.

Analyse the provided image and caption. Respond ONLY with valid JSON in this exact format:
{
  "contains_ip": true | false,
  "confidence": 0.0-1.0,
  "detected_ip": ["list of specific IP elements found"],
  "league": ["AFL" | "NRL" | both],
  "reasoning": "brief explanation"
}`;

/**
 * Analyse a single post for IP infringement using Claude vision.
 *
 * @param {object} post - Row from posts table
 * @returns {{contains_ip: boolean, confidence: number, detected_ip: string[], league: string|null, reasoning: string}}
 */
export async function analysePost(post) {
  try {
    const content = [];

    // Attempt to fetch and encode the thumbnail image
    if (post.thumbnail_url) {
      try {
        const response = await fetch(post.thumbnail_url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const mediaType = contentType.split(';')[0].trim();

          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          });
        } else {
          console.warn(`[ANALYSE] Could not fetch thumbnail for post ${post.id}: HTTP ${response.status}`);
        }
      } catch (fetchErr) {
        console.warn(`[ANALYSE] Failed to fetch thumbnail for post ${post.id}:`, fetchErr.message);
      }
    }

    // Always include caption as text context
    content.push({
      type: 'text',
      text: `Analyse this social media post for sports IP infringement.\n\nCaption: ${post.caption || '(no caption)'}`,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const responseText = message.content[0]?.text || '{}';

    // Strip potential markdown fences
    const jsonStr = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(jsonStr);

    console.log(
      `[ANALYSE] Post ${post.id}: contains_ip=${result.contains_ip}, confidence=${result.confidence}, league=${result.league}`,
    );

    return {
      contains_ip: !!result.contains_ip,
      confidence: result.confidence ?? 0,
      detected_ip: result.detected_ip || [],
      league: result.league || null,
      reasoning: result.reasoning || '',
    };
  } catch (err) {
    console.error(`[ANALYSE] Error analysing post ${post.id}:`, err.message);
    throw err;
  }
}

/**
 * Process all posts with analysis_status='pending' in batches.
 */
export async function processPendingPosts() {
  try {
    const { rows: pendingPosts } = await pool.query(
      `SELECT p.*, sa.platform, sa.company_id
       FROM posts p
       JOIN social_accounts sa ON sa.id = p.social_account_id
       WHERE p.analysis_status = 'pending'
       ORDER BY p.scraped_at ASC`,
    );

    if (pendingPosts.length === 0) {
      console.log('[ANALYSE] No pending posts to process');
      return;
    }

    console.log(`[ANALYSE] Processing ${pendingPosts.length} pending posts`);

    const BATCH_SIZE = 10;

    for (let i = 0; i < pendingPosts.length; i += BATCH_SIZE) {
      const batch = pendingPosts.slice(i, i + BATCH_SIZE);

      console.log(`[ANALYSE] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} posts)`);

      for (const post of batch) {
        try {
          const result = await analysePost(post);

          if (result.contains_ip && result.confidence >= 0.7) {
            // Create infraction record
            const { rows: [infraction] } = await pool.query(
              `INSERT INTO infractions (post_id, detected_ip_types, confidence_score, analysis_notes)
               VALUES ($1, $2, $3, $4)
               RETURNING *`,
              [post.id, JSON.stringify(result.detected_ip), result.confidence, result.reasoning],
            );

            console.log(`[ANALYSE] Infraction created: id=${infraction.id} for post ${post.id}`);

            // Trigger immediate email alert (fire-and-forget, emailService never throws)
            sendImmediateAlert(infraction);
          }

          await pool.query(
            `UPDATE posts SET analysis_status = 'analysed' WHERE id = $1`,
            [post.id],
          );
        } catch (postErr) {
          console.error(`[ANALYSE] Error processing post ${post.id}:`, postErr.message);
          await pool.query(
            `UPDATE posts SET analysis_status = 'error' WHERE id = $1`,
            [post.id],
          );
        }
      }

      // 1 second delay between batches
      if (i + BATCH_SIZE < pendingPosts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log('[ANALYSE] Finished processing all pending posts');
  } catch (err) {
    console.error('[ANALYSE] Error in processPendingPosts:', err.message);
  }
}
