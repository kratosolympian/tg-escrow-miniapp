import { chromium } from 'playwright';

// Usage: node scripts/playwright-preview.mjs https://<your-preview-url>
(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/playwright-preview.mjs <preview-url>');
    process.exit(2);
  }

  // Launch a live headed browser so we can observe real browser behavior
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'pragma': 'no-cache',
      'cache-control': 'no-cache'
    }
  });
  const page = await context.newPage();

  const trace = [];

  page.on('request', req => {
    trace.push({ type: 'request', url: req.url(), method: req.method(), headers: req.headers() });
  });
  page.on('response', async res => {
    const text = await res.text().catch(() => '')
    trace.push({ type: 'response', url: res.url(), status: res.status(), headers: res.headers(), bodySnippet: text.slice(0, 1024) });
  });

  // Navigate to preview login page
  // Allow up to 90s for slower preview responses
  await page.goto(`${url}/admin/login`, { waitUntil: 'networkidle', timeout: 90000 });

  // Fill known test admin credentials (super admin provided)
  const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || process.env.ADMIN_EMAIL || ''
  const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD environment variables. Aborting.')
    process.exit(2)
  }
  await page.fill('input[name=email]', ADMIN_EMAIL, { timeout: 90000 });
  await page.fill('input[name=password]', ADMIN_PASSWORD, { timeout: 90000 });

  // Submit form (will use client-side handler since we changed it)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 90000 }).catch(() => null),
    page.click('button[type=submit]')
  ]);

  // Wait a bit
  await page.waitForTimeout(2000);

  await browser.close();

  console.log(JSON.stringify(trace, null, 2));
})();
