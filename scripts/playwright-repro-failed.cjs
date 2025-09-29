const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const OUT = path.join(__dirname, 'playwright-output')
  try { fs.mkdirSync(OUT) } catch(e){}

  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push({ type: 'console', text: msg.text(), location: msg.location(), timestamp: Date.now() });
    console.log('[PAGE CONSOLE]', msg.type(), msg.text());
  });

  const requests = [];
  page.on('request', req => {
    requests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType(), headers: req.headers(), timestamp: Date.now() });
  });

  const responses = [];
  page.on('response', async resp => {
    try {
      const ct = resp.headers()['content-type'] || '';
      const url = resp.url();
      let text = null
      try { text = await resp.text() } catch(e) { text = null }
      const MAX = 16 * 1024
      const truncatedText = (text && text.length > MAX) ? text.slice(0, MAX) + '\n...[truncated]' : text
      responses.push({ url, status: resp.status(), headers: resp.headers(), text: truncatedText, timestamp: Date.now() });
    } catch(e) {}
  });

  const failed = [];
  page.on('requestfailed', req => {
    try {
      failed.push({ url: req.url(), method: req.method(), resourceType: req.resourceType(), failure: req.failure()?.errorText || null, headers: req.headers(), timestamp: Date.now() });
      console.log('[REQUEST FAILED]', req.method(), req.url(), req.failure() && req.failure().errorText)
    } catch (e) { console.error('requestfailed handling error', e) }
  });

  try {
    // Ensure we are on the app origin first so relative fetch() calls work and cookies can be set
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    // Use dev sign-in helper inside the page so the browser stores httpOnly cookies
    const buyerEmail = 'buy@kratos.ng';
    console.log('Calling in-page dev sign-in for', buyerEmail)
    const signinResult = await page.evaluate(async (email) => {
      try {
        const resp = await fetch('/api/dev/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const j = await resp.json().catch(() => null);
        return { status: resp.status, json: j };
      } catch (e) {
        return { status: 0, error: String(e) };
      }
    }, buyerEmail);
    console.log('dev signin result (in-page)', signinResult)
    // wait a short moment for cookies to be set
    await page.waitForTimeout(250);

    // navigate to escrow page
    const code = 'MG171MFW7GRE'
    const url = `http://localhost:3000/buyer/escrow/${code}`
    console.log('Navigating to', url)
    await page.goto(url, { waitUntil: 'networkidle' });

    // wait a bit to allow realtime subscriptions and nav-instrument logging
    await page.waitForTimeout(5000);

    // take screenshot
    const shot = path.join(OUT, 'escrow-page.png')
    await page.screenshot({ path: shot, fullPage: true })

    // save logs and network traces
    fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(logs, null, 2));
    fs.writeFileSync(path.join(OUT, 'requests.json'), JSON.stringify(requests, null, 2));
    fs.writeFileSync(path.join(OUT, 'responses.json'), JSON.stringify(responses, null, 2));
    fs.writeFileSync(path.join(OUT, 'responses-detailed.json'), JSON.stringify(responses, null, 2));
    fs.writeFileSync(path.join(OUT, 'failed-requests.json'), JSON.stringify(failed, null, 2));

    console.log('Saved artifacts to', OUT)
  } catch (e) {
    console.error('Repro script error', e)
  } finally {
    console.log('Done — leaving browser open for manual inspection (close to finish).')
  }
})();
