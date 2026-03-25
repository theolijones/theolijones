/**
 * Test script to verify Apify API connectivity.
 *
 * Usage:
 *   APIFY_API_TOKEN=your_token node scripts/test-apify.js
 */

import { ApifyClient } from 'apify-client';

const token = process.env.APIFY_API_TOKEN;

if (!token) {
  console.error('ERROR: APIFY_API_TOKEN environment variable is not set.');
  console.error('Usage: APIFY_API_TOKEN=your_token node scripts/test-apify.js');
  process.exit(1);
}

async function main() {
  console.log('Creating ApifyClient...');
  const client = new ApifyClient({ token });

  console.log('Fetching user info to verify connectivity...');
  try {
    const user = await client.user().get();
    console.log('Connected successfully!');
    console.log(`  Username: ${user.username}`);
    console.log(`  Email:    ${user.email}`);
    console.log(`  Plan:     ${user.plan?.id || 'unknown'}`);
  } catch (err) {
    console.error('Failed to connect to Apify API:', err.message);
    process.exit(1);
  }

  // List available actors (just first 5)
  console.log('\nListing recent actors...');
  try {
    const { items } = await client.actors().list({ limit: 5 });
    if (items.length === 0) {
      console.log('  No actors found in your account.');
    } else {
      for (const actor of items) {
        console.log(`  - ${actor.name} (${actor.id})`);
      }
    }
  } catch (err) {
    console.warn('Could not list actors:', err.message);
  }

  console.log('\nApify connectivity test passed.');
}

main();
