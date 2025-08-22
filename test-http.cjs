const http = require('http');

function testHttp() {
  const data = JSON.stringify({
    model: 'qwen2.5-coder:3b',
    prompt: 'hello',
    stream: false
  });

  const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  console.log('Making request...');
  
  const req = http.request(options, (res) => {
    console.log('Got response, status:', res.statusCode);
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Response received, length:', responseData.length);
      console.log('Data:', JSON.parse(responseData));
      process.exit(0);
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
    process.exit(1);
  });

  req.setTimeout(5000, () => {
    console.log('Request timed out');
    req.destroy();
    process.exit(1);
  });

  req.write(data);
  req.end();
}

testHttp();