import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaver, type SaveStatus } from './autosave.ts'

function deferred() {
  let resolve!: () => void
  let reject!: (err: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(save: (value: string) => Promise<void> = () => Promise.resolve()) {
  const statuses: SaveStatus[] = []
  const saveSpy = vi.fn(save)
  const saver = createAutosaver({
    save: saveSpy,
    onStatus: (s) => statuses.push(s),
    delay: 500,
    retryDelay: 2000,
  })
  return { saver, saveSpy, statuses }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createAutosaver', () => {
  it('waits for edits to pause, then saves only the latest value', async () => {
    const { saver, saveSpy, statuses } = setup()
    saver.schedule('a')
    await vi.advanceTimersByTimeAsync(300)
    saver.schedule('ab')
    await vi.advanceTimersByTimeAsync(300)
    expect(saveSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(200)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledWith('ab')
    expect(statuses.at(-1)).toBe('saved')
  })

  it('never runs two saves at once and sends edits made during a save afterwards', async () => {
    const first = deferred()
    const { saver, saveSpy, statuses } = setup(
      vi.fn<(v: string) => Promise<void>>().mockReturnValueOnce(first.promise).mockResolvedValue(undefined),
    )
    saver.schedule('one')
    await vi.advanceTimersByTimeAsync(500)
    expect(saveSpy).toHaveBeenCalledTimes(1)

    saver.schedule('two')
    await vi.advanceTimersByTimeAsync(500)
    expect(saveSpy).toHaveBeenCalledTimes(1) // still waiting on "one"

    first.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(saveSpy).toHaveBeenCalledTimes(2)
    expect(saveSpy).toHaveBeenLastCalledWith('two')
    expect(statuses.at(-1)).toBe('saved')
  })

  it('reports an error and retries the failed value', async () => {
    const { saver, saveSpy, statuses } = setup(
      vi.fn<(v: string) => Promise<void>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined),
    )
    saver.schedule('a')
    await vi.advanceTimersByTimeAsync(500)
    expect(statuses.at(-1)).toBe('error')

    await vi.advanceTimersByTimeAsync(2000)
    expect(saveSpy).toHaveBeenCalledTimes(2)
    expect(saveSpy).toHaveBeenLastCalledWith('a')
    expect(statuses.at(-1)).toBe('saved')
  })

  it('retries with the newest value if edits arrive after a failure', async () => {
    const { saver, saveSpy } = setup(
      vi.fn<(v: string) => Promise<void>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined),
    )
    saver.schedule('a')
    await vi.advanceTimersByTimeAsync(500)
    saver.schedule('ab')
    await vi.advanceTimersByTimeAsync(500)
    expect(saveSpy).toHaveBeenLastCalledWith('ab')
  })

  it('flush saves immediately without waiting for the delay', async () => {
    const { saver, saveSpy } = setup()
    saver.schedule('a')
    expect(await saver.flush()).toBe(true)
    expect(saveSpy).toHaveBeenCalledWith('a')
  })

  it('flush resolves true when nothing is queued', async () => {
    const { saver } = setup()
    expect(await saver.flush()).toBe(true)
  })

  it('flush resolves false when the save fails, and the value is still retried', async () => {
    const { saver, saveSpy } = setup(
      vi.fn<(v: string) => Promise<void>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined),
    )
    saver.schedule('a')
    expect(await saver.flush()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(saveSpy.mock.calls).toEqual([['a'], ['a']])
  })

  it('flush waits for an in-flight save and then sends queued edits', async () => {
    const first = deferred()
    const { saver, saveSpy } = setup(
      vi.fn<(v: string) => Promise<void>>().mockReturnValueOnce(first.promise).mockResolvedValue(undefined),
    )
    saver.schedule('one')
    await vi.advanceTimersByTimeAsync(500)
    saver.schedule('two')

    const flushed = saver.flush()
    first.resolve()
    await flushed
    expect(saveSpy.mock.calls).toEqual([['one'], ['two']])
  })

  it('flush gives up after one failed attempt instead of retrying in a loop', async () => {
    const { saver, saveSpy } = setup(() => Promise.reject(new Error('offline')))
    saver.schedule('a')
    expect(await saver.flush()).toBe(false)
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })

  it('discard drops queued edits and a failed in-flight save so neither is saved later', async () => {
    const first = deferred()
    const { saver, saveSpy, statuses } = setup(
      vi.fn<(v: string) => Promise<void>>().mockReturnValueOnce(first.promise).mockResolvedValue(undefined),
    )
    saver.schedule('one')
    await vi.advanceTimersByTimeAsync(500)
    saver.schedule('two')

    const discarded = saver.discard()
    first.reject(new Error('offline'))
    await discarded
    await vi.advanceTimersByTimeAsync(10_000)
    expect(saveSpy.mock.calls).toEqual([['one']])
    expect(statuses.at(-1)).toBe('idle')
  })

  it('stops reporting status after dispose', async () => {
    const { saver, statuses } = setup()
    saver.schedule('a')
    saver.dispose()
    await vi.advanceTimersByTimeAsync(1000)
    expect(statuses).toEqual(['pending'])
  })
})
