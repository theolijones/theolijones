import sgMail from '@sendgrid/mail';
import pool from '../db.js';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'alerts@ipsentinel.app';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.ipsentinel.app';

/**
 * Send an immediate alert email for a newly detected infraction.
 * Never throws — errors are logged with [EMAIL] prefix.
 *
 * @param {object} infraction - Row from infractions table
 */
export async function sendImmediateAlert(infraction) {
  try {
    // Fetch post + social account + company details
    const { rows: [detail] } = await pool.query(
      `SELECT
         p.caption, p.post_url, p.thumbnail_url, p.posted_at,
         sa.platform, sa.handle,
         c.name AS company_name, c.id AS company_id
       FROM infractions i
       JOIN posts p ON p.id = i.post_id
       JOIN social_accounts sa ON sa.id = p.social_account_id
       JOIN companies c ON c.id = sa.company_id
       WHERE i.id = $1`,
      [infraction.id],
    );

    if (!detail) {
      console.error(`[EMAIL] Could not find details for infraction ${infraction.id}`);
      return;
    }

    // Get active mailing list recipients
    const { rows: recipients } = await pool.query(
      `SELECT email, name FROM mailing_list WHERE is_active = true`,
    );

    if (recipients.length === 0) {
      console.log('[EMAIL] No active mailing list recipients — skipping alert');
      return;
    }

    const ipTypes = Array.isArray(infraction.detected_ip_types)
      ? infraction.detected_ip_types
      : JSON.parse(infraction.detected_ip_types || '[]');

    const ipTypesStr = ipTypes.join(', ') || 'Unknown IP';
    const subject = `[IP ALERT] ${detail.company_name} — ${detail.platform} — ${ipTypesStr}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">IP Infringement Alert</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 140px;">Company:</td>
              <td style="padding: 8px 0;">${detail.company_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Platform:</td>
              <td style="padding: 8px 0;">${detail.platform} (@${detail.handle})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Detected IP:</td>
              <td style="padding: 8px 0;">${ipTypesStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Confidence:</td>
              <td style="padding: 8px 0;">${Math.round((infraction.confidence_score || 0) * 100)}%</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Post Date:</td>
              <td style="padding: 8px 0;">${detail.posted_at ? new Date(detail.posted_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }) : 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Detected At:</td>
              <td style="padding: 8px 0;">${new Date(infraction.detected_at || Date.now()).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</td>
            </tr>
          </table>

          ${detail.thumbnail_url ? `<div style="margin: 16px 0;"><img src="${detail.thumbnail_url}" alt="Post thumbnail" style="max-width: 100%; border-radius: 4px; border: 1px solid #e5e7eb;" /></div>` : ''}

          ${detail.caption ? `<div style="margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 4px; border-left: 3px solid #6b7280;"><strong>Caption:</strong><br/>${escapeHtml(detail.caption)}</div>` : ''}

          <div style="margin: 16px 0;">
            <strong>Analysis:</strong><br/>
            ${escapeHtml(infraction.analysis_notes || '')}
          </div>

          <div style="margin: 24px 0; text-align: center;">
            ${detail.post_url ? `<a href="${detail.post_url}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-right: 8px;">View Post</a>` : ''}
            <a href="${DASHBOARD_URL}/infractions/${infraction.id}" style="display: inline-block; padding: 10px 20px; background: #059669; color: white; text-decoration: none; border-radius: 6px;">View in Dashboard</a>
          </div>
        </div>
      </div>
    `;

    for (const recipient of recipients) {
      try {
        await sgMail.send({
          to: recipient.email,
          from: FROM_EMAIL,
          subject,
          html,
        });

        // Log to email_alerts table
        await pool.query(
          `INSERT INTO email_alerts (infraction_id, recipient_email, alert_type)
           VALUES ($1, $2, 'immediate')`,
          [infraction.id, recipient.email],
        );

        console.log(`[EMAIL] Immediate alert sent to ${recipient.email} for infraction ${infraction.id}`);
      } catch (sendErr) {
        console.error(`[EMAIL] Failed to send to ${recipient.email}:`, sendErr.message);
      }
    }
  } catch (err) {
    console.error(`[EMAIL] Error sending immediate alert for infraction ${infraction?.id}:`, err.message);
  }
}

/**
 * Send the weekly digest report summarising the past 7 days of infractions.
 * Never throws — errors are logged with [EMAIL] prefix.
 */
export async function sendWeeklyDigest() {
  try {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch infractions from the past 7 days with joins
    const { rows: infractions } = await pool.query(
      `SELECT
         i.*,
         p.caption, p.post_url, p.thumbnail_url, p.posted_at,
         sa.platform, sa.handle,
         c.name AS company_name, c.id AS company_id
       FROM infractions i
       JOIN posts p ON p.id = i.post_id
       JOIN social_accounts sa ON sa.id = p.social_account_id
       JOIN companies c ON c.id = sa.company_id
       WHERE i.detected_at >= $1 AND i.detected_at <= $2
       ORDER BY i.detected_at DESC`,
      [periodStart.toISOString(), periodEnd.toISOString()],
    );

    // Get active mailing list recipients
    const { rows: recipients } = await pool.query(
      `SELECT email, name FROM mailing_list WHERE is_active = true`,
    );

    if (recipients.length === 0) {
      console.log('[EMAIL] No active mailing list recipients — skipping weekly digest');
      return;
    }

    // Group by company
    const byCompany = {};
    for (const inf of infractions) {
      if (!byCompany[inf.company_name]) {
        byCompany[inf.company_name] = [];
      }
      byCompany[inf.company_name].push(inf);
    }

    // Build leaderboard (sorted by count descending)
    const leaderboard = Object.entries(byCompany)
      .map(([name, items]) => ({ name, count: items.length }))
      .sort((a, b) => b.count - a.count);

    // Build HTML
    const subject = `[IP SENTINEL] Weekly Digest — ${periodStart.toLocaleDateString('en-AU')} to ${periodEnd.toLocaleDateString('en-AU')}`;

    const leaderboardRows = leaderboard
      .map((entry, idx) => `<tr><td style="padding:6px 12px;">${idx + 1}</td><td style="padding:6px 12px;">${escapeHtml(entry.name)}</td><td style="padding:6px 12px; text-align:center;">${entry.count}</td></tr>`)
      .join('');

    const summaryTableRows = Object.entries(byCompany)
      .map(([company, items]) => {
        const platforms = [...new Set(items.map((i) => i.platform))].join(', ');
        return `<tr>
          <td style="padding:6px 12px;">${escapeHtml(company)}</td>
          <td style="padding:6px 12px;">${platforms}</td>
          <td style="padding:6px 12px; text-align:center;">${items.length}</td>
          <td style="padding:6px 12px; text-align:center;">${Math.round(items.reduce((s, i) => s + (i.confidence_score || 0), 0) / items.length * 100)}%</td>
        </tr>`;
      })
      .join('');

    const infractionDetailRows = infractions
      .map((inf) => {
        const ipTypes = Array.isArray(inf.detected_ip_types)
          ? inf.detected_ip_types
          : JSON.parse(inf.detected_ip_types || '[]');
        return `<tr>
          <td style="padding:8px; vertical-align:top;">
            ${inf.thumbnail_url ? `<img src="${inf.thumbnail_url}" style="width:80px; border-radius:4px;" />` : '-'}
          </td>
          <td style="padding:8px; vertical-align:top;">${escapeHtml(inf.company_name)}</td>
          <td style="padding:8px; vertical-align:top;">${inf.platform} (@${escapeHtml(inf.handle)})</td>
          <td style="padding:8px; vertical-align:top;">${ipTypes.join(', ')}</td>
          <td style="padding:8px; vertical-align:top;">${Math.round((inf.confidence_score || 0) * 100)}%</td>
          <td style="padding:8px; vertical-align:top;">
            ${inf.post_url ? `<a href="${inf.post_url}">View</a>` : '-'}
          </td>
        </tr>`;
      })
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">IP Sentinel Weekly Digest</h2>
          <p style="margin: 4px 0 0; opacity: 0.9;">${periodStart.toLocaleDateString('en-AU')} — ${periodEnd.toLocaleDateString('en-AU')}</p>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">

          <h3>Summary</h3>
          <p>Total infractions detected: <strong>${infractions.length}</strong></p>
          <p>Companies flagged: <strong>${leaderboard.length}</strong></p>

          <h3>Leaderboard</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding:8px 12px; text-align:left;">#</th>
                <th style="padding:8px 12px; text-align:left;">Company</th>
                <th style="padding:8px 12px; text-align:center;">Infractions</th>
              </tr>
            </thead>
            <tbody>${leaderboardRows || '<tr><td colspan="3" style="padding:12px; text-align:center;">No infractions this period</td></tr>'}</tbody>
          </table>

          <h3>Summary by Company</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding:8px 12px; text-align:left;">Company</th>
                <th style="padding:8px 12px; text-align:left;">Platforms</th>
                <th style="padding:8px 12px; text-align:center;">Count</th>
                <th style="padding:8px 12px; text-align:center;">Avg Confidence</th>
              </tr>
            </thead>
            <tbody>${summaryTableRows || '<tr><td colspan="4" style="padding:12px; text-align:center;">No data</td></tr>'}</tbody>
          </table>

          <h3>All Infractions</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding:8px; text-align:left;">Thumb</th>
                <th style="padding:8px; text-align:left;">Company</th>
                <th style="padding:8px; text-align:left;">Account</th>
                <th style="padding:8px; text-align:left;">IP Detected</th>
                <th style="padding:8px; text-align:center;">Confidence</th>
                <th style="padding:8px; text-align:left;">Link</th>
              </tr>
            </thead>
            <tbody>${infractionDetailRows || '<tr><td colspan="6" style="padding:12px; text-align:center;">No infractions this period</td></tr>'}</tbody>
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <a href="${DASHBOARD_URL}" style="display: inline-block; padding: 10px 24px; background: #1e40af; color: white; text-decoration: none; border-radius: 6px;">Open Dashboard</a>
          </div>
        </div>
      </div>
    `;

    // Store report in reports table
    const reportData = {
      total_infractions: infractions.length,
      companies_flagged: leaderboard.length,
      leaderboard,
      by_company: byCompany,
    };

    const { rows: [report] } = await pool.query(
      `INSERT INTO reports (report_data, period_start, period_end, sent_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [JSON.stringify(reportData), periodStart.toISOString(), periodEnd.toISOString()],
    );

    console.log(`[EMAIL] Weekly report ${report.id} created`);

    // Send to all recipients
    for (const recipient of recipients) {
      try {
        await sgMail.send({
          to: recipient.email,
          from: FROM_EMAIL,
          subject,
          html,
        });

        console.log(`[EMAIL] Weekly digest sent to ${recipient.email}`);
      } catch (sendErr) {
        console.error(`[EMAIL] Failed to send weekly digest to ${recipient.email}:`, sendErr.message);
      }
    }

    // Log email alerts for each infraction x recipient combination
    for (const inf of infractions) {
      for (const recipient of recipients) {
        try {
          await pool.query(
            `INSERT INTO email_alerts (infraction_id, recipient_email, alert_type)
             VALUES ($1, $2, 'weekly')`,
            [inf.id, recipient.email],
          );
        } catch (logErr) {
          // Non-critical — just log
          console.error(`[EMAIL] Failed to log email_alert:`, logErr.message);
        }
      }
    }

    console.log(`[EMAIL] Weekly digest sent to ${recipients.length} recipients`);
  } catch (err) {
    console.error('[EMAIL] Error sending weekly digest:', err.message);
  }
}

/**
 * Escape HTML entities to prevent injection in emails.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
