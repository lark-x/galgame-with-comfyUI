import assert from 'node:assert/strict';
import test from 'node:test';
import { checkComfyHealthDirect, sanitizeComfyUrl } from '../src/routes/images.js';
import imagesRouter from '../src/routes/images.js';
import { config } from '../src/config.js';

test('sanitizeComfyUrl masks username and password from URL', () => {
  assert.equal(sanitizeComfyUrl('http://admin:secret123@127.0.0.1:8188/'), 'http://***@127.0.0.1:8188');
  assert.equal(sanitizeComfyUrl('https://user:pass@remote-comfy.example.com/api/'), 'https://***@remote-comfy.example.com/api');
  assert.equal(sanitizeComfyUrl('http://127.0.0.1:8188'), 'http://127.0.0.1:8188');
});

test('checkComfyHealthDirect categorizes success, HTTP errors, timeouts, and network failures', async () => {
  const originalFetch = globalThis.fetch;

  // 1. Success 200 with system_stats
  globalThis.fetch = async () => Response.json({
    devices: [{ name: 'NVIDIA RTX 4090', vram_total: 24 * 1024 * 1024 * 1024 }],
  });
  const okRes = await checkComfyHealthDirect('http://127.0.0.1:8188');
  assert.equal(okRes.connected, true);
  assert.equal(okRes.status, 'online');
  assert.equal(okRes.device, 'NVIDIA RTX 4090');
  assert.equal(okRes.vram_total, 24 * 1024 * 1024 * 1024);

  // 2. HTTP 500 error
  globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });
  const err500 = await checkComfyHealthDirect('http://127.0.0.1:8188');
  assert.equal(err500.connected, false);
  assert.equal(err500.error, 'http_error');
  assert.match(err500.message, /500/);

  // 3. Timeout error
  globalThis.fetch = async () => {
    const err = new Error('The operation was aborted');
    err.name = 'TimeoutError';
    throw err;
  };
  const timeoutRes = await checkComfyHealthDirect('http://127.0.0.1:8188');
  assert.equal(timeoutRes.connected, false);
  assert.equal(timeoutRes.error, 'timeout');
  assert.match(timeoutRes.message, /超时/);

  // 4. TLS error
  globalThis.fetch = async () => {
    const err = new Error('self-signed certificate in certificate chain');
    err.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
    throw err;
  };
  const tlsRes = await checkComfyHealthDirect('https://127.0.0.1:8188');
  assert.equal(tlsRes.connected, false);
  assert.equal(tlsRes.error, 'tls_error');
  assert.match(tlsRes.message, /TLS 证书/);

  // 5. Network unreachable (connection refused)
  globalThis.fetch = async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:8188');
    err.code = 'ECONNREFUSED';
    throw err;
  };
  const netRes = await checkComfyHealthDirect('http://127.0.0.1:8188');
  assert.equal(netRes.connected, false);
  assert.equal(netRes.error, 'network_unreachable');
  assert.match(netRes.message, /未启动或端口不通/);

  globalThis.fetch = originalFetch;
});

test('/comfyui-health route debounces rapid concurrent requests', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async () => {
    fetchCount++;
    return Response.json({ devices: [{ name: 'GPU' }] });
  };

  function invokeHealth() {
    return new Promise((resolve) => {
      const req = { method: 'GET', url: '/comfyui-health', path: '/comfyui-health', headers: {} };
      let statusCode = 200;
      const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { resolve({ status: statusCode, body: payload }); },
        send(payload) { resolve({ status: statusCode, body: payload }); },
      };
      imagesRouter.handle(req, res, () => { resolve({ status: 404 }); });
    });
  }

  try {
    // Fire 5 concurrent requests
    const results = await Promise.all([
      invokeHealth(),
      invokeHealth(),
      invokeHealth(),
      invokeHealth(),
      invokeHealth(),
    ]);

    for (const r of results) {
      assert.equal(r.status, 200);
      assert.equal(r.body.connected, true);
    }
    // Should only have made 1 fetch call thanks to in-flight deduplication
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
