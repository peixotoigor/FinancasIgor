const http = require('http');

const data = JSON.stringify({
  message: {
    chat: { id: 123456 },
    text: "Comprei um açaí no valor de 15 reais e ser adiconando no banco de dados da aplicação"
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/telegram-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
