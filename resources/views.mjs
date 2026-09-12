/** Creates a stable shell so the native modal stays mounted during updates. */
export function main(app) {
  return app.ui.html`
    <div data-user-shell>
      <div data-user-trigger></div>
      <dialog aria-labelledby="${escape(app.index)}-title" data-on-cancel="cancel">
      </dialog>
    </div>
  `;
}

/** Creates the compact header button. */
export function trigger(app) {
  return app.ui.html`
    <button type="button" class="account-button ${app.isLoggedIn() ? "signed-in" : ""}"
            data-on-click="open" aria-haspopup="dialog">
      ${icon(app, app.isLoggedIn() ? "user" : "login")}
      <span>${escape(app.isLoggedIn() ? app.state.user : app.labels.login)}</span>
    </button>
  `;
}

/** Creates the active dialog view without exposing the JWT. */
export function dialog(app) {
  const { state, labels } = app;
  const deleting = state.mode === "delete";
  const registering = state.mode === "register";
  const title = app.isLoggedIn()
    ? deleting ? labels.deleteTitle : labels.profile
    : registering ? labels.registerTitle : labels.title;
  return app.ui.html`
    <div class="dialog-container">
      <section class="card">
        <header class="dialog-header">
          <h1 id="${escape(app.index)}-title">${escape(title)}</h1>
          <button type="button" class="close-button" data-on-click="cancel"
                  aria-label="${escape(labels.close)}" ${deleting && state.busy && "disabled"}>
            ${icon(app, "close")}
          </button>
        </header>
        ${app.isLoggedIn()
          ? deleting ? deletion(app) : profile(app)
          : authentication(app)}
      </section>
    </div>
  `;
}

function profile(app) {
  const { state, labels } = app;
  return app.ui.html`
    <div class="profile-heading">
      ${icon(app, "user")}
      <span>${escape(state.user)}</span>
    </div>
    <dl class="profile-data">
      <dt>${escape(labels.user)}</dt><dd>${escape(state.user)}</dd>
      <dt>${escape(labels.userId)}</dt><dd class="user-id">${escape(state.key)}</dd>
      <dt>${escape(labels.provider)}</dt><dd>${escape(state.realm)}</dd>
    </dl>
    <button type="button" class="primary" data-on-click="logout" autofocus>
      ${escape(labels.logout)}
    </button>
    <footer class="account-actions">
      <button type="button" class="delete-link" data-on-click="requestDelete">
        ${escape(labels.deleteAccount)}
      </button>
    </footer>
  `;
}

function deletion(app) {
  const { state, labels } = app;
  return app.ui.html`
    <p class="description">${escape(labels.deleteDescription)}</p>
    ${message(app)}
    <div class="actions">
      <button type="button" class="secondary" data-on-click="keepAccount"
              ${state.busy && "disabled"} autofocus>${escape(labels.keepAccount)}</button>
      <button type="button" class="danger" data-on-click="deleteAccount"
              ${state.busy && "disabled"}>${escape(labels.confirmDelete)}</button>
    </div>
  `;
}

function authentication(app) {
  const { state, labels } = app;
  const registering = state.mode === "register";
  return app.ui.html`
    <form data-on-submit="submit">
      <fieldset ${state.busy && "disabled"}>
        <label>
          ${escape(labels.user)}
          <input name="user" type="text" autocomplete="username"
                 value="${escape(state.username)}" required autofocus>
        </label>
        <label>
          ${escape(labels.password)}
          <input name="password" type="password"
                 autocomplete="${registering ? "new-password" : "current-password"}" required>
        </label>
        ${registering && app.ui.html`
          <label>
            ${escape(labels.confirmation)}
            <input name="confirmation" type="password" autocomplete="new-password" required>
          </label>
        `}
        ${message(app)}
        <button type="submit" class="primary">${escape(registering ? labels.register : labels.login)}</button>
      </fieldset>
    </form>
    ${app.registration && app.ui.html`
      <button type="button" class="text-button" data-on-click="switchMode" ${state.busy && "disabled"}>
        ${escape(registering ? labels.showLogin : labels.showRegister)}
      </button>
    `}
  `;
}

function message(app) {
  return app.ui.html`
    <p class="message" role="${app.state.message ? "alert" : "status"}" aria-live="polite"
    >${escape(app.state.busy ? app.labels.pending : app.state.message)}</p>
  `;
}

/** Inline icons inherit the component's text color. */
function icon(app, name) {
  const paths = {
    login: "M14 4h6v16h-6 M3 12h12 M9 6l6 6-6 6",
    user: "M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    close: "M6 6l12 12 M6 18L18 6",
  };
  return app.ui.html`
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false"><path d="${paths[name]}"></path></svg>
  `;
}

/** Escapes text and quoted attribute values for ccm-ui templates. */
function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
