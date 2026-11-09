import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A font url() with no file behind it is not a 404 in the dev server: it is index.html (HTTP 200), and the
 * browser logs "OTS parsing error: invalid sfntVersion" when it tries to read that as a font.
 */
const css = readFileSync(join(__dirname, 'typography.css'), 'utf8')
const urls = [...css.matchAll(/url\(\s*['"]?(\/fonts\/[^'")]+)['"]?\s*\)/g)].map((m) => m[1])

describe('font files named in typography.css', () => {
  it('names at least the body and the headline fonts', () => {
    expect(urls.length).toBeGreaterThanOrEqual(3)
  })

  it.each(urls)('%s exists in public/', (url) => {
    expect(existsSync(join(__dirname, '../../public', decodeURI(url))), `${url} is missing`).toBe(true)
  })

  it('every font file is a real font, not a page', () => {
    for (const url of urls) {
      const head = readFileSync(join(__dirname, '../../public', decodeURI(url))).subarray(0, 4).toString('latin1')
      expect(head, url).toBe('wOF2')
    }
  })
})
