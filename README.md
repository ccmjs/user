# ccmjs User Component

A user component for local `ccm` and Google authentication with ccm-server.
It provides registration, login and logout without a build step.

## Local demo

Serve this directory, for example with
`python3 -m http.server 8000 --bind 127.0.0.1`.
Start ccm-server on port 8080 and open `http://localhost:8000/`.

The demo and component use the bundled `libs/framework/ccm.js`. Views and CSS resolve
relative to the component module URL.
The page loads `demo` from `resources/configs.mjs`, enabling registration and Google
authentication. Change `url` there to use another server.

## Usage

```javascript
const user = await ccm.start("./ccm.user.mjs", {
  url: "http://localhost:8080",
  extensions: [({app, type}) => console.log(type, app.getState())],
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

Authenticate before creating an observed store. On status 401 or 403, the framework
uses this user component for one re-login attempt and retries the failed HTTP request
or subscription once. Concurrent failures share the login dialog. The application
is not restarted. HTTP failures reject; observe failures reach `store.onerror`.
Logging out manually does not close existing subscriptions: close them explicitly
when ending observation or changing users.

## Public methods

| Method                         | Result                                                                 |
|--------------------------------|------------------------------------------------------------------------|
| `start()`                      | Renders the current state without discarding the session               |
| `login()`                      | Opens the form and waits for successful authentication                 |
| `login({ user, password })`    | Logs in with supplied credentials                                      |
| `login({ idToken }, "google")` | Logs in with a Google ID token verified by the server                  |
| `register()`                   | Opens the registration form and waits for success                      |
| `register({ user, password })` | Creates an account and logs in                                         |
| `deleteAccount()`              | Marks the authenticated account as deleted and signs out after success |
| `logout()`                     | Discards the session and cancels pending interactive authentication    |
| `isLoggedIn()`                 | Whether the instance currently holds a token                           |
| `getState()`                   | Copy of user metadata or `null`                                        |
| `getToken()`                   | JWT or `null`                                                          |
| `getSessionOwner()`            | Highest matching user instance responsible for the shared session      |
| `emit(type)`                   | Runs configured extensions sequentially with `{ app, type }`           |

Interactive cancellation rejects with `AbortError`. Invalid credentials leave
the form open for another attempt. A successful registration satisfies a pending
`login()` as well. Credential-based calls reject on validation, server or extension
errors. Interactive login resolves once authentication succeeds, before extensions
run; a later extension error does not reject that already-resolved promise.

Configuration is documented directly in `ccm.user.mjs`. Override `labels`,
`icons`, `views` or `css` to customize the interface. `registration: false` hides and
disables registration in this component; it does not disable the server endpoint.
`extensions` accepts a function or an array of functions receiving `{ app, type }`.
Handlers should select the event types they handle; UI hooks are described below.
For authentication events, `app.emit(type)` awaits them sequentially in configuration order. These events are
`login`, `register`, `logout` and `deleteAccount`, emitted after the successful
action (deletion emits `logout` first). User metadata is available in `app.getState()`.
An extension error stops dispatch and rejects the operation awaiting `emit`; completed
state changes are not rolled back. If a logout extension fails during deletion,
the subsequent `deleteAccount` event is not emitted.

`icons.login`, `icons.user` and `icons.close` accept complete inline SVG markup (starting with `<svg`) or an image URL
(SVG, PNG, JPG). Formats can be mixed:

```js
icons: {
  login: "./resources/login.svg",
      user
:
  "./resources/avatar.png",
      close
:
  '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M6 6l12 12M6 18L18 6"/></svg>',
}
```

The component sizes icons through `.icon` and marks them as decorative.
Inline SVG can inherit the text color through `currentColor`; image files keep
their own colors. The defaults are inline SVG and need no extra image requests.
Inline markup is trusted developer configuration, not sanitized user input.

By default, `session: true` saves the CCM JWT and public user metadata in
`sessionStorage`, so login survives reloads in the same tab. During `ready()`, the
component restores this cached session locally, without a server request or a new
`login` event. Malformed entries are discarded.
The displayed login is provisional: token expiration and account deletion are
checked on the next authenticated server request. A datastore configured with this
user component then performs the framework's one re-login attempt on 401/403.
Without a server request, an invalid session may still appear logged in.

Set `session: false` for memory-only authentication. Storage keys include the server
URL and `realm` (default: `"ccm"`). Use distinct realms to isolate
independent user areas on the same server. Independent instances with the same server
and realm read the same saved session on initialization but do not synchronize later
changes. Instances sharing an ancestor user instead use its live session as described below.
Browser storage belongs to the embedding page's origin, not the component's host.
It is accessible to JavaScript on that origin. Blocked storage falls back to memory.
Passwords, Google ID tokens and GUI state are never saved.

Logout and successful account deletion remove the saved token. Token expiration is
verified by the server; `isLoggedIn()` only checks the in-memory session.
Logout does not revoke a previously issued JWT. Use HTTPS in deployment.
Google popup login is described in [auth/google/GOOGLE-SETUP.md](auth/google/GOOGLE-SETUP.md).
MIA OIDC remains a separate future step. Dataset permissions are enforced by the server.

## Tests

```bash
node --test
```

These tests cover authentication, concurrent requests, session restoration, instance
hierarchies, view output, and the Google popup handshake and failure paths using
controlled transports and browser substitutes. The sibling ccm-server repository
contains real-server integration tests. Native dialog focus, Enter submission,
CSS animations and password-manager extensions still need testing in a real browser.

## Rendering

Views in `resources/views.mjs` use `app.ui.html` from the bundled
`libs/ccm-ui/ccm-ui.mjs`. The component renders them with
`ui.render(view, element, instance)`. Declarative `data-on-*` attributes
connect the templates to `instance.events`, following the Quiz component.
Dynamic text and quoted attribute values are escaped before interpolation.

Configuration defines component options. User metadata remains private.
`app.getState()` returns `null` when logged out or a copy of the complete
`UserIdentity` with `key`, `user`, `realm`, `provider` and an optional `picture` when logged in.
Changing the returned object does not change the session. The separate `app.gui`
object contains transient GUI state: `mode`, `busy`, `message`, `username` and `dialog`.
Views read metadata through `getState()` and GUI state through `app.gui`. Persisting GUI state is a separate, explicit
concern.
The token, pending authentication promise and request version counter also remain
private. Read the token through `getToken()`.

Responsive component styles use container queries instead of viewport-based media
queries. The modal content defines the `dialog` inline-size container.
The header button fits its embedding area; the modal content adapts to its own width.

## Header button and modal dialogs

Initially only a compact sign-in button with an icon is shown. Clicking it opens
the native modal dialog. After authentication it closes and the header displays
the profile picture or user icon with the username. Clicking this opens the profile with the username,
user ID, provider, sign-out action and a discreet delete-account action.
Profile editing and image uploads are not implemented.

Google sign-in can supply an optional `picture` URL in `getState()`. The trigger and profile
show this image instead of the standard user icon, falling back to the icon if
loading fails. The URL is cached with the session; loading the image makes an
HTTPS request to its host without sending the page URL as a referrer. No additional
Google permissions are requested.

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

## Reading the implementation

Start with `ccm.user.mjs`: configuration defines dependencies and defaults, followed
by `state` (user metadata), `gui` (presentation) and the instance methods. Public
methods use `this`; private helpers stay inside the instance closure. `events`
connects user interactions to these methods, and `render` updates the views.

`login(credentials)` and `register(credentials)` use the same `authenticate` flow.
Without credentials, `promptLogin` opens the form and shares one promise between
waiting callers. Submitting the form calls `authenticate`; success resolves the
waiting promise, while a failed submission keeps the form available for retry.

Logout and dialog cancellation advance `requestVersion`. Responses from older
requests cannot restore a discarded session or overwrite a newer form state.
This invalidates results locally; it does not cancel the request on the server.

## Separate user areas

Set `realm: "tea-app"` alongside the absolute server `url` to use accounts in
`__users-tea-app`. The default is `realm: "ccm"` (`__users-ccm`). Realm names use
1–32 lowercase letters, digits, underscores or hyphens, beginning with a letter.
`state.realm` identifies this user area; `state.provider` identifies the sign-in
method (`ccm` or `google`). Google can be used within any realm.

A dataset's owner identity is `${user.getState().realm}:${user.getState().key}`. When creating
a protected dataset, pass `_` with the desired read/write/delete grants; the server
sets its owner from your JWT. Public datasets without `_` cannot be claimed later.

## User instances in a component hierarchy

Each application component can keep its own `config.user` instance. During `init()`,
each user instance normalizes its server URL. In `ready()`, a while loop walks the
parent chain and selects the highest compatible user with the same URL and realm.
References to the user instance itself are skipped. Different
realms/servers remain independent; siblings without a matching ancestor remain
independent too. Parent relationships and configuration must be established before
initialization; changing the hierarchy afterward does not rebind sessions.

Only the session owner renders its UI and accesses sessionStorage. Its configuration
controls registration, authentication extensions and session persistence. Child user instances
forward login, registration, logout, account deletion and token access. Their
`getState()` delegates to the owner and returns a copy of its metadata, or `null`
after logout. Their own GUI state is unused.
Only the owner's UI triggers DOM handlers. Calling `start()` on a child clears its own element.

The owner dispatches authentication events to its own extensions first, followed by
attached instances in initialization order. Each receives `{ app, type }` with its
own user instance as `app`. As before, an extension failure stops dispatch and
propagates without reverting the completed state change. Calling `emit()` directly
on a child invokes its own extensions and listeners. Restoration emits no login event.

`getSessionOwner()` lets the updated framework group concurrent re-login attempts
from different user instances. They share one logout/login attempt and one pending
interactive login promise, without canceling each other's dialogs.

Version-independent cooperation uses the public `subscribe(listener)` and
`getSessionOwner()` methods, together with the authentication methods above.
Registered listeners receive event types. Child instances
subscribe once during `ready()` and dispatch the received events through their
own `emit()`. No module-level registry or global browser state is needed. Different
module versions can cooperate if they implement this interface; older versions
without it remain independent. Applications continue to use only `config.user`
and `extensions` and do not need to call these coordination methods themselves.

## External authentication extensions

The component has no Google-specific configuration or UI. Enable Google by adding
its extension (the demo already does this):

```javascript
const config = {
  extensions: [["ccm.load", "././resources/extensions.mjs#google"]],
  google: {
    url: "https://ccmjs.github.io/user/auth/google/google.html",
    labels: {button: "Sign in with Google"},
  },
};
```

`resources/extensions.mjs` exports event handlers loaded through CCM dependencies,
following the same convention as the quiz component. Only the Google extension reads
`config.google`; the user component itself does not interpret these settings.
The extension creates a handler per instance on first use, preserving its popup state
across subsequent events. Omit the extension to disable Google login.
The Google setup guide documents nested popup label overrides.

Other providers can use the same public extension contract:

- `render` supplies `{ app, type }` after the dialog is updated.
  Add buttons to `app.element.querySelector("[data-auth-providers]")`. The default view
  provides this slot only in login mode. Check `app.gui.dialog` and `app.isLoggedIn()`;
  render events also occur while the dialog is closed. Custom views must provide
  the slot if they support external login. Append without replacing other extensions' buttons.
- `cancel` runs when the dialog is dismissed or `logout()` begins. Cancel outstanding
  provider work and ignore late results.
- All events await extensions sequentially and then reach subscribed child instances.
  Provider extensions ignore child instances using `app.getSessionOwner() !== app`.
  An extension error stops further dispatch. Rendering and cancellation report hook
  errors to the console; `start()` waits for the render hooks to finish.
- Set `app.gui.busy` while collecting external credentials, update `app.gui.message`
  for errors, and call `app.start()` to refresh the UI. Clear busy before calling
  `app.login(credentials, provider)`. The server validates provider credentials and
  returns `{ key, user, realm, provider, token }` and optionally `picture`.

An extension manages its own pending operations, keyed by user instance when the
same extension function is reused. Only the session owner's extensions add UI.
The generic divider and button layout belong to the component; provider branding,
labels and popup behavior belong to the extension. MIA can follow this contract
without another provider-specific branch in the user component.

### Google profile settings

Set `google.displayName` to `"name"` (default), `"given_name"`, `"family_name"`,
`"email"` or `"id"`. The server selects the value from the verified Google ID token.
`"id"` means Google's subject (`sub`), not the local CCM account key. Missing or blank
fields fall back to `sub`. The selected display name does not change account identity.
Set `google.picture` to `false` to omit the picture from the returned and saved session
(default: `true`). These settings apply on the next Google login, not to restored sessions.
They do not change which claims Google includes in its ID token. The CCM server must
support the `displayName` and `picture` credential options.
