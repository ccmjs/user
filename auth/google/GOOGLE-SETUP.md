# Google login with a hosted popup

The embedding website opens `auth/google/google.html`. This fixed page loads Google's official
button and receives its JavaScript callback. After successful Google sign-in, it passes the
Google ID token to the requesting component, which exchanges it for a CCM JWT at
its configured server. Neither the original page nor its root component restarts.

## 1. Create a Google OAuth Web client

In Google Auth Platform, create a client of type **Web application**.
For the GitHub Pages deployment of this repository, register this JavaScript origin:

```text
https://ccmjs.github.io
```

For local testing, also register `http://localhost` and `http://localhost:8000`.
Do not include `/user/auth/google/google.html` in an origin. This Google Identity Services
callback flow needs no authorized redirect URI and no client secret.
Configure the application's branding and audience in Google Auth Platform.

## 2. Configure the popup and server

Put the public client ID into `auth/google/google-config.mjs`:

```js
export const clientId = "YOUR_CLIENT_ID.apps.googleusercontent.com";
```

Add the same client ID to `auth.providers` in the CCM server's `config.json`,
keeping the existing local provider and private JWT settings:

```json
"google": {
  "type": "oidc", "flow": "id-token", "issuer": "https://accounts.google.com",
  "clientId": "YOUR_CLIENT_ID.apps.googleusercontent.com"
}
```

Restart the Node.js server. Publish `auth/google/google.html`, `auth/google/google-page.mjs`
and `auth/google/google-config.mjs` through the repository's usual GitHub Pages
workflow. The public client ID may be committed; a client secret must not be.

## 3. Run the demo

For a fully local test, serve the user repository with:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Start the CCM server on port 8080 and visit `http://localhost:8000/`.
The demo enables the Google extension and opens the hosted GitHub Pages popup.
To test locally, set `google.url` to `"http://localhost:8000/auth/google/google.html"`
in `resources/configs.mjs`. Omit the extension to disable Google login.
The popup must be opened through the component, not directly.

To use the extension from a different website:

```js
await ccm.start("https://ccmjs.github.io/user/ccm.user.mjs", {
  url: "https://YOUR_CCM_SERVER",
  extensions: [["ccm.load", "https://ccmjs.github.io/user/resources/extensions.mjs#google"]],
}, document.querySelector("main"));
```

The extension loads its popup adapter through a regular module import. Its default
popup URL resolves relative to the extension module. Publish `resources/extensions.mjs`, `auth/google/extension.mjs` and
`google.mjs` along with the hosted popup files.

The embedding website does not need registration with Google. It must allow the
popup and its communication with the opener. Restrictive sandbox or COOP policies
can block this; the flow reports cancellation or times out rather than navigating
the embedding page. Google's own button can open an additional account-selection
popup; allow popups when the browser asks.

## Expected behavior

- Open the component's login dialog, then choose Google.
- The hosted popup displays the requesting website and loads Google's sign-in button automatically.
  Click the button to sign in, or close the popup to cancel.
- On success the popup closes and the component shows the server-provided name.
- Cancelling the popup leaves the login dialog available for another attempt.
- Local password login and registration continue to work.
- Google accounts use issuer and subject, never automatic email-based linking.
- Local account deletion remains available only for password accounts. Google
  account deletion and the MIA authorization-code flow are not implemented here.

The popup checks message origin, source window and a random per-attempt identifier.
The ID token travels in `postMessage` and JSON POST, not in URLs or browser storage.
The server verifies Google's signature, issuer, audience, expiration and subject
using `jose` and Google's fixed public-key endpoint. The initial proof is a bearer
token: give it only to a website you trust. All content on the hosting origin must
be trusted as well; URL paths do not create separate browser security boundaries.

Automated tests cover signed-token validation, account mapping and popup routing.
A real Google account test requires the client ID and published/local origin setup.

References:
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

## Popup labels

Override Google-specific text under `config.google` (read only by the extension):

```javascript
google: {
  labels: {
    button: "Mit Google anmelden",
    failed: "Google-Anmeldung fehlgeschlagen.",
    popup: {
      language: "de",
      title: "Mit Google anmelden",
      heading: "Anmelden für",
      retry: "Erneut versuchen",
      loading: "Google-Anmeldung wird geladen …",
    },
  },
}
```

All keys and English defaults are in `defaults` in `extension.mjs`. The factory
merges partial label overrides, including nested popup labels. Labels travel through
the validated opener handshake and are inserted as plain text. Before that handshake,
the page uses English fallback text. `language` sets the page language and Google
button locale; Google's account selection and consent screens remain controlled by Google.

### Google profile settings

Set `google.displayName` to `"name"` (default), `"given_name"`, `"family_name"`,
`"email"` or `"id"`. The server selects the value from the verified Google ID token.
`"id"` means Google's subject (`sub`), not the local CCM account key. Missing or blank
fields fall back to `sub`. The selected display name does not change account identity.
Set `google.picture` to `false` to omit the picture from the returned and saved session
(default: `true`). These settings apply on the next Google login, not to restored sessions.
They do not change which claims Google includes in its ID token. The CCM server must
support the `displayName` and `picture` credential options.
