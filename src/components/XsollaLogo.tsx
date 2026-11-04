import { memo } from 'react'

/**
 * Xsolla wordmark (paths from src/assets/images/xsolla-logo.svg).
 * Inlined with `fill="currentColor"` so it takes the surrounding text colour:
 * black on the light theme, white on the dark theme or on a photo.
 */
function XsollaLogoBase({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 556 120.76"
      role="img"
      aria-label="Xsolla"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M240.94,0c33.82,0,60.38,26.56,60.38,60.38s-26.56,60.38-60.38,60.38-60.37-26.56-60.37-60.38S207.12,0,240.94,0ZM240.94,23.1c-20.29,0-35.63,16.01-35.63,37.28s15.34,37.28,35.63,37.28,35.64-16,35.64-37.28-15.34-37.28-35.64-37.28Z"
      />
      <path d="M59.05,39.58L86.11,2.64h28.38l-41.7,55.38,45,60.1h-29.85l-29.86-40.29-29.53,40.29H0l44.34-58.75L1.98,2.64h29.69l27.38,36.95Z" />
      <path d="M140.61,35.8l22.76,28.54c4.95,6.27,7.26,12.2,7.26,18.64s-2.31,12.37-7.26,18.64l-13.03,16.5h-29.36l26.56-33.98-22.6-28.38c-4.78-5.94-7.09-11.71-7.09-17.81s2.31-12.04,7.09-17.82l14.85-17.49h28.7l-27.88,33.16Z" />
      <path d="M387.17,118.12h-29.03L296.11,2.64h29.04l62.02,115.48Z" />
      <path
        fillRule="evenodd"
        d="M382.59,2.64l48.95,91.13L478.8,2.64h17.32l59.88,115.48h-140.41L353.56,2.64h29.03ZM455.76,96.67h62.26l-31.1-62-31.16,62Z"
      />
    </svg>
  )
}

export const XsollaLogo = memo(XsollaLogoBase)
