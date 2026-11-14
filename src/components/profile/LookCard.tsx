import { useId, useState } from 'react'
import { isNotSupported } from '../../api/profile'
import { useProfile } from '../../hooks/useProfile'
import type { PreferencesPatch } from '../../types/profile'
import { Icon } from '../Icon'
import './profile.css'

interface Choice {
  key: 'textSize' | 'theme' | 'font' | 'spacing' | 'density'
  label: string
  options: { value: string; label: string; hint?: string }[]
}

const CHOICES: Choice[] = [
  {
    key: 'textSize',
    label: 'Text size',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'large', label: 'Large' },
      { value: 'xlarge', label: 'Extra large' },
    ],
  },
  {
    key: 'theme',
    label: 'Theme',
    options: [
      { value: 'system', label: 'Same as my device' },
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
  },
  {
    key: 'font',
    label: 'Font',
    options: [
      { value: 'default', label: 'School font' },
      { value: 'dyslexia', label: 'Easy to read', hint: 'Wide, clear letters, made to help with dyslexia' },
    ],
  },
  {
    key: 'spacing',
    label: 'Spacing',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'relaxed', label: 'Relaxed', hint: 'More space between lines, words and letters' },
    ],
  },
  {
    key: 'density',
    label: 'Lists',
    options: [
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'compact', label: 'Compact', hint: 'Tighter rows, more on the screen' },
    ],
  },
]

const SWITCHES: { key: 'highContrast' | 'colorblindSafe' | 'reduceMotion' | 'strongFocus'; label: string; hint: string }[] = [
  { key: 'highContrast', label: 'High contrast', hint: 'Stronger text and borders' },
  { key: 'colorblindSafe', label: 'Colourblind-safe grades', hint: 'Adds a ▲ ● ▼ sign next to the green, yellow and red grades' },
  { key: 'reduceMotion', label: 'Reduce motion', hint: 'No animations' },
  { key: 'strongFocus', label: 'Strong keyboard focus', hint: 'A bigger outline around what you are on when you use the keyboard' },
]

/**
 * Look and accessibility. Every change shows on the page at once and is kept in this browser; the server copy
 * follows the person to any device. Only the person themselves sees these settings.
 */
export function LookCard({ variant = 'lms' }: { variant?: 'lms' | 'admin' }) {
  const { prefs, savePrefs } = useProfile()
  const id = useId()
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null)

  async function change(patch: PreferencesPatch) {
    setNote(null)
    try {
      await savePrefs(patch)
      setNote({ text: 'Saved.', tone: 'ok' })
    } catch (e) {
      // the page already shows the change; only the copy on the server is missing
      setNote({
        text: isNotSupported(e) ? 'Saved on this device only. The server cannot keep it yet.' : 'Saved on this device only. Could not reach the server.',
        tone: 'warn',
      })
    }
  }

  return (
    <section className={`profile-card profile-card--${variant}`} aria-labelledby={`${id}-title`}>
      <header className="profile-card__head">
        <span className="profile-card__icon" aria-hidden="true">
          <Icon name="eye" size={22} />
        </span>
        <div>
          <h2 id={`${id}-title`} className="profile-card__title">
            Look and accessibility
          </h2>
          <p className="profile-card__lead">Make the LMS easier on your eyes. Only you see these settings, and they follow you to any device.</p>
        </div>
      </header>

      <div className="profile-card__form">
        {CHOICES.map((c) => (
          <fieldset key={c.key} className="profile-card__choice profile-card__choice--row">
            <legend className="field__label">{c.label}</legend>
            {c.options.map((o) => (
              <label key={String(o.value)} title={o.hint}>
                <input
                  type="radio"
                  name={`${id}-${c.key}`}
                  checked={prefs[c.key] === o.value}
                  onChange={() => void change({ [c.key]: o.value } as PreferencesPatch)}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        ))}

        <div className="profile-card__switches">
          {SWITCHES.map((s) => (
            <label key={s.key} className="profile-card__switch">
              <input type="checkbox" checked={prefs[s.key]} onChange={(e) => void change({ [s.key]: e.target.checked })} />
              <span>
                {s.label}
                <small>{s.hint}</small>
              </span>
            </label>
          ))}
        </div>

        {note && (
          <p className={note.tone === 'ok' ? 'profile-card__ok' : 'profile-card__warn'} role="status">
            {note.text}
          </p>
        )}
      </div>
    </section>
  )
}
