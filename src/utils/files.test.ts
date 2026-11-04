import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES, extensionOf, formatBytes, validateFile } from './files'

describe('extensionOf', () => {
  it.each([
    ['report.PDF', 'pdf'],
    ['archive.tar.zip', 'zip'],
    ['noext', ''],
    ['.gitignore', 'gitignore'],
  ])('%s -> "%s"', (name, ext) => {
    expect(extensionOf(name)).toBe(ext)
  })
})

describe('validateFile', () => {
  it.each(['a.pdf', 'b.PPTX', 'c.md', 'd.zip'])('accepts %s', (name) => {
    expect(validateFile({ name, size: 10 })).toBeNull()
  })

  it.each(['virus.exe', 'photo.png', 'noext', 'doc.pdf.exe'])('rejects %s by type', (name) => {
    expect(validateFile({ name, size: 10 })).toMatch(/only pdf, pptx, md, zip/)
  })

  it('rejects files over the size limit but accepts exactly the limit', () => {
    expect(validateFile({ name: 'big.zip', size: MAX_FILE_BYTES + 1 })).toMatch(/larger than 50 MB/)
    expect(validateFile({ name: 'ok.zip', size: MAX_FILE_BYTES })).toBeNull()
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('%d -> %s', (n, out) => {
    expect(formatBytes(n)).toBe(out)
  })
})
