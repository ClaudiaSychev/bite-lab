// Pure helpers for comparing two recipe versions side by side.

export interface Segment {
  text: string
  changed: boolean
}

export interface TextDiff {
  before: Segment[]
  after: Segment[]
}

// Above this many LCS cells (after trimming the shared start and end) the changed middle
// is marked as one block instead, so a huge rewrite of the notes can't stall the page.
const MAX_LCS_CELLS = 2_000_000

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t !== '')
}

function pushSegment(segments: Segment[], text: string, changed: boolean) {
  const last = segments.at(-1)
  if (last && last.changed === changed) last.text += text
  else segments.push({ text, changed })
}

// Indexes of a and b that belong to one longest common subsequence.
function lcsPairs<T>(a: readonly T[], b: readonly T[]): Array<[number, number]> {
  const width = b.length + 1
  const table = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0)
    }
  }
  const pairs: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j])
      i++
      j++
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      i++
    } else {
      j++
    }
  }
  return pairs
}

// Word-level diff: words only in `before` are marked changed on the left, words only in `after` on the right.
export function diffWords(before: string, after: string): TextDiff {
  const a = tokenize(before)
  const b = tokenize(after)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const left: Segment[] = []
  const right: Segment[] = []
  const shared = (from: number, to: number) => {
    const text = a.slice(from, to).join('')
    if (text) {
      pushSegment(left, text, false)
      pushSegment(right, text, false)
    }
  }

  shared(0, start)
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  if (midA.length * midB.length > MAX_LCS_CELLS) {
    if (midA.length) pushSegment(left, midA.join(''), true)
    if (midB.length) pushSegment(right, midB.join(''), true)
  } else {
    let i = 0
    let j = 0
    for (const [pi, pj] of [...lcsPairs(midA, midB), [midA.length, midB.length] as [number, number]]) {
      for (; i < pi; i++) pushSegment(left, midA[i] ?? '', true)
      for (; j < pj; j++) pushSegment(right, midB[j] ?? '', true)
      if (pi < midA.length) {
        pushSegment(left, midA[pi] ?? '', false)
        pushSegment(right, midB[pj] ?? '', false)
        i = pi + 1
        j = pj + 1
      }
    }
  }
  shared(endA, a.length)
  return { before: left, after: right }
}

export type RowStatus = 'unchanged' | 'changed' | 'added' | 'removed'

export interface DiffRow<T> {
  before: { item: T; index: number } | null
  after: { item: T; index: number } | null
  status: RowStatus
  // Present in both versions but in a different position relative to the other items.
  moved: boolean
}

// Lines up two lists by item id. Rows follow the newer order; removed items sit
// right after the item that preceded them in the older version.
export function alignById<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
  same: (a: T, b: T) => boolean,
): DiffRow<T>[] {
  const beforeIndex = new Map(before.map((item, index) => [item.id, index]))
  const afterIds = new Set(after.map((item) => item.id))

  const commonBefore = before.filter((item) => afterIds.has(item.id)).map((item) => item.id)
  const commonAfter = after.filter((item) => beforeIndex.has(item.id)).map((item) => item.id)
  const inOrder = new Set(lcsPairs(commonBefore, commonAfter).map(([i]) => commonBefore[i]))

  const rows: DiffRow<T>[] = after.map((item, index) => {
    const oldIndex = beforeIndex.get(item.id)
    if (oldIndex === undefined) {
      return { before: null, after: { item, index }, status: 'added', moved: false }
    }
    const old = before[oldIndex] as T
    return {
      before: { item: old, index: oldIndex },
      after: { item, index },
      status: same(old, item) ? 'unchanged' : 'changed',
      moved: !inOrder.has(item.id),
    }
  })

  // Insert removed items, walking the old list so consecutive removals keep their order.
  let insertAt = 0
  before.forEach((item, index) => {
    if (afterIds.has(item.id)) {
      insertAt = rows.findIndex((row) => row.after?.item.id === item.id) + 1
      return
    }
    rows.splice(insertAt, 0, { before: { item, index }, after: null, status: 'removed', moved: false })
    insertAt++
  })
  return rows
}
