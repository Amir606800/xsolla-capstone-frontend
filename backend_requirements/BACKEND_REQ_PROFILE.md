# Backend request: the profile page

**For:** the backend developer (`xsolla-capstone-backend`).

The Settings page becomes a **Profile** page for every role (student, mentor, lecturer, admin). It keeps what Settings
has today (Google Calendar, change password: nothing new needed for those) and adds two small things:

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

## What the front-end does

- Keeps a copy of the look settings in the browser, so large text and the theme apply at once on page load, with no
  flash. The server copy wins after sign-in.
- Crops and shrinks the picture before upload, and shows initials when there is none.
- Shows "Saved" after a change, and a plain message for a `400`.
- Until the routes exist, the profile page works offline in demo mode and says "The server cannot save this yet" for a
  `404`/`405`/`501`.

## Checklist

- [ ] Table or columns for `avatar_url`, `bio`, `slack_handle`, `gitlab_handle`, `visibility`
- [ ] `GET` and `PATCH /users/me/profile`, `GET /users/{id}/profile` (with the `staff_only` rule)
- [ ] `PUT` and `DELETE /users/me/avatar` (type and size checked, old file removed)
- [ ] `avatar_url` usable in an `<img>`, and added to `/users/me`, `/users`, `/teams/me`, `/mentors/me/team` and event attendees
- [ ] `user_preferences` with `GET` and `PATCH /users/me/preferences`
- [ ] Swagger and `FRONTEND_REQUIREMENTS.md` updated
