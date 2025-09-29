const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'playwright-output');
const reqPath = path.join(OUT, 'requests.json');
const resPath = path.join(OUT, 'responses.json');
const outPath = path.join(OUT, 'failing-responses.json');

if (!fs.existsSync(reqPath) || !fs.existsSync(resPath)) {
  console.error('Missing requests.json or responses.json in', OUT);
  process.exit(1);
}

const requests = JSON.parse(fs.readFileSync(reqPath, 'utf8')) || [];
const responses = JSON.parse(fs.readFileSync(resPath, 'utf8')) || [];

// Build a map from url+method -> last request headers
const reqMap = new Map();
for (const r of requests) {
  const key = `${r.method || 'GET'}::${r.url}`;
  reqMap.set(key, r.headers || {});
}

const fails = [];
for (const resp of responses) {
  if (!resp || typeof resp.status !== 'number') continue;
  if (resp.status >= 400) {
    // Try to find request by matching method (assume GET unless response suggests otherwise)
    const possibleMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    let foundReqHeaders = null;
    for (const m of possibleMethods) {
      const key = `${m}::${resp.url}`;
      if (reqMap.has(key)) { foundReqHeaders = reqMap.get(key); break; }
    }
    // fallback: find any request with same url
    if (!foundReqHeaders) {
      const anyReq = requests.find(r => r.url === resp.url);
      if (anyReq) foundReqHeaders = anyReq.headers || {};
    }

    fails.push({ url: resp.url, status: resp.status, responseHeaders: resp.headers || {}, requestHeaders: foundReqHeaders || null, body: resp.body || null, text: resp.text || null });
  }
}

fs.writeFileSync(outPath, JSON.stringify(fails, null, 2));
console.log('Wrote', outPath, 'with', fails.length, 'entries');
if (fails.length > 0) {
  for (let i=0;i<Math.min(10,fails.length);i++) {
    const f = fails[i];
    console.log(i+1, f.status, f.url, 'Cookie present in request headers?', f.requestHeaders && (f.requestHeaders.cookie || f.requestHeaders.Cookie) ? 'yes' : 'no');
  }
}
