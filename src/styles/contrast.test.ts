/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// read the real file (vitest is configured with css: false, which blanks CSS imports)
const css = readFileSync('src/index.css', 'utf8') // tests run from the project root

/**
 * Guards the colour tokens: any colour used as TEXT must reach WCAG AA (4.5:1)
 * on the surfaces it appears on, in both themes. The bright Xsolla turquoise /
 * red / green fail this on light backgrounds (~2.5:1) and tire the eyes, which
 * is why the light theme uses deeper values.
 */

function parseBlock(selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart)
  if (start === -1) throw new Error(`block not found: ${selectorStart}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const vars: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].replace(/\/\*.*?\*\//g, '').trim()
  return vars
}

const light = parseBlock(':root {')
const dark = { ...light, ...parseBlock(":root[data-theme='dark']") }

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = ['--card', '--bg', '--main-bg', '--sidebar-bg', '--header-bg'] as const
const TEXT_TOKENS = ['--text', '--text-muted', '--link', '--danger', '--ok', '--warn'] as const
const AA = 4.5

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme colours', (_name, vars) => {
  it('every token used here is a plain hex colour', () => {
    for (const t of [...TEXT_TOKENS, ...SURFACES, '--xs-cyan', '--on-fill']) {
      expect(vars[t], t).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it.each(TEXT_TOKENS)('%s text is readable (>= 4.5:1) on every surface', (token) => {
    for (const surface of SURFACES) {
      expect(contrast(vars[token], vars[surface]), `${token} on ${surface}`).toBeGreaterThanOrEqual(AA)
    }
  })

  it('text on the solid red and green badges is readable', () => {
    expect(contrast(vars['--on-fill'], vars['--danger'])).toBeGreaterThanOrEqual(AA)
    expect(contrast(vars['--on-fill'], vars['--ok'])).toBeGreaterThanOrEqual(AA)
    expect(contrast(vars['--on-fill'], vars['--warn'])).toBeGreaterThanOrEqual(AA) // the yellow week tile
  })

  it('dark text on the turquoise fills (today badge, tags, icons) is readable', () => {
    expect(contrast('#06232b', vars['--xs-cyan'])).toBeGreaterThanOrEqual(AA)
  })

  it('button text is readable on the button colour', () => {
    expect(contrast(vars['--btn-text'] ?? '#0b0b0b', vars['--btn-bg'])).toBeGreaterThanOrEqual(AA)
  })
})

describe('light theme is calmer than the raw brand colours', () => {
  it('uses a less saturated turquoise than the dark theme', () => {
    expect(light['--xs-cyan']).not.toBe(dark['--xs-cyan'])
    const sat = (hex: string) => {
      const h = hex.replace('#', '')
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
      return Math.max(r, g, b) - Math.min(r, g, b)
    }
    expect(sat(light['--xs-cyan'])).toBeLessThan(sat(dark['--xs-cyan']))
  })

  it('the glow around the current module is weaker on the light theme', () => {
    expect(parseInt(light['--glow'])).toBeLessThan(parseInt(dark['--glow']))
  })

  it('keeps glows subtle: the halo strength is low in both themes', () => {
    expect(parseInt(light['--glow'])).toBeLessThanOrEqual(10)
    expect(parseInt(dark['--glow'])).toBeLessThanOrEqual(25)
  })
})
