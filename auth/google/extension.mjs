import { login as openPopup } from "./google.mjs";

/** Default configuration for the optional Google authentication extension. */
export const defaults = {
  url: new URL("./google.html", import.meta.url).href,
  displayName: "name",
  picture: true,
  labels: {
    button: "Sign in with Google",
    failed: "Google sign-in failed. Please try again.",
    popupBlocked: "Please allow the login popup and try again.",
    timeout: "Google sign-in timed out. Please try again.",
    cancelled: "Login cancelled.",
    popup: {
      language: "en",
      title: "Sign in with Google",
      heading: "Sign in for",
      retry: "Try again",
      loading: "Loading Google sign-in …",
      transferring: "Returning sign-in to the website …",
      loadFailed: "Google could not be loaded. Please try again.",
      invalidURL: "An HTTPS address is required (HTTP is allowed locally).",
      invalidRequest: "Please open this page using the user component's Google button.",
      missingClientId: "The Google client ID is missing in auth/google/google-config.mjs.",
    },
  },
};

/**
 * Creates an extension that adds Google sign-in to a user component's provider slot.
 * @param {Object} [config] - Optional popup URL, profile settings and label overrides
 * @param {string} [config.url] - Hosted Google login page
 * @param {"name"|"given_name"|"family_name"|"email"|"id"} [config.displayName="name"] - Verified claim used as display name
 * @param {boolean} [config.picture=true] - Include the profile picture in the session
 * @param {Object} [config.labels] - Button, error and nested popup labels
 * @returns {Function} Handler for the user component's render and cancel events
 */
export function google(config = {}) {
  const labels = {
    ...defaults.labels,
    ...config.labels,
    popup: { ...defaults.labels.popup, ...config.labels?.popup },
  };
  const url = config.url ?? defaults.url;

  /** Active popup per user instance; a shared extension never shares sessions between instances. */
  const pending = new WeakMap();

  /** Exchanges the popup result through the user component's public login API. */
  const signIn = async (app) => {
    if (app.gui.busy || pending.has(app)) return;
    // Opening synchronously in the click handler preserves the browser's popup permission.
    const operation = openPopup({ url, labels });
    pending.set(app, operation);
    app.gui.busy = true;
    app.gui.message = "";
    app.start().catch(console.error);
    try {
      const credentials = await operation.promise;
      if (pending.get(app) !== operation || !app.gui.dialog) return;
      app.gui.busy = false;
      await app.login({
        ...credentials,
        displayName: config.displayName ?? defaults.displayName,
        picture: config.picture ?? defaults.picture,
      }, "google");
    } catch (error) {
      if (pending.get(app) !== operation) return;
      if (app.isLoggedIn()) console.error(error);
      else app.gui.message = error.name === "AbortError" ? "" : labels.failed;
    } finally {
      if (pending.get(app) === operation) {
        pending.delete(app);
        app.gui.busy = false;
        await app.start();
      }
    }
  };

  return ({ app, type }) => {
    // Child user instances delegate authentication and never contribute their own provider UI.
    if (app.getSessionOwner() !== app) return;
    if (type === "cancel") {
      const operation = pending.get(app);
      pending.delete(app);
      operation?.cancel();
      return;
    }
    if (type !== "render" || !app.gui.dialog || app.isLoggedIn() || app.gui.mode !== "login") return;
    const slot = app.element?.querySelector("[data-auth-providers]");
    if (!slot || slot.querySelector('[data-provider="google"]')) return;
    const button = slot.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.dataset.provider = "google";
    button.textContent = labels.button;
    button.disabled = app.gui.busy;
    button.addEventListener("click", () => signIn(app).catch(console.error));
    slot.append(button);
  };
}
