import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { config, getPublicLlmStatus, getLlmConfig } from '../src/config.js';
import configRouter from '../src/routes/config.js';
import { chatSync, resetClient } from '../src/llm/llm-client.js';

test('getPublicLlmStatus returns disabled status when publicServices.llm is false', async () => {
  const prevLlm = config.publicServices.llm;
  config.publicServices.llm = false;
  try {
    const status = await getPublicLlmStatus();
    assert.equal(status.managed, false);
    assert.equal(status.connected, false);
    assert.equal(status.ready, false);
  } finally {
    config.publicServices.llm = prevLlm;
  }
});

test('getPublicLlmStatus fetches status from SthStart when publicServices.llm is true', async () => {
  const prevLlm = config.publicServices.llm;
  const prevToken = config.publicServices.appToken;
  const prevBase = config.publicServices.baseURL;
  const originalFetch = globalThis.fetch;

  config.publicServices.llm = true;
  config.publicServices.appToken = 'test-token-123';
  config.publicServices.baseURL = 'http://127.0.0.1:4100';

  try {
    let capturedAuth = '';
    globalThis.fetch = async (input, init) => {
      capturedAuth = init?.headers?.Authorization || '';
      return Response.json({
        app: { id: 'linshe', name: '邻舍' },
        llm: {
          text: { profileId: 'deepseek-chat', name: 'DeepSeek Chat', model: 'deepseek-v4-flash', ready: true, updatedAt: '2026-08-26T00:00:00.000Z' },
          multimodal: null,
          ready: false,
        },
      });
    };

    const status = await getPublicLlmStatus();
    assert.equal(status.managed, true);
    assert.equal(status.connected, true);
    assert.equal(status.status, 'connected');
    assert.equal(status.ready, false);
    assert.equal(status.text?.model, 'deepseek-v4-flash');
    assert.equal(capturedAuth, 'Bearer test-token-123');

    // Test SthStart unreachable
    globalThis.fetch = async () => { throw new Error('Connection refused'); };
    const unreachableStatus = await getPublicLlmStatus();
    assert.equal(unreachableStatus.managed, true);
    assert.equal(unreachableStatus.connected, false);
    assert.equal(unreachableStatus.status, 'unreachable');
    assert.match(unreachableStatus.error, /Connection refused/);
    assert.equal(unreachableStatus.ready, false);
  } finally {
    globalThis.fetch = originalFetch;
    config.publicServices.llm = prevLlm;
    config.publicServices.appToken = prevToken;
    config.publicServices.baseURL = prevBase;
  }
});

test('managed mode rejects local LLM config mutations with 403 llm_managed_by_sthstart', async () => {
  const prevLlm = config.publicServices.llm;
  config.publicServices.llm = true;

  function invoke(method, path, body = {}) {
    return new Promise((resolve) => {
      const req = {
        method,
        url: path,
        originalUrl: path,
        path,
        params: {},
        body,
        headers: { 'content-type': 'application/json' },
      };
      let statusCode = 200;
      const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { resolve({ status: statusCode, body: payload }); },
        send(payload) { resolve({ status: statusCode, body: payload }); },
      };
      configRouter.handle(req, res, () => {
        resolve({ status: 404, body: { error: 'not_found' } });
      });
    });
  }

  try {
    const putLlm = await invoke('PUT', '/llm', { model: 'gpt-4' });
    assert.equal(putLlm.status, 403);
    assert.equal(putLlm.body.error, 'llm_managed_by_sthstart');

    const putFreeEgg = await invoke('PUT', '/llm/free-egg', { enabled: true });
    assert.equal(putFreeEgg.status, 403);
    assert.equal(putFreeEgg.body.error, 'llm_managed_by_sthstart');

    const getKey = await invoke('GET', '/llm/key');
    assert.equal(getKey.status, 403);
    assert.equal(getKey.body.error, 'llm_managed_by_sthstart');

    const postModels = await invoke('POST', '/llm/models', { baseURL: 'https://api.test' });
    assert.equal(postModels.status, 403);
    assert.equal(postModels.body.error, 'llm_managed_by_sthstart');

    const postProfile = await invoke('POST', '/llm/profiles', { name: 'New' });
    assert.equal(postProfile.status, 403);
    assert.equal(postProfile.body.error, 'llm_managed_by_sthstart');

    const delProfile = await invoke('DELETE', '/llm/profiles/p1');
    assert.equal(delProfile.status, 403);
    assert.equal(delProfile.body.error, 'llm_managed_by_sthstart');

    const actProfile = await invoke('POST', '/llm/profiles/p1/activate');
    assert.equal(actProfile.status, 403);
    assert.equal(actProfile.body.error, 'llm_managed_by_sthstart');

    const syncProfile = await invoke('PUT', '/llm/profiles/active/sync');
    assert.equal(syncProfile.status, 403);
    assert.equal(syncProfile.body.error, 'llm_managed_by_sthstart');
  } finally {
    config.publicServices.llm = prevLlm;
  }
});

test('LLM call in managed mode sends request to SthStart gateway and does not inject local thinking/extraBody', async () => {
  const prevLlm = config.publicServices.llm;
  const prevToken = config.publicServices.appToken;
  const prevBase = config.publicServices.baseURL;
  const prevExtra = config.llm.extraBody;
  const prevThinking = config.llm.thinkingMode;
  const originalFetch = globalThis.fetch;

  config.publicServices.llm = true;
  config.publicServices.appToken = 'app-secret-token';
  config.publicServices.baseURL = 'http://127.0.0.1:4100';
  config.llm.extraBody = { local_extra_param: 'must_not_leak' };
  config.llm.thinkingMode = 'enabled';

  resetClient();

  let capturedUrl = '';
  let capturedBody = null;

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body));
    return Response.json({
      choices: [{ message: { role: 'assistant', content: 'managed response' } }],
    });
  };

  try {
    const result = await chatSync([{ role: 'user', content: 'hello' }], { label: 'test-managed' });
    assert.equal(result, 'managed response');
    assert.match(capturedUrl, /127.0.0.1:4100\/v1\/chat\/completions/);
    assert.equal(capturedBody.local_extra_param, undefined);
    assert.equal(capturedBody.thinking, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    config.publicServices.llm = prevLlm;
    config.publicServices.appToken = prevToken;
    config.publicServices.baseURL = prevBase;
    config.llm.extraBody = prevExtra;
    config.llm.thinkingMode = prevThinking;
    resetClient();
  }
});

test('LLM call in managed mode propagates upstream errors directly without fallback', async () => {
  const prevLlm = config.publicServices.llm;
  const prevToken = config.publicServices.appToken;
  const prevBase = config.publicServices.baseURL;
  const originalFetch = globalThis.fetch;

  config.publicServices.llm = true;
  config.publicServices.appToken = 'app-secret-token';
  config.publicServices.baseURL = 'http://127.0.0.1:4100';

  resetClient();

  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ error: 'llm_profile_not_assigned', message: '请先配置模型' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await assert.rejects(
      async () => {
        await chatSync([{ role: 'user', content: 'hello' }], { label: 'test-error', retries: 0 });
      },
      (err) => {
        assert.equal(err.status, 503);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    config.publicServices.llm = prevLlm;
    config.publicServices.appToken = prevToken;
    config.publicServices.baseURL = prevBase;
    resetClient();
  }
});
