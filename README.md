# ccmjs User Component

A user component for the local `ccm` authentication provider of ccm-server.
It provides registration, login and logout without a build step.

## Local demo

Serve the parent directory containing the `user` and `framework` checkouts,
for example with `python3 -m http.server 8000 --bind 127.0.0.1`.
Start ccm-server on port 8080 and open `http://localhost:8000/user/`.

The demo uses `../framework/ccm.js` so it includes the current `getToken()`
integration. Adjust the script URL for deployment. The component itself
declares the public framework URL and resolves its views and CSS relative
to its own module URL. Change `url` in the demo to use another server.

## Usage

```javascript
const user = await ccm.start("./ccm.user.mjs", {
  url: "http://localhost:8080",
  onchange: ({ type, user }) => console.log(type, user),
}, document.querySelector("main"));

// Resolves after successful interactive authentication; cancellation rejects
await user.login();

const store = await ccm.store({
  name: "messages",
  url: user.url,
  user,
  observe: {},
  onchange: dataset => console.log(dataset),
});
```

Authenticate before creating an observed store: existing subscriptions are not
automatically renewed when the user logs in or out. Closing and recreating the
store registers a new subscription with the current token.

## Public methods

| Method | Result |
| --- | --- |
| `start()` | Renders the current state without discarding the session |
| `login()` | Opens the form and waits for successful authentication |
| `login({ user, password })` | Logs in with supplied credentials |
| `register()` | Opens the registration form and waits for success |
| `register({ user, password })` | Creates an account and logs in |
| `deleteAccount()` | Marks the authenticated account as deleted and signs out after success |
| `logout()` | Discards the session and cancels pending interactive authentication |
| `isLoggedIn()` | Whether the instance currently holds a token |
| `getToken()` | JWT or `null` |

Interactive cancellation rejects with `AbortError`. Invalid credentials leave
the form open for another attempt. A successful registration satisfies a pending
`login()` as well. Programmatic failures reject with the server error.

Configuration is documented directly in `ccm.user.mjs`. Override `labels`,
`icons`, `views` or `css` to customize the interface. `registration: false` hides and
disables registration in this component; it does not disable the server endpoint.
`onchange({ app, type, user })` runs after login, registration, logout and account deletion;
`type` is `login`, `register`, `logout` or `deleteAccount` (deletion emits logout first). Its user metadata contains no token.

`icons.login`, `icons.user` and `icons.close` accept complete inline SVG markup
(starting with `<svg`) or an image URL (SVG, PNG, JPG). Formats can be mixed:

```js
icons: {
  login: "./resources/login.svg",
  user: "./resources/avatar.png",
  close: '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M6 6l12 12M6 18L18 6"/></svg>',
}
```

The component sizes icons through `.icon` and marks them as decorative.
Inline SVG can inherit the text color through `currentColor`; image files keep
their own colors. The defaults are inline SVG and need no extra image requests.
Inline markup is trusted developer configuration, not sanitized user input.

The session exists only in this component instance's memory. Reloading the page
logs out. No passwords or JWTs are written to browser storage. Token expiration is
verified by the server; `isLoggedIn()` does not validate the JWT. Logout discards
the local token and does not revoke a previously issued JWT. Use HTTPS in deployment.
OIDC and dataset permissions are separate future steps.

## Tests

```bash
node --test
```

These tests cover the component's authentication flow with a controlled transport.
The sibling ccm-server repository contains the real-server integration test.

## Rendering

Views in `resources/views.mjs` use `app.ui.html` from the bundled
`libs/ccm-ui/ccm-ui.mjs`. The component renders them with
`ui.render(view, element, instance)`. Declarative `data-on-*` attributes
connect the templates to `instance.events`, following the Quiz component.
Dynamic text and quoted attribute values are escaped before interpolation.

Configuration defines component options. `app.state` contains only domain data:
`key`, `user` and `realm`. The separate `app.gui` object contains transient GUI
state: `mode`, `busy`, `message`, `username`, `cancellable` and `dialog`. Views read
from both objects. Serializing `state` excludes GUI state; restoring GUI state
through routing or browser storage is a separate, explicit concern.
After authentication, `state.key`, `state.user` and `state.realm` contain the
user metadata; after logout all three are `null`. Only the token, the pending authentication promise
and the generation counter remain private. Read the token through `getToken()`
and user metadata directly through `state.key`, `state.user` and `state.realm`.

Responsive component styles use container queries instead of viewport-based media
queries. The modal content defines the `ccm-user-dialog` inline-size container.
The header button fits its embedding area; the modal content adapts to its own width.

## Header button and modal dialogs

Initially only a compact sign-in button with an icon is shown. Clicking it opens
the native modal dialog. After authentication it closes and the header displays
a user icon with the username. Clicking this opens the profile with the username,
user ID, provider, sign-out action and a discreet delete-account action.
Custom user images and profile editing are not implemented yet.

Escape or the close button dismisses the modal. Dismissing an interactive login
rejects its promise with `AbortError`; dismissing the profile keeps the session.
The native dialog traps focus while open and focus returns to the header button
when it closes. Styles are nested under `.root` and rely on Shadow DOM for
isolation. When disabling Shadow DOM, developers must adapt the CSS prefixes
to avoid conflicts with other components.

Account deletion first shows a confirmation. The server sets `deleted: true`;
the account data is retained. Its username can be registered again immediately,
creating a new account with a new key. The old account can
no longer log in, its tokens are rejected on subsequent requests, and its observe
subscriptions on this server are removed. Other application data is unchanged.
The updated ccm-server must be restarted to enable the delete-account endpoint.
