/**
 * Test script to verify Claude API connectivity with a sample image analysis.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=your_key node scripts/test-claude.js [image_url]
 *
 * If no image URL is provided, a small test image is generated inline.
 */

import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
  console.error('Usage: ANTHROPIC_API_KEY=your_key node scripts/test-claude.js [image_url]');
  process.exit(1);
}

async function main() {
  const imageUrl = process.argv[2];

  console.log('Creating Anthropic client...');
  const anthropic = new Anthropic();

  const content = [];

  if (imageUrl) {
    console.log(`Fetching test image from: ${imageUrl}`);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
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
      console.log(`Image fetched: ${(buffer.byteLength / 1024).toFixed(1)} KB, type: ${mediaType}`);
    } catch (err) {
      console.error('Failed to fetch image:', err.message);
      console.log('Proceeding with text-only test...');
    }
  } else {
    console.log('No image URL provided — running text-only test.');
  }

  content.push({
    type: 'text',
    text: 'This is a connectivity test. Please respond with a short JSON object: {"status": "ok", "message": "Claude API is working"}',
  });

  console.log('Sending test request to Claude claude-sonnet-4-20250514...');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content }],
    });

    const responseText = message.content[0]?.text || '';
    console.log('\nResponse received:');
    console.log(responseText);
    console.log(`\nModel: ${message.model}`);
    console.log(`Usage: ${message.usage.input_tokens} input tokens, ${message.usage.output_tokens} output tokens`);
    console.log('\nClaude API connectivity test passed.');
  } catch (err) {
    console.error('Claude API request failed:', err.message);
    process.exit(1);
  }
}

main();
