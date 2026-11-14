import { useId, useRef, useState } from 'react'
import { isNotSupported } from '../../api/profile'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { BIO_MAX, HANDLE_MAX } from '../../types/profile'
import type { Visibility } from '../../types/profile'
import { pictureProblem, squarePicture } from '../../utils/image'
import { Icon } from '../Icon'
import { Loading } from '../loading/Loading'
import { Avatar } from './Avatar'
import './profile.css'

const messageOf = (e: unknown, fallback: string) => (isNotSupported(e) ? 'The server cannot save this yet.' : e instanceof Error ? e.message : fallback)

/**
 * About me: the picture, a short bio and two contact handles, and who may see them. The name and role are always
 * visible to everyone, and are not edited here (an admin sets them).
 */
export function AboutCard({ variant = 'lms' }: { variant?: 'lms' | 'admin' }) {
  const { status } = useProfile()
  const id = useId()
  return (
    <section className={`profile-card profile-card--${variant}`} aria-labelledby={`${id}-title`}>
      <header className="profile-card__head">
        <span className="profile-card__icon" aria-hidden="true">
          <Icon name="user" size={22} />
        </span>
        <div>
          <h2 id={`${id}-title`} className="profile-card__title">
            About me
          </h2>
          <p className="profile-card__lead">A picture, a few words and where to find you. Your name and role are always visible.</p>
        </div>
      </header>
      {status === 'loading' ? <Loading>Loading your profile…</Loading> : <AboutForm variant={variant} />}
    </section>
  )
}

function AboutForm({ variant }: { variant: 'lms' | 'admin' }) {
  const { user } = useAuth()
  const { profile, status, saveProfile, setAvatar, clearAvatar } = useProfile()
  const id = useId()
  const picker = useRef<HTMLInputElement>(null)
  const [bio, setBio] = useState(profile.bio)
  const [slack, setSlack] = useState(profile.slackHandle)
  const [gitlab, setGitlab] = useState(profile.gitlabHandle)
  const [visibility, setVisibility] = useState<Visibility>(profile.visibility)
  const [busy, setBusy] = useState(false)
  const [pictureBusy, setPictureBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [pictureFailed, setPictureFailed] = useState('')
  const [done, setDone] = useState('')

  const off = status === 'unsupported'
  const errors = {
    bio: bio.length > BIO_MAX ? `Keep it to ${BIO_MAX} characters.` : '',
    slack: slack.trim().length > HANDLE_MAX ? `Keep it to ${HANDLE_MAX} characters.` : '',
    gitlab: gitlab.trim().length > HANDLE_MAX ? `Keep it to ${HANDLE_MAX} characters.` : '',
  }
  const invalid = Object.values(errors).some(Boolean)
  const changed =
    bio.trim() !== profile.bio || slack.trim() !== profile.slackHandle || gitlab.trim() !== profile.gitlabHandle || visibility !== profile.visibility

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setDone('')
    if (invalid || busy) return
    setBusy(true)
    setFailed('')
    try {
      await saveProfile({ bio: bio.trim(), slackHandle: slack.trim(), gitlabHandle: gitlab.trim(), visibility })
      setBio(bio.trim())
      setSlack(slack.trim())
      setGitlab(gitlab.trim())
      setDone('Saved.')
    } catch (err) {
      setFailed(messageOf(err, 'Could not save. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // the same file can be chosen again
    if (!file) return
    setPictureFailed('')
    setDone('')
    const problem = pictureProblem(file)
    if (problem) {
      setPictureFailed(problem)
      return
    }
    setPictureBusy(true)
    try {
      await setAvatar(await squarePicture(file))
      setDone('Your picture is saved.')
    } catch (err) {
      setPictureFailed(messageOf(err, 'Could not save the picture. Try again.'))
    } finally {
      setPictureBusy(false)
    }
  }

  async function remove() {
    setPictureFailed('')
    setDone('')
    setPictureBusy(true)
    try {
      await clearAvatar()
      setDone('Your picture is removed.')
    } catch (err) {
      setPictureFailed(messageOf(err, 'Could not remove the picture. Try again.'))
    } finally {
      setPictureBusy(false)
    }
  }

  const btn = variant === 'admin' ? 'admin-btn' : 'btn btn--ghost'
  const btnPrimary = variant === 'admin' ? 'admin-btn admin-btn--primary' : 'btn'

  return (
    <>
      {off && (
        <p className="profile-card__note" role="status">
          The server cannot save this yet. It will work as soon as the server has it.
        </p>
      )}
      <div className="profile-card__picture">
        <Avatar name={user?.name ?? ''} url={profile.avatarUrl} size={80} />
        <div className="profile-card__picture-actions">
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choose} aria-label="Choose a picture" />
          <button type="button" className={btn} onClick={() => picker.current?.click()} disabled={off || pictureBusy}>
            <Icon name="upload" size={16} /> {pictureBusy ? 'Saving…' : profile.avatarUrl ? 'Change picture' : 'Upload a picture'}
          </button>
          {profile.avatarUrl && (
            <button type="button" className={btn} onClick={remove} disabled={off || pictureBusy}>
              <Icon name="trash" size={16} /> Remove picture
            </button>
          )}
          <p className="profile-card__hint">JPG, PNG or WebP. It is cropped to a square.</p>
          {pictureFailed && (
            <p className="field__error" role="alert">
              {pictureFailed}
            </p>
          )}
        </div>
      </div>

      <form className="profile-card__form" onSubmit={save} noValidate>
        <div>
          <label className="field__label" htmlFor={`${id}-bio`}>
            Bio
          </label>
          <textarea
            id={`${id}-bio`}
            className="field__input profile-card__bio"
            rows={4}
            value={bio}
            disabled={off}
            aria-invalid={!!errors.bio}
            aria-describedby={`${id}-bio-count`}
            onChange={(e) => setBio(e.target.value)}
          />
          <p id={`${id}-bio-count`} className={`profile-card__count${errors.bio ? ' is-over' : ''}`}>
            {errors.bio || `${bio.length} / ${BIO_MAX}`}
          </p>
        </div>

        {(
          [
            ['slack', 'Slack', 'rashad.a', slack, setSlack],
            ['gitlab', 'GitLab', 'rashad-a', gitlab, setGitlab],
          ] as const
        ).map(([key, label, example, value, set]) => (
          <div key={key}>
            <label className="field__label" htmlFor={`${id}-${key}`}>
              {label} handle
            </label>
            <input
              id={`${id}-${key}`}
              className="field__input"
              type="text"
              value={value}
              placeholder={example}
              disabled={off}
              autoComplete="off"
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
              onChange={(e) => set(e.target.value)}
            />
            {errors[key] && (
              <p id={`${id}-${key}-error`} className="field__error">
                {errors[key]}
              </p>
            )}
          </div>
        ))}

        <fieldset className="profile-card__choice" disabled={off}>
          <legend className="field__label">Who sees my picture, bio and handles</legend>
          <label>
            <input type="radio" name={`${id}-visibility`} checked={visibility === 'everyone'} onChange={() => setVisibility('everyone')} />
            Everyone in the school
          </label>
          <label>
            <input type="radio" name={`${id}-visibility`} checked={visibility === 'staff_only'} onChange={() => setVisibility('staff_only')} />
            Only mentors, lecturers and admins
          </label>
        </fieldset>

        {failed && (
          <p className="field__error" role="alert">
            {failed}
          </p>
        )}
        {done && (
          <p className="profile-card__ok" role="status">
            {done}
          </p>
        )}
        <div>
          <button type="submit" className={btnPrimary} disabled={off || busy || !changed || invalid}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </>
  )
}
