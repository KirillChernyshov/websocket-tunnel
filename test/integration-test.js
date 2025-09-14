#!/usr/bin/env node

/**
 * Simple test script to validate the tunnel system
 */

const fetch = require('node-fetch');
const { spawn } = require('child_process');
const path = require('path');

const TEST_CONFIG = {
  SERVER_PORT: 3000,
  WS_PORT: 3001,
  LOCAL_PORT: 8080,
  TEST_TIMEOUT: 30000,
};

class TunnelTester {
  constructor() {
    this.processes = [];
    this.testResults = [];
  }

  log(message) {
    console.log(`[TESTER] ${message}`);
  }

  error(message) {
    console.error(`[TESTER ERROR] ${message}`);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async startProcess(command, args, name) {
    this.log(`Starting ${name}...`);
    
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'test' }
    });

    proc.stdout.on('data', (data) => {
      console.log(`[${name}] ${data.toString().trim()}`);
    });

    proc.stderr.on('data', (data) => {
      console.error(`[${name} ERROR] ${data.toString().trim()}`);
    });

    proc.on('exit', (code) => {
      this.log(`${name} exited with code ${code}`);
    });

    this.processes.push({ proc, name });
    return proc;
  }

  async testRequest(method, path, body = null) {
    const url = `http://localhost:${TEST_CONFIG.SERVER_PORT}${path}`;
    
    this.log(`Testing ${method} ${url}`);
    
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TunnelTester/1.0',
        },
        timeout: 10000,
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const responseBody = await response.text();
      
      const result = {
        method,
        path,
        status: response.status,
        success: response.status >= 200 && response.status < 300,
        body: responseBody,
        timestamp: new Date().toISOString(),
      };

      this.testResults.push(result);
      
      if (result.success) {
        this.log(`✅ ${method} ${path} - ${response.status}`);
      } else {
        this.error(`❌ ${method} ${path} - ${response.status}`);
      }

      return result;
    } catch (error) {
      const result = {
        method,
        path,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };

      this.testResults.push(result);
      this.error(`❌ ${method} ${path} - ${error.message}`);
      return result;
    }
  }

  async runTests() {
    this.log('🚀 Starting tunnel system test...');

    try {
      // Start test server (simulates local application)
      await this.startProcess('npx', ['ts-node', 'test/local-server.ts'], 'LOCAL-SERVER');
      await this.wait(2000);

      // Start tunnel server (simulates work server)
      await this.startProcess('npx', ['ts-node', 'src/server/index.ts'], 'TUNNEL-SERVER');
      await this.wait(3000);

      // Start tunnel client (simulates your PC)
      await this.startProcess('npx', ['ts-node', 'src/client/index.ts'], 'TUNNEL-CLIENT');
      await this.wait(5000);

      this.log('🧪 Running tests...');

      // Test basic connectivity
      await this.testRequest('GET', '/health');
      await this.testRequest('GET', '/status');

      // Test API endpoints
      await this.testRequest('GET', '/api/test');
      await this.testRequest('POST', '/api/echo', { message: 'Hello tunnel!' });
      await this.testRequest('PUT', '/api/data/123', { name: 'Test Item' });
      await this.testRequest('DELETE', '/api/data/123');

      // Test error handling
      await this.testRequest('GET', '/api/error/404');
      await this.testRequest('GET', '/api/error/500');

      // Test slow request
      await this.testRequest('GET', '/api/slow?delay=1000');

      this.log('📊 Test Results:');
      const successful = this.testResults.filter(r => r.success).length;
      const total = this.testResults.length;
      
      console.log(`✅ Successful: ${successful}/${total}`);
      console.log(`❌ Failed: ${total - successful}/${total}`);

      if (successful === total) {
        this.log('🎉 All tests passed!');
      } else {
        this.log('⚠️ Some tests failed. Check the logs above.');
      }

      return successful === total;

    } catch (error) {
      this.error(`Test execution failed: ${error.message}`);
      return false;
    }
  }

  cleanup() {
    this.log('🧹 Cleaning up processes...');
    
    this.processes.forEach(({ proc, name }) => {
      if (proc && !proc.killed) {
        this.log(`Terminating ${name}...`);
        proc.kill('SIGTERM');
        
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 2000);
      }
    });
  }
}

// Run the test
async function runTunnelTest() {
  const tester = new TunnelTester();
  
  // Handle cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted');
    tester.cleanup();
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    tester.cleanup();
    process.exit(1);
  });

  const success = await tester.runTests();
  
  // Wait a bit to see final logs
  await tester.wait(2000);
  
  tester.cleanup();
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  runTunnelTest().catch(error => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = TunnelTester;
