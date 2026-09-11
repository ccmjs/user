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
| `logout()` | Discards the session and cancels pending interactive authentication |
| `isLoggedIn()` | Whether the instance currently holds a token |
| `getToken()` | JWT or `null` |

Interactive cancellation rejects with `AbortError`. Invalid credentials leave
the form open for another attempt. A successful registration satisfies a pending
`login()` as well. Programmatic failures reject with the server error.

Configuration is documented directly in `ccm.user.mjs`. Override `labels`,
`views` or `css` to customize the interface. `registration: false` hides and
disables registration in this component; it does not disable the server endpoint.
`onchange({ app, type, user })` runs after login, registration and logout;
`type` is `login`, `register` or `logout`. Its user metadata contains no token.

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

The view reads its state directly from `app.state`:
`key`, `user`, `realm`, `mode`, `busy`, `message`, `username` and `cancellable`.
After authentication, `state.key`, `state.user` and `state.realm` contain the
user metadata; after logout all three are `null`. Only the token, the pending authentication promise
and the generation counter remain private. Read the token through `getToken()`
and user metadata directly through `state.key`, `state.user` and `state.realm`.

Responsive component styles use container queries instead of viewport-based media
queries. The component root defines the `ccm-user` inline-size container, so the
layout responds to its available embedding width independently of the page width.
