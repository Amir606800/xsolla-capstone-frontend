import './loading.css'

/** A small turning ring in the Xsolla cyan. Decorative: whatever shows it says "Loading…" in words. */
export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
}
