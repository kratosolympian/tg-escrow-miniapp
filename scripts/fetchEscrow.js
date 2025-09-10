import http from 'node:http';

const url = 'http://localhost:3000/buyer/escrow/DEMO123';

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data.slice(0, 800));
  });
}).on('error', (err) => {
  console.error('fetch failed', err.message);
  process.exit(1);
});
