import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFileSync(path.join(root, relative), 'utf8')
const lines = (relative) => read(relative).split(/\r?\n/).length

const hostFiles = ['index.js', ...readdirSync(path.join(root, 'host')).filter((name) => name.endsWith('.js')).map((name) => `host/${name}`)]

test('host modules stay within the size ratchet', () => {
  assert.ok(lines('index.js') < 400, 'index.js must stay below 400 lines')
  for (const file of hostFiles.slice(1)) {
    assert.ok(lines(file) <= 600, `${file} must stay at or below 600 lines`)
  }
})

test('host modules import only node builtins and relative files', () => {
  for (const file of hostFiles) {
    const source = read(file)
    const specifiers = [
      ...source.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm),
      ...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((match) => match[1])
    for (const specifier of specifiers) {
      assert.ok(
        specifier.startsWith('node:') || specifier.startsWith('./') || specifier.startsWith('../'),
        `${file} imports a non-builtin or non-relative module: ${specifier}`,
      )
    }
    assert.ok(!/\brequire\s*\(/.test(source), `${file} must not use require()`)
    assert.ok(!/shell\s*:\s*true/.test(source), `${file} must not enable a shell`)
  }
})

test('the manifest, patch, and exported resources agree', () => {
  const manifest = JSON.parse(read('package.json'))
  assert.equal(manifest.name, '@aishangwuji/dsh-notify')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.ok(statSync(path.join(root, 'cordis.patch.yml')).isFile())
  assert.match(read('cordis.patch.yml'), /id:\s*dsh-notify/)
  assert.match(read('cordis.patch.yml'), /name:\s*'@aishangwuji\/dsh-notify'/)

  for (const target of [manifest.exports['.'], manifest.exports['./icon']]) {
    assert.ok(statSync(path.join(root, target)).isFile(), `missing export target ${target}`)
  }
  for (const locale of ['locale/en.json', 'locale/zh.json']) {
    assert.ok(statSync(path.join(root, locale)).isFile())
  }
})

test('locale files carry the same meta keys', () => {
  const en = JSON.parse(read('locale/en.json'))
  const zh = JSON.parse(read('locale/zh.json'))
  assert.deepEqual(Object.keys(en.meta).sort(), Object.keys(zh.meta).sort())
  assert.ok(en.meta.title && en.meta.description && en.meta.detail)
  assert.ok(zh.meta.title && zh.meta.description && zh.meta.detail)
  assert.match(en.meta.detail, /^docs\//)
  assert.ok(statSync(path.join(root, zh.meta.detail)).isFile())
})

test('the icon is a bounded, well-formed SVG', () => {
  const icon = read('icon.svg')
  assert.match(icon, /^<svg[\s>]/)
  assert.ok(Buffer.byteLength(icon) < 256 * 1024)
})

test('the bundle ships every runtime file it needs', () => {
  const manifest = JSON.parse(read('package.json'))
  const files = manifest.files
  for (const expected of ['index.js', 'host', 'cordis.patch.yml', 'locale/*.json', 'docs', 'icon.svg']) {
    assert.ok(files.includes(expected), `files must include ${expected}`)
  }
  assert.ok(statSync(path.join(root, 'docs/DETAIL.md')).isFile())
  assert.ok(!manifest.files.includes('test'), 'tests must not ship in the package')
})
