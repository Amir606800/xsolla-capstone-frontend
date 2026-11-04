/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// vitest runs with css: false (CSS imports are blanked), so read the real file
const css = readFileSync('src/styles/typography.css', 'utf8')

describe('typography.css', () => {
  it('declares SharpGrotesk20 with local() first, then the files in public/fonts', () => {
    const rule = /@font-face\s*{[^}]*SharpGrotesk20[^}]*}/.exec(css)?.[0] ?? ''
    expect(rule).toContain("local('SharpGrotesk20')")
    expect(rule.indexOf('local(')).toBeLessThan(rule.indexOf('url('))
    expect(rule).toContain('/fonts/sharp-grotesk/SharpGroteskBook20.woff2')
    expect(rule).toContain('font-display: swap')
  })

  it('covers 400-700 with the single Book file, so no faux bold is synthesised', () => {
    const rule = /@font-face\s*{[^}]*SharpGrotesk20[^}]*}/.exec(css)?.[0] ?? ''
    expect(rule).toMatch(/font-weight:\s*400 700/)
  })

  it('puts SharpGrotesk20 first in every font stack and keeps the free stand-in as the safety net', () => {
    for (const token of ['--font-body', '--font-display', '--font-label']) {
      const line = new RegExp(`${token}:\\s*([^;]+);`).exec(css)?.[1] ?? ''
      expect(line.split(',')[0].trim(), token).toBe("'SharpGrotesk20'")
    }
    expect(css).toMatch(/--font-fallback:\s*'Hanken Grotesk Variable'/)
  })

  it('has instructions for where to put the font files', () => {
    expect(existsSync('public/fonts/sharp-grotesk/README.txt')).toBe(true)
  })

})
