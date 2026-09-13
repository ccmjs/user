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
  const { gui, labels } = app;
  const deleting = gui.mode === "delete";
  const registering = gui.mode === "register";
  let title;
  let content;
  if (app.isLoggedIn()) {
    title = deleting ? labels.deleteTitle : labels.profile;
    content = deleting ? deletion(app) : profile(app);
  } else {
    title = registering ? labels.registerTitle : labels.title;
    content = authentication(app);
  }
  return app.ui.html`
    <div class="dialog-container">
      <section class="card">
        <header class="dialog-header">
          <h1 id="${escape(app.index)}-title">${escape(title)}</h1>
          <button type="button" class="close-button" data-on-click="cancel"
                  aria-label="${escape(labels.close)}" ${deleting && gui.busy && "disabled"}>
            ${icon(app, "close")}
          </button>
        </header>
        ${content}
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
    ${state.realm === "ccm" && app.ui.html`<footer class="account-actions">
      <button type="button" class="delete-link" data-on-click="requestDelete">
        ${escape(labels.deleteAccount)}
      </button>
    </footer>`}
  `;
}

function deletion(app) {
  const { gui, labels } = app;
  return app.ui.html`
    <p class="description">${escape(labels.deleteDescription)}</p>
    ${message(app)}
    <div class="actions">
      <button type="button" class="secondary" data-on-click="keepAccount"
              ${gui.busy && "disabled"} autofocus>${escape(labels.keepAccount)}</button>
      <button type="button" class="danger" data-on-click="deleteAccount"
              ${gui.busy && "disabled"}>${escape(labels.confirmDelete)}</button>
    </div>
  `;
}

function authentication(app) {
  const { gui, labels } = app;
  const registering = gui.mode === "register";
  return app.ui.html`
    ${app.google && app.ui.html`<button type="button" class="google-login secondary" data-on-click="google"
      ${gui.busy && "disabled"}>${escape(app.labels.googleLogin)}</button>`}
    <form data-on-submit="submit">
      <fieldset ${gui.busy && "disabled"}>
        <label>
          ${escape(labels.user)}
          <input name="user" type="text" autocomplete="username"
                 value="${escape(gui.username)}" required autofocus>
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
      <button type="button" class="text-button" data-on-click="switchMode" ${gui.busy && "disabled"}>
        ${escape(registering ? labels.showLogin : labels.showRegister)}
      </button>
    `}
  `;
}

function message(app) {
  return app.ui.html`
    <p class="message" role="${app.gui.message ? "alert" : "status"}" aria-live="polite"
    >${escape(app.gui.busy ? app.labels.pending : app.gui.message)}</p>
  `;
}

/** Renders trusted inline SVG configuration or an image URL. */
function icon(app, name) {
  const source = app.icons[name].trim();
  const content = /^<svg(?:\s|>)/i.test(source)
    ? source
    : app.ui.html`<img src="${escape(source)}" alt="" />`;
  return app.ui.html`<span class="icon" aria-hidden="true">${content}</span>`;
}

/** Escapes text and quoted attribute values for ccm-ui templates. */
function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
