# Backend request: the profile page

**For:** the backend developer (`xsolla-capstone-backend`).

**Status:** built on both sides. The back-end answered in branch `feat/user-profile` (merged into `dev`; its section 11 in
`FRONTEND_REQUIREMENTS.md`) and the front-end Profile page uses those routes. Sections 1 and 2 are done; section 3
(last sign-in, sessions) is not built. This file stays as the agreed contract.

The Settings page is now a **Profile** page for every role (student, mentor, lecturer, admin), **built in the
front-end**. It keeps what Settings had (Google Calendar, change password: nothing new
needed for those) and adds two small things:

1. **About me**: a profile picture, a short bio and two contact handles. Other people can see these.
2. **Look and accessibility**: big text, a readable font, high contrast and so on. Only the person sees these.

We kept it simple on purpose: two small tables (or one table plus one JSON column), five routes.

---

## 1. About me

What the person can set:

| Field | Type | Rules |
|---|---|---|
| `avatar_url` | string or `null` | The picture. Set by the avatar routes below, never by the profile PATCH. |
| `bio` | string | Up to 300 characters. Empty string = none. |
| `slack_handle` | string | Up to 40 characters, e.g. `rashad.a`. Empty string = none. |
| `gitlab_handle` | string | Up to 40 characters, e.g. `rashad-a`. Empty string = none. |
| `visibility` | `"everyone"` or `"staff_only"` | Who sees the picture, bio and handles. Default `"everyone"`. The name and role are always visible. |

Names stay read-only: an admin creates the accounts and sets the names, so there is nothing to build for that.

### Routes

**`GET /users/me/profile`** (signed in)

```json
{ "avatar_url": "https://.../avatars/12.webp", "bio": "Go and cats.", "slack_handle": "rashad.a", "gitlab_handle": "", "visibility": "everyone" }
```

**`PATCH /users/me/profile`** (signed in): any of `bio`, `slack_handle`, `gitlab_handle`, `visibility`. Only the sent
fields change. Answer `200` with the whole profile. Too long, or a value that is not allowed: `400 bad_request` with the
rule in `message`.

**`GET /users/{id}/profile`** (signed in): another person's profile, as that viewer is allowed to see it. When the owner
chose `"staff_only"` and the viewer is a student, answer the same shape with `avatar_url: null`, `bio: ""` and empty
handles (do not answer `403`: the page just shows initials). Staff (mentor, lecturer, admin) always see everything.

**`PUT /users/me/avatar`** (signed in): `multipart/form-data` with one `file` field.
- JPG, PNG or WebP, **up to 2 MB**. Anything else: `400 bad_request` with a clear message ("Use a JPG, PNG or WebP picture
  up to 2 MB.").
- The front-end already crops it to a **square** (about 512 x 512) before sending, so the server only has to store it.
  Check the real content type, not only the file name.
- Answer `200 { "avatar_url": "..." }`. A new upload replaces the old one (delete the old file).

**`DELETE /users/me/avatar`** (signed in): removes the picture. `204`, also when there is none.

### The picture URL must work in an `<img>` tag

The browser cannot send an `Authorization` header when it loads an `<img src>`. So `avatar_url` has to be an address
the browser can open on its own: a public or hard-to-guess file URL, or a signed URL that lasts a while. (If it can
only be fetched with the token, the front-end would have to download every picture as a blob, which is slow on a list
of 30 people.) Tell us which you pick. If a picture is hidden by `"staff_only"` from a viewer, that viewer must get
`avatar_url: null`, not a URL.

### Where the picture is shown (so it should come with the people)

Add `avatar_url` (respecting `visibility`) to the person objects the app already reads:
`GET /users/me`, `GET /users`, `GET /teams/me`, `GET /mentors/me/team`, and the attendees on `GET /events`. A person
without a picture is `null`; the front-end then shows their initials.

---

## 2. Look and accessibility

One small JSON object per person. Only the person sees it and it follows them to any device.

```json
{
  "text_size": "large",
  "theme": "system",
  "font": "dyslexia",
  "spacing": "relaxed",
  "density": "comfortable",
  "high_contrast": false,
  "colorblind_safe": true,
  "reduce_motion": false,
  "strong_focus": false
}
```

| Key | Allowed values | Default |
|---|---|---|
| `text_size` | `"normal"`, `"large"`, `"xlarge"` | `"normal"` |
| `theme` | `"light"`, `"dark"`, `"system"` | `"system"` |
| `font` | `"default"`, `"dyslexia"` (a dyslexia-friendly font) | `"default"` |
| `spacing` | `"normal"`, `"relaxed"` (more space between lines and letters) | `"normal"` |
| `density` | `"comfortable"`, `"compact"` (how tight the lists are) | `"comfortable"` |
| `high_contrast` | `true` / `false` | `false` |
| `colorblind_safe` | `true` / `false` (adds icons next to the green, yellow and red week grades) | `false` |
| `reduce_motion` | `true` / `false` (no animations) | `false` |
| `strong_focus` | `true` / `false` (a stronger keyboard focus outline) | `false` |

### Routes

**`GET /users/me/preferences`** (signed in): the whole object. A person who never saved anything gets all the defaults
(`200`, not `404`).

**`PATCH /users/me/preferences`** (signed in): any of the keys. Only the sent keys change; the rest stay. Answer `200`
with the whole object. A key that is not in the table, or a value that is not allowed: `400 bad_request` and say which
key in `message`.

### How to store it

One JSON column is enough, for example `user_preferences(user_id PRIMARY KEY, prefs JSONB)`: a new option later then
needs no migration. Validate on write against the table above; ignore keys you do not know when reading. A row is
created on the first `PATCH`; before that, answer the defaults.

---

## 3. Optional, can wait

Not needed for the first version. If it is cheap for you, the profile page can also show:

- **Last sign-in**: `last_login_at` on `GET /users/me`.
- **Where you are signed in**: `GET /auth/sessions` (device or browser, last used) and `DELETE /auth/sessions/{id}`,
  plus a "Sign out everywhere else" button (`DELETE /auth/sessions`, keeping the current one).

---

## What the front-end does (already built)

**Where it is.** The person's name in the top right bar (picture and name) opens the profile: `/profile`, and
`/admin/profile` for an admin (the name in the admin bar). The old `/settings` and `/admin/settings` addresses forward to
it and keep the query, so **Google's way back to `/settings?google=connected` keeps working**: nothing to change in the
backend's redirect.

**About me.**
- Loads `GET /users/me/profile`; saves with `PATCH /users/me/profile`, sending the four text fields. Bio is limited to
  300 and the handles to 40 characters in the form before anything is sent.
- The picture: the person picks a JPG, PNG or WebP (up to 10 MB, they may be phone photos). The browser crops the middle
  **square**, shrinks it to 512 x 512 and sends it as WebP (JPEG where the browser cannot make WebP), so the file sent is
  small. `PUT /users/me/avatar` as multipart with one `file` field; `DELETE /users/me/avatar` to remove.
- The new `avatar_url` from the answer is shown at once in the top bar and on the profile. A picture that fails to load
  falls back to the initials.
- Other people's pictures (`avatar_url` on `/teams/me`, `/mentors/me/team` and the event attendees) show on the team
  pages, the grading and mentor-review lists, and in the "Attendees" list of an event. A person without a picture, or
  who hides it from the viewer (`null`), shows their initials. `GET /users` (the admin's people lists) is not used for
  pictures yet.

**Look and accessibility.**
- Loads `GET /users/me/preferences`; every click saves one key with `PATCH /users/me/preferences` (only that key).
- Keeps a copy in the browser (`localStorage`: `look`, and `theme` for the theme), so large text and the theme apply at
  once on page load, with no flash. The server copy wins after sign-in. A key or value the front-end does not know is
  ignored, so the backend can add options later without breaking the page.
- The theme in the top bar menu ("Dark mode") is the same setting: it is saved with the same `PATCH`.
- `text_size` zooms the reading areas (page content and the sidebar), `font: "dyslexia"` switches the font, and the rest
  are plain switches on the page. The easy-to-read font uses OpenDyslexic when it is installed on the front-end, else
  Verdana-like fonts.

**When the server is not ready.** A `404`, `405` or `501` on the profile routes shows "The server cannot save this yet",
and the About me form is read-only. The look settings still work and are kept on this device, with the note "Saved on
this device only". Without a backend at all (demo mode) everything is kept in the browser.

**Answers the front-end relies on.** `PATCH` answers `200` with the whole object. `GET /users/me/preferences` answers
`200` with defaults for a person who never saved (not `404`: a `404` is read as "the routes are not there").

## Checklist

- [ ] Table or columns for `avatar_url`, `bio`, `slack_handle`, `gitlab_handle`, `visibility`
- [ ] `GET` and `PATCH /users/me/profile`, `GET /users/{id}/profile` (with the `staff_only` rule)
- [ ] `PUT` and `DELETE /users/me/avatar` (type and size checked, old file removed)
- [ ] `avatar_url` usable in an `<img>`, and added to `/users/me`, `/users`, `/teams/me`, `/mentors/me/team` and event attendees
- [ ] `user_preferences` with `GET` and `PATCH /users/me/preferences`
- [ ] Swagger and `FRONTEND_REQUIREMENTS.md` updated
