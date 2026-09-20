/** Creates a stable shell so the native modal stays mounted during updates. */
export function main(app) {
  return app.ui.html`
    <div data-user-shell>
      <div data-user-trigger></div>
      <dialog aria-labelledby="${app.index}-title" data-on-cancel="cancel" data-on-click="closeOnBackdrop">
      </dialog>
    </div>
  `;
}

/** Creates the compact header button. */
export function trigger(app) {
  const state = app.getState();
  return app.ui.html`
    <div class="account-header">
    <button type="button" class="account-button ${app.isLoggedIn() ? "signed-in" : ""}"
            data-on-click="open" aria-haspopup="dialog">
      ${avatar(app)}
      <span>${state ? state.user : app.labels.login}</span>
    </button>
    ${state && app.ui.html`<button type="button" class="logout-button" data-on-click="logout"
        aria-label="${app.labels.logout}" title="${app.labels.logout}">${icon(app, "logout")}</button>`}
    </div>
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
          <h1 id="${app.index}-title">${title}</h1>
          <button type="button" class="close-button" data-on-click="cancel"
                  aria-label="${labels.close}" ${app.isLoggedIn() && gui.busy && "disabled"}>
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
    <div class="profile-overview">
      ${app.profilePicture && state.provider === "ccm" ? app.ui.html`
        <div class="profile-picture">
          <button type="button" class="edit-picture" data-on-click="choosePicture"
                  aria-label="${labels.uploadPicture}" title="${labels.uploadPicture}" ${app.gui.busy && "disabled"}>
            ${avatar(app)}
            <span class="picture-pencil" aria-hidden="true">✎</span>
          </button>
          <input name="profilePicture" type="file" hidden
                 accept="image/png,image/jpeg,image/gif,image/webp,image/avif" data-on-change="uploadPicture">
          ${app.gui.hasPicture && app.ui.html`
            <button type="button" class="remove-picture" data-on-click="removePicture" ${app.gui.busy && "disabled"}>
              ${labels.removePicture}
            </button>`}
        </div>` : avatar(app)}
      <dl class="profile-data">
        <dt>${labels.user}</dt><dd>${state.user}</dd>
        <dt>${labels.userId}</dt><dd class="user-id">${state.key}</dd>
        <dt>${labels.provider}</dt><dd>${state.provider}</dd>
      </dl>
    </div>
    ${message(app)}
    <button type="button" class="primary" data-on-click="logout" autofocus>
      ${icon(app, "logout")}
      ${labels.logout}
    </button>
    ${
      state.provider === "ccm" &&
      app.ui.html`<footer class="account-actions">
      <button type="button" class="delete-link" data-on-click="requestDelete">
        ${labels.deleteAccount}
      </button>
    </footer>`
    }
  `;
}

/** Creates the account deletion confirmation with buttons to keep or delete the account. */
function deletion(app) {
  const { gui, labels } = app;
  return app.ui.html`
    <p class="description">${labels.deleteDescription}</p>
    ${message(app)}
    <div class="actions">
      <button type="button" class="secondary" data-on-click="keepAccount"
              ${gui.busy && "disabled"} autofocus>${labels.keepAccount}</button>
      <button type="button" class="danger" data-on-click="deleteAccount"
              ${gui.busy && "disabled"}>${labels.confirmDelete}</button>
    </div>
  `;
}

/** Creates the local form with an extension slot for external providers in login mode. */
function authentication(app) {
  const { gui, labels } = app;
  const registering = gui.mode === "register";
  return app.ui.html`
    <form data-on-submit="submit">
      <fieldset ${gui.busy && "disabled"}>
        <label>
          ${labels.user}
          <input name="user" type="text" autocomplete="username"
                 value="${gui.username}" required autofocus>
        </label>
        <label>
          ${labels.password}
          <input name="password" type="password"
                 autocomplete="${registering ? "new-password" : "current-password"}" required>
        </label>
        ${
          registering &&
          app.ui.html`
          <label>
            ${labels.confirmation}
            <input name="confirmation" type="password" autocomplete="new-password" required>
          </label>
        `
        }
        ${message(app)}
        <button type="submit" class="primary">${registering ? labels.register : labels.login}</button>
      </fieldset>
    </form>
    ${
      app.registration &&
      app.ui.html`
      <button type="button" class="text-button" data-on-click="switchMode" ${gui.busy && "disabled"}>
        ${registering ? labels.showLogin : labels.showRegister}
      </button>
    `
    }
    ${!registering && app.ui.html`<div class="auth-divider">${labels.or}</div>
      <div class="auth-providers" data-auth-providers></div>`}
  `;
}

/** Creates the status message, showing pending feedback while a request is in progress. */
function message(app) {
  return app.ui.html`
    <p class="message" role="${app.gui.message ? "alert" : "status"}" aria-live="polite"
    >${app.gui.busy ? (app.gui.mode === "profile" ? app.labels.savingPicture : app.labels.pending) : app.gui.message}</p>
  `;
}

/** Creates the profile picture with a standard icon underneath as a fallback if loading fails. */
function avatar(app) {
  const state = app.getState();
  const picture = (state?.provider === "ccm" && app.gui.picture) || state?.picture;
  return app.ui.html`
    <span class="avatar" aria-hidden="true">
      ${icon(app, state ? "user" : "login")}
      ${picture && app.ui.html`<img src="${picture}" alt="" referrerpolicy="no-referrer"
        data-on-error="hideProfilePicture" />`}
    </span>
  `;
}

/** Renders trusted inline SVG configuration or an image URL. */
function icon(app, name) {
  const source = app.icons[name].trim();
  const content = /^<svg[\s>]/i.test(source) ? app.ui.raw(source) : app.ui.html`<img src="${source}" alt="" />`;
  return app.ui.html`<span class="icon" aria-hidden="true">${content}</span>`;
}
