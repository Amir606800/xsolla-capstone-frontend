# Backend request: "Disconnect Google" must also revoke the permission at Google

**For:** the backend developer (`xsolla-capstone-backend`).
**Route:** `POST /auth/google/logout` (already exists on `master` and `dev`).

## What happens today

`POST /auth/google/logout` (signed in, JWT) calls `DeleteGoogleRefreshToken(userID)`, which only **deletes the refresh
token the school stored**. It answers `204`. It does not tell Google anything.

So after a person presses **Disconnect** in the LMS (Settings, Google card):

- the LMS can no longer read their Google Calendar or add events to it (good), but
- the school app is **still listed in their Google account** as something they allowed
  (https://myaccount.google.com/permissions), and the refresh token that was issued is **still valid at Google** until it
  expires or they remove it there. A copy of it (a backup, a log, a database dump) would still work.

That is why the card also shows a second step, "Also remove access in your Google account". The two steps should be one.

## What we ask

When disconnecting, **revoke the token at Google first, then delete the stored copy**:

1. Read the user's stored refresh token (decrypt it).
2. Call Google's revoke endpoint with it:

   ```
   POST https://oauth2.googleapis.com/revoke
   Content-Type: application/x-www-form-urlencoded

   token=<refresh token>
   ```

   Revoking the refresh token also invalidates the access tokens made from it.
3. Delete the stored token (`DeleteGoogleRefreshToken`), **also when Google answers that the token is already invalid or
   revoked** (`400 invalid_token`): the person wanted it gone, and it is gone. Do not leave the row behind.
4. Answer `204`.

## Failure cases

| Situation | Answer |
|---|---|
| Never connected / no stored token | `204` (nothing to do; the call is safe to repeat) |
| Google says the token is already invalid or revoked | delete the stored copy, `204` |
| Google cannot be reached (network, 5xx) | **still delete the stored copy**, `204`, and log the failed revoke. The person must not be stuck "connected" because Google is down |
| The stored token cannot be decrypted | delete the row, `204`, log it |
| No / bad JWT | `401` as today |
| Our own database error while deleting | `500 server_error` as today |

If you prefer to report the failed revoke to the person, answer `200` with `{ "revoked": false }` instead of `204` in the
"Google cannot be reached" case, and tell us: the front-end would then keep showing the link "Also remove access in your
Google account" for that person. (Not required. `204` always is fine.)

## Other things to check at the same time

- Events already created on the person's Google Calendar (with `sync_to_google`) stay there: revoking does not delete
  them, and the LMS can no longer change or delete those copies afterwards. That is expected; nothing to change.
- `google_event_id` values stay on the LMS events. After a later reconnect the person can edit them again.
- Writing the response: `204` has no body, as today.

## What changes in the front-end once this is done

- The "Also remove access in your Google account" link on the Settings Google card is removed; **Disconnect** is the only
  step. (Today it stays, because the server only forgets its own copy.) Please tell us when this is deployed.
- Nothing else: the front-end already calls `POST /auth/google/logout` and treats `204` as success.
