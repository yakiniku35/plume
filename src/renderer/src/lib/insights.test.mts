import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentStreak, longestStreak, rangeKeys, shiftKey, summarize, window30, wordsByDay } from './insights.ts'

const entry = (date: string, wordCount: number, extra: Record<string, unknown> = {}) => ({
  id: date + wordCount, date, title: '', body: '', tags: [], attachments: [], wordCount, createdAt: `${date}T09:00:00.000Z`, updatedAt: '', ...extra
})

test('rangeKeys is oldest-first and inclusive', () => {
  assert.deepEqual(rangeKeys('2026-03-02', 3), ['2026-02-28', '2026-03-01', '2026-03-02'])
  assert.equal(shiftKey('2026-01-01', -1), '2025-12-31')
})

test('streaks', () => {
  const days = wordsByDay([entry('2026-03-01', 10), entry('2026-03-02', 10), entry('2026-03-03', 10), entry('2026-02-20', 5)] as never)
  assert.equal(currentStreak(days, '2026-03-03'), 3)
  assert.equal(currentStreak(days, '2026-03-04'), 3) // yesterday still counts
  assert.equal(currentStreak(days, '2026-03-06'), 0)
  assert.equal(longestStreak(days), 3)
})

test('window30 compares against the previous 30 days', () => {
  const es = [entry('2026-03-10', 100), entry('2026-03-11', 50), entry('2026-02-01', 70)] as never
  const w = window30(wordsByDay(es), '2026-03-15')
  assert.equal(w.cells.length, 30)
  assert.equal(w.totalWords, 150)
  assert.equal(w.activeDays, 2)
  assert.equal(w.avgWords, 75)
  assert.equal(w.prevTotalWords, 70)
  assert.equal(w.prevActiveDays, 1)
})

test('empty journal has no NaN', () => {
  const s = summarize([], '2026-03-15')
  assert.equal(s.streak, 0)
  assert.equal(s.last30.avgWords, 0)
  assert.equal(s.longest, null)
  assert.equal(s.weeks.length, 12)
  assert.ok(s.hours.every((h) => h === 0))
})
