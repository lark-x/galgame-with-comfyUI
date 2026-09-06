import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from '../src/config.js';
import { submitPublicWorkflow, submitWorkflow } from '../src/services/comfyClient.js';

const WORKFLOW = {
  nodes: [
    { id: 1, type: 'PrimitiveString', title: '画面描述', widgets_values: ['a rainy station at dusk'], inputs: [{ name: 'value', widget: { name: 'value' } }] },
    { id: 2, type: 'PrimitiveInt', title: '图片的宽', widgets_values: [768], inputs: [{ name: 'value', widget: { name: 'value' } }] },
    { id: 3, type: 'PrimitiveInt', title: '图片的长', widgets_values: [512], inputs: [{ name: 'value', widget: { name: 'value' } }] },
    { id: 4, type: 'PrimitiveString', title: '画师串', widgets_values: ['@test'], inputs: [{ name: 'value', widget: { name: 'value' } }] },
    { id: 5, type: 'PrimitiveString', title: '质量提示词', widgets_values: ['best quality'], inputs: [{ name: 'value', widget: { name: 'value' } }] },
    { id: 6, type: 'KSampler', widgets_values: [12345, 'fixed', 20, 5, 'euler', 'normal', 1], inputs: [] },
  ],
  links: [],
};

function withManagedImage(t, { fallback = false } = {}) {
  const previous = {
    image: config.publicServices.image,
    imageFallback: config.publicServices.imageFallback,
    appToken: config.publicServices.appToken,
    baseURL: config.publicServices.baseURL,
    generationPurpose: config.publicServices.generationPurpose,
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
    config.publicServices.generationPurpose = previous.generationPurpose;
    globalThis.fetch = previous.fetch;
  });
}

test('public image completion stores central artifact references without downloading bytes', async (t) => {
  withManagedImage(t);
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET', body: init?.body });
    if (url.endsWith('/api/v1/generation/tasks')) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.purpose, 'linshe-chat-image');
      assert.deepEqual(body.inputs, { prompt: 'a rainy station at dusk', width: 768, height: 512, artist: '@test', qualityPrompt: 'best quality' });
      assert.equal('workflow' in body, false);
      return Response.json({ id: 'task-12345678', status: 'accepted' }, { status: 202 });
    }
    if (url.endsWith('/api/v1/generation/tasks/task-12345678')) {
      return Response.json({
        id: 'task-12345678',
        status: 'succeeded',
        artifacts: [{ artifactId: 'artifact-12345678', url: 'https://untrusted.example/leak.png', outputName: 'public.png', contentType: 'image/png', byteSize: 42, mediaKind: 'image' }],
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
    if (url.endsWith('/api/v1/generation/tasks')) {
      return Response.json({ error: 'generation_unavailable' }, { status: 503 });
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
    if (url.endsWith('/api/v1/generation/tasks')) return new Response('{"accepted":true}', { status: 202, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/api/prompt')) directCalls += 1;
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    () => submitWorkflow(WORKFLOW),
    (error) => error.code === 'sthstart_public_protocol_error',
  );
  assert.equal(directCalls, 0);
});

test('a public network failure never uses local ComfyUI even when the legacy fallback flag is set', async (t) => {
  withManagedImage(t, { fallback: false });
  let directCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/generation/tasks')) throw new Error('connect ECONNREFUSED');
    if (url.endsWith('/api/prompt')) directCalls += 1;
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    () => submitWorkflow(WORKFLOW),
    (error) => error.code === 'sthstart_public_unavailable',
  );
  assert.equal(directCalls, 0);
});

test('managed image generation does not silently fall back to local ComfyUI', async (t) => {
  withManagedImage(t, { fallback: true });
  let directCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/generation/tasks')) throw new Error('connect ECONNREFUSED');
    if (url.endsWith('/api/prompt')) directCalls += 1;
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(() => submitWorkflow(WORKFLOW), (error) => error.code === 'sthstart_public_unavailable');
  assert.equal(directCalls, 0);
});

test('a public task lookup failure is marked accepted and cannot be retried as a new task', async (t) => {
  withManagedImage(t);
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/v1/generation/tasks')) {
      return Response.json({ id: 'task-accepted-1', status: 'accepted' }, { status: 202 });
    }
    if (url.endsWith('/api/v1/generation/tasks/task-accepted-1')) {
      return new Response('gateway timeout', { status: 503 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    () => submitPublicWorkflow(WORKFLOW),
    (error) => error.code === 'sthstart_public_task_error' && error.acceptedPublicTask === true,
  );
});
