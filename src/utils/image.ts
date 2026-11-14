/** Profile pictures: what is accepted, and the square copy that is actually sent. */
export const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** The chosen file may be big (a phone photo); only the small square copy is sent, and the server takes 2 MB. */
export const PICTURE_MAX_BYTES = 10 * 1024 * 1024
export const PICTURE_SIZE = 512

export const PICTURE_RULE = 'Use a JPG, PNG or WebP picture up to 10 MB.'

/** '' when the file can be used, else what is wrong with it. */
export function pictureProblem(file: { type: string; size: number }): string {
  if (!PICTURE_TYPES.includes(file.type) || file.size > PICTURE_MAX_BYTES) return PICTURE_RULE
  return ''
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** The middle square of the picture, shrunk to 512 x 512. WebP where the browser can make it, else JPEG. */
export async function squarePicture(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This picture cannot be read. Try another one.')
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = PICTURE_SIZE
    canvas.height = PICTURE_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot prepare the picture.')
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PICTURE_SIZE, PICTURE_SIZE)
    const webp = await toBlob(canvas, 'image/webp', 0.85)
    if (webp && webp.type === 'image/webp') return webp
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.88)
    if (!jpeg) throw new Error('This browser cannot prepare the picture.')
    return jpeg
  } finally {
    bitmap.close()
  }
}

/** The first letters of the first two words of a name, for a person without a picture. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
  return letters.join('') || '?'
}
