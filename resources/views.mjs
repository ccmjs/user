/** Creates the user view; ccm-ui binds data-on-* to the instance events. */
export function main(app) {
  const state = app.state;
  const labels = app.labels;
  const registering = state.mode === "register";
  return app.ui.html`
    <section class="card" aria-label="${escape(labels.title)}">
      ${app.isLoggedIn() ? app.ui.html`
        <p class="eyebrow">${escape(labels.signedIn)}</p>
        <h1>${escape(state.user)}</h1>
        <button type="button" data-on-click="logout">${escape(labels.logout)}</button>
      ` : app.ui.html`
        <h1>${escape(registering ? labels.registerTitle : labels.title)}</h1>
        <form data-on-submit="submit">
          <fieldset ${state.busy && "disabled"}>
            <label>
              ${escape(labels.user)}
              <input name="user" type="text" autocomplete="username"
                     value="${escape(state.username)}" required>
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
            <p class="message" role="${state.message ? "alert" : "status"}"
               aria-live="polite">${escape(state.busy ? labels.pending : state.message)}</p>
            <button type="submit">${escape(registering ? labels.register : labels.login)}</button>
          </fieldset>
        </form>
        ${app.registration && app.ui.html`
          <button type="button" class="secondary" data-on-click="switchMode" ${state.busy && "disabled"}>
            ${escape(registering ? labels.showLogin : labels.showRegister)}
          </button>
        `}
        ${state.cancellable && app.ui.html`
          <button type="button" class="secondary" data-on-click="cancel">${escape(labels.cancel)}</button>
        `}
      `}
    </section>
  `;
}

/** Escapes dynamic text and quoted attribute values for ccm-ui HTML templates. */
function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
