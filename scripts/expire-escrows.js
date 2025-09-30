#!/usr/bin/env node

/**
 * Script to periodically clean up expired escrows
 * Run this script every few minutes using a cron job or task scheduler
 *
 * Usage: node scripts/expire-escrows.js
 */

const fetch = require('node-fetch');

async function expireEscrows() {
  try {
    console.log('Checking for expired escrows...');

    // Call the admin expire-sweep API
    // Note: This requires admin authentication. In production, you might want to
    // call this directly from a server-side cron job with service role key
    const response = await fetch('http://localhost:3001/api/admin/expire-sweep', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add admin authentication here if needed
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Closed ${result.closed} expired escrows`);
    } else {
      console.error('Failed to expire escrows:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Error running expire sweep:', error);
  }
}

// Run immediately
expireEscrows();

// For cron job usage, you can schedule this to run every 5 minutes:
// */5 * * * * /path/to/node /path/to/scripts/expire-escrows.js