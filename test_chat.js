// Test script for chat API
const http = require('http');

function testChat(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ message: message });
    
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ reply: body });
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  const testCases = [
    'divorce',
    'dowry',
    'domestic violence',
    'sexual harassment',
    'maternity leave',
    'how to file police complaint',
    'what is domestic violence'
  ];

  console.log('Testing Chat API...\n');
  
  for (const msg of testCases) {
    console.log(`Testing: "${msg}"`);
    try {
      const result = await testChat(msg);
      console.log('Response:', result.reply ? result.reply.substring(0, 100) + '...' : 'No response');
      console.log('---');
    } catch (err) {
      console.log('Error:', err.message);
      console.log('---');
    }
  }
}

runTests();
