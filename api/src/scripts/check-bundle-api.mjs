import https from 'https';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const html = await get('https://fossilprocure.vercel.app/');
const bundle = html.match(/assets\/index-[^"]+\.js/)?.[0];
if (!bundle) {
  console.log('no bundle found');
  process.exit(1);
}

const js = await get(`https://fossilprocure.vercel.app/${bundle}`);
const urls = [...new Set(js.match(/https?:\/\/[^"']+?\/api/g) || [])];
console.log('Bundle:', bundle);
console.log('API URLs:', urls.length ? urls.join('\n  ') : '(none)');
console.log('localhost:3001:', js.includes('localhost:3001') ? 'YES (bad)' : 'no');
