export function main(t){return t.ui.html`
    <div data-user-shell>
      <div data-user-trigger></div>
      <dialog aria-labelledby="${t.index}-title" data-on-cancel="cancel" data-on-click="closeOnBackdrop">
      </dialog>
    </div>
  `}export function trigger(t){const a=t.getState();return t.ui.html`
    <div class="account-header">
    <button type="button" class="account-button ${t.isLoggedIn()?"signed-in":""}"
            data-on-click="open" aria-haspopup="dialog">
      ${e(t)}
      <span>${a?a.user:t.labels.login}</span>
    </button>
    ${a&&t.ui.html`<button type="button" class="logout-button" data-on-click="logout"
        aria-label="${t.labels.logout}" title="${t.labels.logout}">${i(t,"logout")}</button>`}
    </div>
  `}export function dialog(a){const{gui:o,labels:s}=a,l="delete"===o.mode,u="register"===o.mode;let r,n;return a.isLoggedIn()?(r=l?s.deleteTitle:s.profile,n=l?function(e){const{gui:i,labels:a}=e;return e.ui.html`
    <p class="description">${a.deleteDescription}</p>
    ${t(e)}
    <div class="actions">
      <button type="button" class="secondary" data-on-click="keepAccount"
              ${i.busy&&"disabled"} autofocus>${a.keepAccount}</button>
      <button type="button" class="danger" data-on-click="deleteAccount"
              ${i.busy&&"disabled"}>${a.confirmDelete}</button>
    </div>
  `}(a):function(a){const{labels:o}=a,s=a.getState();return a.ui.html`
    <div class="profile-overview">
      ${a.profilePicture&&"ccm"===s.provider?a.ui.html`
        <div class="profile-picture">
          <button type="button" class="edit-picture" data-on-click="choosePicture"
                  aria-label="${o.uploadPicture}" title="${o.uploadPicture}" ${a.gui.busy&&"disabled"}>
            ${e(a)}
            <span class="picture-pencil" aria-hidden="true">✎</span>
          </button>
          <input name="profilePicture" type="file" hidden
                 accept="image/png,image/jpeg,image/gif,image/webp,image/avif" data-on-change="uploadPicture">
          ${a.gui.hasPicture&&a.ui.html`
            <button type="button" class="remove-picture" data-on-click="removePicture" ${a.gui.busy&&"disabled"}>
              ${o.removePicture}
            </button>`}
        </div>`:e(a)}
      <dl class="profile-data">
        <dt>${o.user}</dt><dd>${s.user}</dd>
        <dt>${o.userId}</dt><dd class="user-id">${s.key}</dd>
        <dt>${o.provider}</dt><dd>${s.provider}</dd>
      </dl>
    </div>
    ${t(a)}
    <button type="button" class="primary" data-on-click="logout" autofocus>
      ${i(a,"logout")}
      ${o.logout}
    </button>
    ${"ccm"===s.provider&&a.ui.html`<footer class="account-actions">
      <button type="button" class="delete-link" data-on-click="requestDelete">
        ${o.deleteAccount}
      </button>
    </footer>`}
  `}(a)):(r=u?s.registerTitle:s.title,n=function(e){const{gui:i,labels:a}=e,o="register"===i.mode;return e.ui.html`
    <form data-on-submit="submit">
      <fieldset ${i.busy&&"disabled"}>
        <label>
          ${a.user}
          <input name="user" type="text" autocomplete="username"
                 value="${i.username}" required autofocus>
        </label>
        <label>
          ${a.password}
          <input name="password" type="password"
                 autocomplete="${o?"new-password":"current-password"}" required>
        </label>
        ${o&&e.ui.html`
          <label>
            ${a.confirmation}
            <input name="confirmation" type="password" autocomplete="new-password" required>
          </label>
        `}
        ${t(e)}
        <button type="submit" class="primary">${o?a.register:a.login}</button>
      </fieldset>
    </form>
    ${e.registration&&e.ui.html`
      <button type="button" class="text-button" data-on-click="switchMode" ${i.busy&&"disabled"}>
        ${o?a.showLogin:a.showRegister}
      </button>
    `}
    ${!o&&e.ui.html`<div class="auth-divider">${a.or}</div>
      <div class="auth-providers" data-auth-providers></div>`}
  `}(a)),a.ui.html`
    <div class="dialog-container">
      <section class="card">
        <header class="dialog-header">
          <h1 id="${a.index}-title">${r}</h1>
          <button type="button" class="close-button" data-on-click="cancel"
                  aria-label="${s.close}" ${a.isLoggedIn()&&o.busy&&"disabled"}>
            ${i(a,"close")}
          </button>
        </header>
        ${n}
      </section>
    </div>
  `}function t(t){return t.ui.html`
    <p class="message" role="${t.gui.message?"alert":"status"}" aria-live="polite"
    >${t.gui.busy?"profile"===t.gui.mode?t.labels.savingPicture:t.labels.pending:t.gui.message}</p>
  `}function e(t){const e=t.getState(),a="ccm"===e?.provider&&t.gui.picture||e?.picture;return t.ui.html`
    <span class="avatar" aria-hidden="true">
      ${i(t,e?"user":"login")}
      ${a&&t.ui.html`<img src="${a}" alt="" referrerpolicy="no-referrer"
        data-on-error="hideProfilePicture" />`}
    </span>
  `}function i(t,e){const i=t.icons[e].trim(),a=/^<svg[\s>]/i.test(i)?t.ui.raw(i):t.ui.html`<img src="${i}" alt="" />`;return t.ui.html`<span class="icon" aria-hidden="true">${a}</span>`}
//# sourceMappingURL=https://cdn.jsdelivr.net/gh/ccmjs/user@v1.0.0/resources/views.mjs.map