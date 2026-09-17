/**
 * Local authentication and coordination of independent authentication providers.
 *
 * @author André Kless <andre.kless@web.de>
 * @copyright 2026 André Kless
 * @license MIT
 */
export const component = {
  name: "user",
  ccm: "././libs/framework/ccm.js",
  config: {
    // TODO: lang

    // Absolute server API URL for registration, login, account deletion
    url: "http://localhost:8080",

    // // User area on the server; each realm has its own saved login session.
    realm: "ccm",

    // Keep the CCM token and user metadata across reloads in this tab; logout remains local
    session: true,

    // UI utilities (templating + event binding)
    ui: ["ccm.load", "././libs/ccm-ui/ccm-ui.mjs"],

    // Component views (HTML templates)
    views: ["ccm.load", "././resources/views.mjs"],

    // Component styles (CSS)
    css: ["ccm.load", "././resources/styles.css"],

    // Whether the registration form is available
    // registration: true,

    // Extension points
    extensions: [],

    /** Independent authentication components mounted in the login dialog. */
    providers: [],

    // Inline SVG markup or image URLs (SVG, PNG, JPG)
    icons: {
      login: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M14 4h6v16h-6 M3 12h12 M9 6l6 6-6 6"/></svg>`,
      user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"/></svg>`,
      close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M6 6l12 12 M6 18L18 6"/></svg>`,
    },

    // Static UI labels
    labels: {
      title: "Sign in",
      profile: "Your profile",
      userId: "User ID",
      provider: "Sign-in provider",
      close: "Close dialog",
      deleteAccount: "Delete account",
      deleteTitle: "Delete your account?",
      deleteDescription:
        "Your account will be marked as deleted. You will be signed out and can no longer sign in. Your account data is retained.",
      confirmDelete: "Delete my account",
      keepAccount: "Keep my account",
      deletionFailed: "Account deletion failed. Please try again.",
      sessionExpired: "Your session is no longer valid. Please sign in again.",
      registerTitle: "Create an account",
      user: "Username",
      password: "Password",
      confirmation: "Confirm password",
      login: "Sign in",
      register: "Register",
      showRegister: "No account yet? Register",
      showLogin: "Already have an account? Sign in",
      logout: "Sign out",
      pending: "Please wait …",
      mismatch: "The passwords do not match.",
      invalid: "The username or password is incorrect.",
      duplicate: "This username is already taken.",
      failed: "Sign-in failed. Please try again.",
      registrationFailed: "Registration failed. Please try again.",
      registrationDisabled: "Registration is disabled.",
      loginCancelled: "Login cancelled.",
      authenticationBusy: "Authentication is already in progress.",
      invalidCredentials: "Username and password must be strings.",
      invalidAuthenticationResponse: "Invalid authentication response.",
      deletionRequiresLogin: "Sign in before deleting your account.",
      requestBusy: "A request is already in progress.",
      or: "or",
      invalidProviderCredentials: "Provider credentials must be an object.",
      invalidDeletionResponse: "Invalid account deletion response.",
    },
  },
  Instance: function () {
    /**
     * Private user metadata, or `null` when logged out. Read a copy through getState().
     * @type {UserIdentity|null}
     */
    let state = null;

    /** Transient GUI state, separate from the domain data. */
    this.gui = {
      /** Active view: login, register, profile or delete. */
      mode: "login",

      /** Whether authentication (including an external provider) or account deletion is in progress. */
      busy: false,

      /** Message displayed in the dialog; empty when there is no message. */
      message: "",

      /** Form draft; `state.user` is the authenticated username. */
      username: "",

      /** Whether the modal dialog should be open. */
      dialog: false,
    };

    /** The current authentication token, or `null` when logged out. */
    let token = null;

    /** Incrementing invalidates older responses; it does not abort the HTTP request. */
    let requestVersion = 0;

    /** Highest matching ancestor responsible for authentication, or `null` for this instance. */
    let sessionOwner = null;

    /** Event listeners used by dependent user instances, including other module versions. */
    const listeners = new Set();

    /** Shared promise and callbacks for callers waiting on the login form. */
    let pendingLogin;

    /** Provider currently delivering external credentials, or null between attempts. */
    let activeProvider = null;

    /** Session source retained after logout so automatic re-login uses the same provider. */
    let selectedProvider = null;

    /** Normalizes the server URL before any instance enters ready(). */
    this.init = async () => {
      this.url = new URL(this.url).href;
    };

    /** Joins the highest matching ancestor, or restores cached metadata locally. */
    this.ready = async () => {
      // Find the highest ancestor user instance with the same server URL and realm.
      sessionOwner = findSessionOwner();
      if (sessionOwner) {
        // Forward calls on this child user instance to the highest matching ancestor user instance.
        for (const method of ["login", "register", "logout", "deleteAccount", "isLoggedIn", "getState", "getToken"])
          this[method] = (...args) => sessionOwner[method](...args);

        // Notify this user instance's extensions and listeners when the highest matching user instance emits an event.
        sessionOwner.subscribe((type) => this.emit(type));
        return;
      }

      // Only the session owner connects provider events to its CCM session.
      for (const provider of this.providers) {
        provider.extensions = [].concat(provider.extensions || [], handleProviderEvent);
      }

      // If no parent user instance has the same server URL and realm, restore this instance's session from sessionStorage.
      selectedProvider = this.providers.find(provider => provider.isLoggedIn()) ?? null;
      if (selectedProvider) {
        sessionStorageAccess("removeItem");
        return;
      }
      const saved = sessionStorageAccess("getItem");
      if (!saved) return;
      try {
        const session = JSON.parse(saved);
        // Discard saved sessions with invalid metadata or a missing token.
        if (!isValidIdentity(session) || typeof session.token !== "string" || !session.token) {
          sessionStorageAccess("removeItem");
          return;
        }

        // Restore locally; the server checks token validity on the next authenticated request.
        token = session.token;
        state = { key: session.key, user: session.user, realm: session.realm, provider: session.provider };
        if (typeof session.picture === "string" && session.picture.startsWith("https://"))
          state.picture = session.picture;
      } catch {
        // Discard malformed session data.
        sessionStorageAccess("removeItem");
      }
    };

    /** Renders the current authentication state without resetting the session. */
    this.start = async () => render();

    /**
     * Logs in with credentials, or waits for an interactive login.
     *
     * @param {{user: string, password: string}|Object} [credentials]
     * @param {string} [provider="ccm"] - Authentication method for supplied credentials
     * @returns {Promise<UserIdentity>} User metadata
     */
    this.login = (credentials, provider = "ccm") => {
      if (this.isLoggedIn()) return Promise.resolve(this.getState());
      if (!credentials && selectedProvider) {
        this.gui.mode = "login";
        this.gui.dialog = true;
        render();
        return selectedProvider.login();
      }
      return credentials ? authenticate("login", credentials, provider) : promptLogin("login");
    };

    /**
     * Registers and logs in a local user, or opens the registration form.
     *
     * @param {{user: string, password: string}} [credentials]
     * @returns {Promise<UserIdentity>} User metadata
     */
    this.register = (credentials) => {
      if (!this.registration) return Promise.reject(new Error(this.labels.registrationDisabled));
      if (this.isLoggedIn()) return Promise.resolve(this.getState());
      return credentials ? authenticate("register", credentials) : promptLogin("register");
    };

    /** Discards the session and cancels a pending interactive login. */
    this.logout = async () => {
      requestVersion++;
      this.gui.busy = false;
      const changed = this.isLoggedIn();
      const provider = selectedProvider;
      token = null;
      sessionStorageAccess("removeItem");
      state = null;
      this.gui.username = "";
      this.gui.message = "";
      this.gui.mode = "login";
      this.gui.dialog = false;
      await cancelPendingLogin();
      render();
      if (provider) await provider.logout();
      else if (changed) await this.emit("logout");
    };

    /** Marks the current account as deleted and discards its local session. */
    this.deleteAccount = async () => {
      if (!token) throw new Error(this.labels.deletionRequiresLogin);
      if (this.gui.busy) throw new Error(this.labels.requestBusy);
      const version = ++requestVersion;
      this.gui.busy = true;
      this.gui.message = "";
      render();
      try {
        const result = await this.ccm.load({ url: this.url, method: "POST", params: { deleteAccount: true, token } });
        if (result !== true) throw new Error(this.labels.invalidDeletionResponse);
        if (version !== requestVersion) return;
      } catch (error) {
        if (version === requestVersion)
          this.gui.message = error.status === 401 ? this.labels.sessionExpired : this.labels.deletionFailed;
        throw error;
      } finally {
        if (version === requestVersion) {
          this.gui.busy = false;
          render();
        }
      }
      await this.logout();
      await this.emit("deleteAccount");
    };

    /** Returns whether this instance holds a server-issued token. */
    this.isLoggedIn = () => selectedProvider ? selectedProvider.isLoggedIn() : token !== null;

    /**
     * Returns a copy of the shared user metadata, or `null` when logged out.
     * @returns {UserIdentity|null}
     */
    this.getState = () => selectedProvider ? selectedProvider.getState() : state && { ...state };

    /** Returns the JWT, or null when logged out. */
    this.getToken = () => selectedProvider ? selectedProvider.getToken() : token;

    /** Returns the shared authentication instance for coordinating concurrent re-login attempts. */
    this.getSessionOwner = () => sessionOwner ?? this;

    /** DOM handlers bound by ccm-ui through data-on-* attributes. */
    this.events = {
      /** Reveals the standard icon beneath a profile image that could not be loaded. */
      hideProfilePicture: (event) => event.currentTarget.remove(),

      /** Opens the profile when signed in, otherwise starts an interactive login. */
      open: () => {
        if (this.isLoggedIn()) {
          this.gui.mode = "profile";
          this.gui.dialog = true;
          this.gui.message = "";
          render();
        } else {
          this.login().catch((error) => {
            if (error.name !== "AbortError") console.error(error);
          });
        }
      },

      /** Opens the account deletion confirmation without deleting the account yet. */
      requestDelete: () => {
        if (!token || this.gui.busy) return;
        this.gui.mode = "delete";
        this.gui.message = "";
        render();
      },

      /** Returns from the deletion confirmation to the profile. */
      keepAccount: () => {
        if (this.gui.busy) return;
        this.gui.mode = "profile";
        this.gui.message = "";
        render();
      },

      /** Confirms account deletion; failures remain visible in the dialog. */
      deleteAccount: () =>
        this.deleteAccount().catch(() => {
          // The failure is displayed in the dialog
        }),

      /**
       * Submits local credentials, checking password confirmation when registering.
       * @param {SubmitEvent} event - Submission of the login or registration form
       */
      submit: async (event) => {
        event.preventDefault();
        if (this.gui.busy) return;
        const fields = event.currentTarget.elements;
        const credentials = {
          user: fields.namedItem("user").value,
          password: fields.namedItem("password").value,
        };
        if (this.gui.mode === "register" && credentials.password !== fields.namedItem("confirmation").value) {
          this.gui.username = credentials.user;
          this.gui.message = this.labels.mismatch;
          render();
          return;
        }
        try {
          await authenticate(this.gui.mode, credentials);
        } catch (error) {
          // Authentication failures are displayed in the form
          if (token) console.error(error);
        }
      },

      /** Switches between login and registration, fading out the current form before rendering the next. */
      switchMode: async () => {
        if (this.gui.busy || !this.registration) return;
        const card = this.element?.querySelector(".card");
        if (card) {
          // Finish fading out before replacing the form; ignore repeated clicks during the transition.
          if (card.classList.contains("fade-out") || card.getAnimations().length) return;
          card.classList.remove("fade-in");
          card.classList.add("fade-out");
          // With reduced motion or custom CSS without animations, there is nothing to wait for.
          await Promise.allSettled(card.getAnimations().map((animation) => animation.finished));
          // Closing the dialog or another render may have replaced this form in the meantime.
          if (!card.isConnected || !this.gui.dialog || this.gui.busy) {
            card.classList.remove("fade-out");
            return;
          }
        }
        this.gui.mode = this.gui.mode === "login" ? "register" : "login";
        this.gui.message = "";
        render();
        this.element?.querySelector(".card")?.classList.add("fade-in");
      },

      /** Signs out and reports errors from logout or its extensions to the console. */
      logout: () => this.logout().catch(console.error),

      /**
       * Closes the dialog and cancels pending login attempts unless account deletion is in progress.
       * @param {Event} [event] - Close-button click or native dialog cancellation
       */
      cancel: (event) => {
        event?.preventDefault();
        if (this.gui.busy && this.gui.mode === "delete") return;
        this.gui.dialog = false;
        requestVersion++;
        this.gui.busy = false;
        this.gui.message = "";
        cancelPendingLogin();
        render();
      },
    };

    /**
     * Dispatches events sequentially; errors stop dispatch without reverting state.
     * @param {string} type - login, register, logout, deleteAccount, render or cancel
     */
    this.emit = async (type) => {
      const extensions = [].concat(this.extensions || []);
      for (const extension of extensions) if (extension) await extension({ app: this, type });
      for (const listener of listeners) await listener(type);
    };

    /**
     * Registers an event listener, allowing child user instances to forward events to their own extensions.
     * @param {function(string): (void|Promise<void>)} listener - Receives the event type
     */
    this.subscribe = (listener) => listeners.add(listener);

    /**
     * Finds the highest compatible ancestor user instance with the same server and realm.
     * @returns {object|null} Matching user instance, or `null` if this instance owns the session
     */
    const findSessionOwner = () => {
      let owner = null;
      let parent = this.parent;
      while (parent) {
        const user = parent.user;
        if (
          user &&
          user !== this &&
          typeof user.subscribe === "function" &&
          typeof user.getSessionOwner === "function" &&
          typeof user.getState === "function" &&
          user.realm === this.realm &&
          user.url === this.url
        )
          owner = user;
        parent = parent.parent;
      }
      return owner;
    };

    /**
     * Accesses the saved session for this server and realm.
     * Browser storage may be unavailable; authentication still works in memory.
     *
     * @param {"getItem"|"setItem"|"removeItem"} method - Storage operation to perform
     * @param {string} [value] - Serialized session to save; required only for setItem
     * @returns {string|null} Serialized session for getItem, otherwise `null`; also `null`
     *   when no session exists, persistence is disabled or storage access fails
     */
    const sessionStorageAccess = (method, value) => {
      if (!this.session) return null;
      try {
        const key = `ccm-user-session:${JSON.stringify([this.url, this.realm])}`;
        return sessionStorage[method](key, value) ?? null;
      } catch {
        return null;
      }
    };

    /**
     * Checks the shape of user metadata and its realm, not the token's validity.
     *
     * @param {unknown} value - User metadata, e.g. state or a saved session
     * @returns {boolean} Whether all required identity fields are valid
     */
    const isValidIdentity = (value) =>
      this.ccm.helper.isDataset(value) &&
      typeof value.key === "string" &&
      typeof value.user === "string" &&
      value.realm === this.realm &&
      typeof value.provider === "string" &&
      value.provider !== "";

    /** Updates the views while preserving the existing dialog element. */
    const render = () => {
      // Only the highest matching user instance displays the UI; child user instances keep their containers empty.
      if (sessionOwner) return this.element?.replaceChildren();

      // Create the UI shell only once so updates preserve the existing dialog, its modal state and focus handling.
      if (!this.element?.querySelector("[data-user-shell]")) this.ui.render(this.views.main(this), this.element, this);

      /** Existing dialog whose contents are updated without replacing the dialog itself. */
      const dialog = this.element?.querySelector("dialog");
      if (!dialog) return;

      // Update the login/profile trigger and the form or profile shown inside the dialog.
      this.ui.render(this.views.trigger(this), this.element.querySelector("[data-user-trigger]"), this);
      this.ui.render(this.views.dialog(this), dialog, this);

      // Match the native dialog's visibility to the GUI state without reopening an already open dialog.
      if (this.gui.dialog) {
        if (!dialog.open) dialog.showModal();
        // Avoid moving focus while an authentication or account deletion request is in progress.
        if (!this.gui.busy) {
          // Focus the field or action marked as the starting point in the current view.
          dialog.querySelector("[autofocus]")?.focus();
        }
      } else if (dialog.open) {
        // Return keyboard focus to the trigger when the dialog closes.
        dialog.close();
        this.element.querySelector("[data-user-trigger] button")?.focus();
      }

      // Mount independent provider components in the login view, preserving their instances.
      const slot = dialog.querySelector("[data-auth-providers]");
      const rendered = [];
      for (const provider of this.providers) {
        provider.setDisabled(this.gui.busy || !this.gui.dialog || this.isLoggedIn() || this.gui.mode !== "login");
        if (slot && this.gui.dialog && !this.isLoggedIn()) {
          slot.append(provider.host);
          rendered.push(provider.start());
        }
      }
      if (!rendered.length) return this.emit("render").catch(console.error);
      return Promise.all(rendered).then(() => this.emit("render")).catch(console.error);
    };

    /** Uses provider-owned sessions without copying their tokens or issuing another login request. */
    const handleProviderEvent = async ({ app: provider, type }) => {
      if (type === "ready" && !token && !selectedProvider && provider.isLoggedIn()) {
        selectedProvider = provider;
        render();
      } else if (type === "before-login") {
        if (this.gui.busy || !this.gui.dialog || this.isLoggedIn() || this.gui.mode !== "login")
          throw new Error(this.labels.authenticationBusy);
        activeProvider = provider;
        this.gui.busy = true;
        this.gui.message = "";
        render();
      } else if (activeProvider === provider && type === "login") {
        if (!provider.isLoggedIn()) throw new Error(this.labels.invalidAuthenticationResponse);
        selectedProvider = provider;
        token = null;
        state = null;
        sessionStorageAccess("removeItem");
        this.gui.busy = false;
        this.gui.dialog = false;
        const waiting = pendingLogin;
        pendingLogin = null;
        waiting?.resolve(this.getState());
        render();
        await this.emit("login");
      } else if (selectedProvider === provider && type === "logout") {
        requestVersion++;
        this.gui.busy = false;
        this.gui.dialog = false;
        this.gui.mode = "login";
        render();
        await this.emit("logout");
      } else if (activeProvider === provider && ["cancel", "error", "finish"].includes(type)) {
        activeProvider = null;
        this.gui.busy = false;
        if (type === "error" && !this.isLoggedIn()) this.gui.message = this.labels.failed;
        render();
      }
    };

    /**
     * Authenticates supplied credentials and completes any waiting interactive login.
     * @param {"login"|"register"} operation - Server operation to perform
     * @param {{user: string, password: string}|Object} credentials - Local credentials or an external provider's proof of authentication
     * @param {string} [provider="ccm"] - Authentication provider; registration uses ccm
     * @returns {Promise<UserIdentity>} Copy of the authenticated user metadata
     */
    const authenticate = async (operation, credentials, provider = "ccm") => {
      // Reject another authentication attempt while authentication is already in progress.
      if (this.gui.busy) throw new Error(this.labels.authenticationBusy);

      // Local authentication requires a username and password; external credentials are verified by the server.
      if (
        provider === "ccm" &&
        (!credentials || typeof credentials.user !== "string" || typeof credentials.password !== "string")
      )
        throw new TypeError(this.labels.invalidCredentials);
      if (provider !== "ccm" && (!credentials || typeof credentials !== "object" || Array.isArray(credentials)))
        throw new TypeError(this.labels.invalidProviderCredentials);

      /** Request counter value used to detect whether this login attempt was canceled or superseded. */
      const version = ++requestVersion;

      // Disable form actions, keep the entered username and clear the previous error.
      this.gui.busy = true;
      if (provider === "ccm") this.gui.username = credentials.user;
      this.gui.message = "";
      render();

      try {
        // Send registration data or provider credentials to the server for the configured realm.
        const params = operation === "register" ? { register: credentials } : { login: provider, credentials };
        params.realm = this.realm;
        const result = await this.ccm.load({
          url: this.url,
          method: "POST",
          params,
        });

        // A late response must not restore a session after logout or cancellation.
        if (version !== requestVersion) throw new DOMException(this.labels.loginCancelled, "AbortError");

        /**
         * User metadata assembled from the authentication result.
         * Local registration/login returns { key, token }; the other fields are already known.
         * External login also returns { user, realm, provider } and optionally a profile picture URL.
         */
        const identity = {
          key: result?.key,
          user: provider === "ccm" ? credentials.user : result?.user,
          realm: provider === "ccm" ? this.realm : result?.realm,
          provider: provider === "ccm" ? provider : result?.provider,
        };
        if (provider !== "ccm" && typeof result?.picture === "string" && result.picture.startsWith("https://"))
          identity.picture = result.picture;

        // Accept the session only when its metadata, provider and token format are valid.
        if (
          !isValidIdentity(identity) ||
          identity.provider !== provider ||
          typeof result?.token !== "string" ||
          !result.token
        )
          throw new Error(this.labels.invalidAuthenticationResponse);

        // Keep the session in memory and save it for page reloads if persistence is enabled.
        selectedProvider = null;
        token = result.token;
        state = identity;
        sessionStorageAccess("setItem", JSON.stringify({ token, ...state }));
      } catch (error) {
        // Show a configured error message only if this attempt still controls the form.
        if (version === requestVersion) {
          if (provider !== "ccm") this.gui.message = this.labels.failed;
          else if (error.status === 401) this.gui.message = this.labels.invalid;
          else if (error.status === 409) this.gui.message = this.labels.duplicate;
          else if (operation === "register") this.gui.message = this.labels.registrationFailed;
          else this.gui.message = this.labels.failed;
        }
        throw error;
      } finally {
        // Release the form without interfering with a newer authentication attempt.
        if (version === requestVersion) {
          this.gui.busy = false;
          render();
        }
      }

      /** Copy returned to callers so they cannot modify the private user metadata. */
      const value = this.getState();

      /** Callers waiting for the shared login dialog to complete. */
      const waiting = pendingLogin;

      // Clear the pending login and close the dialog now that authentication has succeeded.
      pendingLogin = null;
      this.gui.dialog = false;
      render();

      // Interactive callers receive the session before extensions run.
      waiting?.resolve(value);

      // Notify this instance's extensions and subscribed user instances of the completed action.
      await this.emit(operation);

      return value;
    };

    /**
     * Opens one shared login flow; failed submissions leave its promise pending.
     * @param {"login"|"register"} mode - Whether to open the login or registration form
     */
    const promptLogin = (mode) => {
      if (pendingLogin) return pendingLogin.promise;
      this.gui.mode = mode;
      this.gui.dialog = true;
      this.gui.message = "";
      const promise = new Promise((resolve, reject) => {
        pendingLogin = { resolve, reject };
      });
      pendingLogin.promise = promise;
      render();
      return promise;
    };

    /**
     * Rejects waiting login callers and asks extensions to cancel their pending work.
     * @returns {Promise<void>} Completes after cancel event handling; extension errors are logged
     */
    const cancelPendingLogin = () => {
      if (pendingLogin) {
        const { reject } = pendingLogin;
        pendingLogin = null;
        reject(new DOMException(this.labels.loginCancelled, "AbortError"));
      }
      // Provider work may exist even when no caller is waiting for the login dialog.
      activeProvider = null;
      const cancelled = this.providers.map(provider => provider.cancel());
      if (!cancelled.length) return this.emit("cancel").catch(console.error);
      return Promise.all(cancelled).then(() => this.emit("cancel")).catch(console.error);
    };
  },
};

/**
 * Authenticated user metadata (cached metadata is provisional until a server request).
 *
 * @typedef {Object} UserIdentity
 * @property {string} key - Unique account key within the realm
 * @property {string} user - Display name or local username
 * @property {string} realm - Independent user area
 * @property {string} provider - Authentication provider, e.g. "ccm" or an external provider identifier
 * @property {string} [picture] - Optional HTTPS profile picture URL from the authentication provider
 */
