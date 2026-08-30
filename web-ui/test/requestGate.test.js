import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestGate } from '../src/utils/requestGate.js'

test('coalesces concurrent requests and reuses the fresh value', async () => {
  let calls = 0
  let release
  const pending = new Promise(resolve => { release = resolve })
  const gate = createRequestGate(30_000)
  const task = async () => { calls++; await pending; return 'value' }

  const first = gate.run(task)
  const second = gate.run(task)
  assert.equal(calls, 0)
  release()
  assert.equal(await first, 'value')
  assert.equal(await second, 'value')
  assert.equal(calls, 1)
  assert.equal(await gate.run(task), 'value')
  assert.equal(calls, 1)
})

test('refreshes after TTL and when explicitly forced', async () => {
  let clock = 100
  let calls = 0
  const gate = createRequestGate(50, { now: () => clock })
  const task = async () => ++calls

  assert.equal(await gate.run(task), 1)
  clock = 140
  assert.equal(await gate.run(task), 1)
  clock = 151
  assert.equal(await gate.run(task), 2)
  assert.equal(await gate.run(task, { force: true }), 3)
})

test('does not cache failed requests', async () => {
  let calls = 0
  const gate = createRequestGate(1_000)
  await assert.rejects(() => gate.run(async () => { calls++; throw new Error('offline') }))
  assert.equal(await gate.run(async () => { calls++; return 'recovered' }), 'recovered')
  assert.equal(calls, 2)
})
