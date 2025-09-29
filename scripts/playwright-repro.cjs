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
    logs.push({ type: 'console', text: msg.text(), location: msg.location() });
    console.log('[PAGE CONSOLE]', msg.type(), msg.text());
  });

  const requests = [];
  page.on('request', req => {
    requests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType(), headers: req.headers() });
  });

  const responses = [];
  page.on('response', async resp => {
    try {
      const ct = resp.headers()['content-type'] || '';
      const url = resp.url();
      let body = null;
      let text = null
      try {
        text = await resp.text()
      } catch(e) { text = null }
      // Try to parse JSON if applicable
      if (ct.includes('application/json')) {
        try { body = JSON.parse(text) } catch (e) { body = null }
      }
      // Truncate text to avoid huge files
      const MAX = 16 * 1024
      const truncatedText = (text && text.length > MAX) ? text.slice(0, MAX) + '\n...[truncated]' : text
      responses.push({ url, status: resp.status(), headers: resp.headers(), body, text: truncatedText });
    } catch(e) {}
  });

  try {
    // Use dev sign-in helper to get a buyer session cookie
    const buyerEmail = 'buy@kratos.ng';
    console.log('Calling dev sign-in for', buyerEmail)
    const signinResp = await page.request.post('http://localhost:3000/api/dev/signin', {
      data: { email: buyerEmail }
    });
    const signinJson = await signinResp.json().catch(()=>null);
    console.log('dev signin status', signinResp.status(), signinJson)

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

    console.log('Saved artifacts to', OUT)
  } catch (e) {
    console.error('Repro script error', e)
  } finally {
    // keep browser open for inspection, but also close context
    // await browser.close();
    console.log('Done — leaving browser open for manual inspection (close to finish).')
  }
})();
