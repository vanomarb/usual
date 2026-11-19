import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Colours are oklch() theme variables in app/styles/main.css; this fails on a hex colour anywhere in the sources.
// It skips href="#…" anchors, url(#…) references and &#8369;-style entities.
const HEX = /(?<![&\w-])(?<!href=")(?<!href=')(?<!url\()#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/i
const SKIP = new Set(['node_modules', '.git', 'dist', 'dist-capture'])

function files(dir: string, keep: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : files(path, keep)
    return keep.test(entry.name) ? [path] : []
  })
}

test('no colour is written as hex', () => {
  const sources = [...files('.', /\.(html|svg)$/), ...['app', 'build', 'tests'].flatMap((dir) => files(dir, /\.(ts|css|json)$/))]
  const found = sources.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) => (HEX.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
  )
  assert.deepEqual(found, [])
})
