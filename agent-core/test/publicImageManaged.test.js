import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from '../src/config.js';
import { submitPublicWorkflow, submitWorkflow } from '../src/services/comfyClient.js';

const WORKFLOW = { nodes: [], links: [] };

function withManagedImage(t, { fallback = false } = {}) {
  const previous = {
    image: config.publicServices.image,
    imageFallback: config.publicServices.imageFallback,
    appToken: config.publicServices.appToken,
    baseURL: config.publicServices.baseURL,
    fetch: globalThis.fetch,
  };
  config.publicServices.image = true;
  config.publicServices.imageFallback = fallback;
  config.publicServices.appToken = 'linshe-test-app-token';
  config.publicServices.baseURL = 'http://sthstart.test';
  t.after(() => {
    config.publicServices.image = previous.image;
    config.publicServices.imageFallback = previous.imageFallback;
    config.publicServices.appToken = previous.appToken;
    config.publicServices.baseURL = previous.baseURL;
    globalThis.fetch = previous.fetch;
  });
}

test('public image completion stores central artifact references without downloading bytes', async (t) => {
  withManagedImage(t);
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET' });
    if (url.endsWith('/api/v1/images/tasks')) {
      return Response.json({ id: 'task-12345678', status: 'accepted' }, { status: 202 });
    }
    if (url.endsWith('/api/v1/images/tasks/task-12345678')) {
      return Response.json({
        id: 'task-12345678',
        status: 'complete',
        artifacts: [{ id: 'artifact-12345678', url: 'https://untrusted.example/leak.png', filename: 'public.png', content_type: 'image/png', byte_size: 42 }],
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const result = await submitPublicWorkflow(WORKFLOW);
  assert.equal(result.source, 'sthstart-public');
  assert.deepEqual(result.images[0], {
    artifactId: 'artifact-12345678',
    url: '/api/images/artifacts/artifact-12345678',
    contentType: 'image/png',
    filename: 'public.png',
    byteSize: 42,
  });
  assert.deepEqual(calls.map(call => call.method), ['POST', 'GET']);
  assert.equal(calls.some(call => call.url.includes('/artifacts/')), false);
});

test('a public HTTP rejection never falls through to local ComfyUI', async (t) => {
  withManagedImage(t);
  let directCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/images/tasks')) {
      return Response.json({ error: 'image_unavailable' }, { status: 503 });
    }
    if (url.endsWith('/api/prompt')) directCalls += 1;
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    () => submitWorkflow(WORKFLOW),
    (error) => error.code === 'sthstart_public_rejected',
  );
  assert.equal(directCalls, 0);
});

test('a received but malformed public response never falls through to local ComfyUI', async (t) => {
  withManagedImage(t, { fallback: true });
  let directCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/images/tasks')) return new Response('{"accepted":true}', { status: 202, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/api/prompt')) directCalls += 1;
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    () => submitWorkflow(WORKFLOW),
    (error) => error.code === 'sthstart_public_protocol_error',
  );
  assert.equal(directCalls, 0);
});

test('a public network failure does not use local ComfyUI unless the explicit fallback is enabled', async (t) => {
  withManagedImage(t, { fallback: false });
  let directCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/images/tasks')) throw new Error('connect ECONNREFUSED');
    if (url.endsWith('/api/prompt')) directCalls += 1;
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    () => submitWorkflow(WORKFLOW),
    (error) => error.code === 'sthstart_public_unavailable',
  );
  assert.equal(directCalls, 0);
});

test('the temporary pre-acceptance fallback is observable and only applies to a network failure', async (t) => {
  withManagedImage(t, { fallback: true });
  let directCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/images/tasks')) throw new Error('connect ECONNREFUSED');
    if (url.endsWith('/api/prompt')) {
      directCalls += 1;
      return new Response('local ComfyUI unavailable', { status: 503 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(() => submitWorkflow(WORKFLOW), /ComfyUI returned 503/);
  assert.equal(directCalls, 1);
});

test('a public task lookup failure is marked accepted and cannot be retried as a new task', async (t) => {
  withManagedImage(t);
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/images/tasks')) {
      return Response.json({ id: 'task-accepted-1', status: 'accepted' }, { status: 202 });
    }
    if (url.endsWith('/api/v1/images/tasks/task-accepted-1')) {
      return new Response('gateway timeout', { status: 503 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    () => submitPublicWorkflow(WORKFLOW),
    (error) => error.code === 'sthstart_public_task_error' && error.acceptedPublicTask === true,
  );
});
