const http = require('http');
const https = require('https');

const data = JSON.stringify({
  message: {
    chat: { id: 123456 },
    text: "/start 12345678901234567890"
  }
});

const options = {
  hostname: 'ais-pre-mg2g4jrsjv4rptkchwfcch-405791839851.us-east1.run.app',
  port: 443,
  path: '/api/telegram-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let body = '';
  res.on('data', d => { body += d; });
  res.on('end', () => console.log('Response:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
