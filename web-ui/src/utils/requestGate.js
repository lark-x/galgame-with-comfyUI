export function createRequestGate(ttlMs, { now = () => Date.now() } = {}) {
  let inFlight = null
  let hasValue = false
  let lastValue
  let lastSuccessAt = 0

  async function run(task, { force = false } = {}) {
    if (inFlight) return inFlight
    if (!force && hasValue && now() - lastSuccessAt < ttlMs) return lastValue

    inFlight = Promise.resolve()
      .then(task)
      .then(value => {
        lastValue = value
        hasValue = true
        lastSuccessAt = now()
        return value
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  }

  function invalidate() {
    hasValue = false
    lastSuccessAt = 0
  }

  return {
    run,
    invalidate,
    isFresh: () => hasValue && now() - lastSuccessAt < ttlMs,
  }
}
