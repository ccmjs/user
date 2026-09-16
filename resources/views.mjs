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
  const state = app.getState();
  return app.ui.html`
    <button type="button" class="account-button ${app.isLoggedIn() ? "signed-in" : ""}"
            data-on-click="open" aria-haspopup="dialog">
      <span class="avatar" aria-hidden="true">
        ${icon(app, state ? "user" : "login")}
        ${state?.picture && app.ui.html`<img src="${escape(state.picture)}" alt="" referrerpolicy="no-referrer"
          data-on-error="hideProfilePicture" />`}
      </span>
      <span>${escape(state ? state.user : app.labels.login)}</span>
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

/** Creates the user profile with logout and, for local accounts, account deletion. */
function profile(app) {
  const { labels } = app;
  const state = app.getState();
  return app.ui.html`
    <div class="profile-heading">
      ${icon(app, "user")}
      <span>${escape(state.user)}</span>
    </div>
    <dl class="profile-data">
      <dt>${escape(labels.user)}</dt><dd>${escape(state.user)}</dd>
      <dt>${escape(labels.userId)}</dt><dd class="user-id">${escape(state.key)}</dd>
      <dt>${escape(labels.provider)}</dt><dd>${escape(state.provider)}</dd>
    </dl>
    <button type="button" class="primary" data-on-click="logout" autofocus>
      ${escape(labels.logout)}
    </button>
    ${
      state.provider === "ccm" &&
      app.ui.html`<footer class="account-actions">
      <button type="button" class="delete-link" data-on-click="requestDelete">
        ${escape(labels.deleteAccount)}
      </button>
    </footer>`
    }
  `;
}

/** Creates the account deletion confirmation with buttons to keep or delete the account. */
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

/** Creates the local login or registration form, offering Google only in login mode when configured. */
function authentication(app) {
  const { gui, labels } = app;
  const registering = gui.mode === "register";
  return app.ui.html`
    ${
      !registering && app.google &&
      app.ui.html`<button type="button" class="google-login secondary" data-on-click="google"
      ${gui.busy && "disabled"}>${escape(labels.googleLogin)}</button>
      <div class="auth-divider">${escape(labels.or)}</div>`
    }
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
        ${
          registering &&
          app.ui.html`
          <label>
            ${escape(labels.confirmation)}
            <input name="confirmation" type="password" autocomplete="new-password" required>
          </label>
        `
        }
        ${message(app)}
        <button type="submit" class="primary">${escape(registering ? labels.register : labels.login)}</button>
      </fieldset>
    </form>
    ${
      app.registration &&
      app.ui.html`
      <button type="button" class="text-button" data-on-click="switchMode" ${gui.busy && "disabled"}>
        ${escape(registering ? labels.showLogin : labels.showRegister)}
      </button>
    `
    }
  `;
}

/** Creates the status message, showing pending feedback while a request is in progress. */
function message(app) {
  return app.ui.html`
    <p class="message" role="${app.gui.message ? "alert" : "status"}" aria-live="polite"
    >${escape(app.gui.busy ? app.labels.pending : app.gui.message)}</p>
  `;
}

/** Renders trusted inline SVG configuration or an image URL. */
function icon(app, name) {
  const source = app.icons[name].trim();
  const content = /^<svg[\s>]/i.test(source) ? source : app.ui.html`<img src="${escape(source)}" alt="" />`;
  return app.ui.html`<span class="icon" aria-hidden="true">${content}</span>`;
}

/** Escapes text and quoted attribute values for ccm-ui templates. */
function escape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}
