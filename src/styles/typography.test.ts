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

  it('puts SharpGrotesk20 first in the body and label stacks and keeps the free stand-in as the safety net', () => {
    for (const token of ['--font-body', '--font-label']) {
      const line = new RegExp(`${token}:\\s*([^;]+);`).exec(css)?.[1] ?? ''
      expect(line.split(',')[0].trim(), token).toBe("'SharpGrotesk20'")
    }
    expect(css).toMatch(/--font-fallback:\s*'Hanken Grotesk Variable'/)
  })

  it('titles use the Xsolla headline cut (Sharp Grotesk 15), falling back to the body font', () => {
    const stack = /--font-display:\s*([^;]+);/.exec(css)?.[1].split(',').map((x) => x.trim()) ?? []
    expect(stack[0]).toBe("'SharpGrotesk15'")
    expect(stack).toContain("'SharpGrotesk20'")
  })

  it('declares the headline weights 600 (SmBold) and 700 (Bold) from the real files', () => {
    const rules = css.match(/@font-face\s*{[^}]*SharpGrotesk15[^}]*}/g) ?? []
    expect(rules).toHaveLength(2)
    const find = (w: number) => rules.find((r) => new RegExp(`font-weight:\\s*${w};`).test(r)) ?? ''
    expect(find(600)).toContain('/fonts/sharp-grotesk/SharpGroteskSmBold15.woff2')
    expect(find(700)).toContain('/fonts/sharp-grotesk/SharpGroteskBold15.woff2')
    for (const r of rules) expect(r).toContain('font-display: swap')
  })

  it('the headline font files are in the project', () => {
    expect(existsSync('public/fonts/sharp-grotesk/SharpGroteskBold15.woff2')).toBe(true)
    expect(existsSync('public/fonts/sharp-grotesk/SharpGroteskSmBold15.woff2')).toBe(true)
  })

  it('h1 and page titles are bold (700), the other headings semibold (600)', () => {
    const weight = (selector: string) =>
      new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')}\\s*{[^}]*font-weight:\\s*(\\d+)`).exec(css)?.[1]
    expect(weight('h1')).toBe('700')
    expect(weight('.page-title')).toBe('700')
    for (const h of ['h2', 'h3', 'h4']) expect(weight(h), h).toBe('600')
  })

  it('has instructions for where to put the font files', () => {
    expect(existsSync('public/fonts/sharp-grotesk/README.txt')).toBe(true)
  })

})
