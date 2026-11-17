export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AutosaveOptions<T> {
  save: (value: T) => Promise<void>
  onStatus: (status: SaveStatus) => void
  delay?: number
  retryDelay?: number
}

export interface Autosaver<T> {
  // Queue the latest value; it's saved once edits pause for `delay` ms.
  schedule: (value: T) => void
  // Save any queued value now and wait for every save to finish.
  // Resolves true if everything was saved, false if a save failed (it will still be retried).
  flush: () => Promise<boolean>
  // Drop any queued value and wait out an in-flight save, so nothing saves afterwards.
  // Used before the draft is replaced wholesale (restoring a version).
  discard: () => Promise<void>
  dispose: () => void
}

// Saves run one at a time, and only the newest value is ever sent, so a slow
// response can't overwrite later edits.
export function createAutosaver<T>({
  save,
  onStatus,
  delay = 800,
  retryDelay = 5000,
}: AutosaveOptions<T>): Autosaver<T> {
  let queued: { value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null
  let lastSaveFailed = false
  let disposed = false

  function setStatus(status: SaveStatus) {
    if (!disposed) onStatus(status)
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function startTimer(ms: number) {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      void run()
    }, ms)
  }

  async function run(): Promise<void> {
    if (inFlight) return inFlight
    if (!queued) return
    const { value } = queued
    queued = null
    setStatus('saving')
    inFlight = save(value).then(
      () => {
        inFlight = null
        lastSaveFailed = false
        if (queued) {
          setStatus('pending')
          if (timer === null) void run()
        } else {
          setStatus('saved')
        }
      },
      () => {
        inFlight = null
        lastSaveFailed = true
        // Retry the failed value unless a newer edit has replaced it.
        queued ??= { value }
        setStatus('error')
        if (!disposed) startTimer(retryDelay)
      },
    )
    return inFlight
  }

  return {
    schedule(value) {
      queued = { value }
      setStatus('pending')
      startTimer(delay)
    },
    async flush() {
      clearTimer()
      while (queued || inFlight) {
        await run()
        // Stop after a failed save; the retry timer takes it from here.
        if (lastSaveFailed && !inFlight) return false
      }
      return true
    },
    async discard() {
      clearTimer()
      queued = null
      if (inFlight) await inFlight
      // A failed in-flight save re-queues itself for retry; drop that too.
      clearTimer()
      queued = null
      lastSaveFailed = false
      setStatus('idle')
    },
    dispose() {
      clearTimer()
      disposed = true
    },
  }
}
