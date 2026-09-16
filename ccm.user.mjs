export const component = {
  name: "user",
  ccm: "././libs/ccmjs/ccm.js",
  config: {
    // TODO: lang

    // Absolute server API URL for registration, login, account deletion
    url: "http://localhost:8080",

    // Independent user area on the server; also separates saved sessions
    realm: "ccm",

    // Keep the CCM token and user metadata across reloads in this tab; logout remains local
    session: true,

    // UI utilities (templating + event binding)
    ui: ["ccm.load", "././libs/ccm-ui/ccm-ui.mjs"],

    // Component views (HTML templates)
    views: ["ccm.load", "././resources/views.mjs"],

    // Component styles (CSS)
    css: ["ccm.load", "././resources/styles.css"],

    // Google authentication
    // google: {
    //   url: "https://ccmjs.github.io/user/auth/google/google.html",
    //   popup: ["ccm.load", "././auth/google/google.mjs"],
    // },

    // Whether the registration form is available
    // registration: true,

    // Extension points
    extensions: [],

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
      cancel: "Cancel",
      signedIn: "Signed in as",
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
      googleFailed: "Google sign-in failed. Please try again.",
      googleUnavailable: "Google sign-in could not be loaded. Please reopen this dialog to retry.",
      googleLogin: "Sign in with Google",
      or: "or",
      googlePopupBlocked: "Please allow the login popup and try again.",
      googleTimeout: "Google sign-in timed out. Please try again.",
      invalidProviderCredentials: "An ID token is required for provider login.",
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

      /** Whether an authentication or account deletion request is in progress. */
      busy: false,

      /** Message displayed in the dialog; empty when there is no message. */
      message: "",

      /** Form draft; `state.user` is the authenticated username. */
      username: "",

      /** Whether callers are waiting for an interactive login that can be canceled. */
      cancellable: false,

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

    /** Cancels the current Google login popup, if any. */
    let cancelGoogleLogin;

    /** Shared promise and callbacks for callers waiting on the login form. */
    let pendingLogin;

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

      // If no parent user instance has the same server URL and realm, restore this instance's session from sessionStorage.
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
     * @param {{user: string, password: string}|{idToken: string}} [credentials]
     * @param {string} [provider="ccm"] - Authentication method for supplied credentials
     * @returns {Promise<UserIdentity>} User metadata
     */
    this.login = (credentials, provider = "ccm") => {
      if (token) return Promise.resolve({ ...state });
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
      if (token) return Promise.resolve({ ...state });
      return credentials ? authenticate("register", credentials) : promptLogin("register");
    };

    /** Discards the session and cancels a pending interactive login. */
    this.logout = async () => {
      cancelGoogleLogin?.();
      requestVersion++;
      this.gui.busy = false;
      const changed = token !== null;
      token = null;
      sessionStorageAccess("removeItem");
      state = null;
      this.gui.username = "";
      this.gui.message = "";
      this.gui.mode = "login";
      this.gui.dialog = false;
      cancelPendingLogin();
      render();
      if (changed) await this.emit("logout");
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
    this.isLoggedIn = () => token !== null;

    /**
     * Returns a copy of the shared user metadata, or `null` when logged out.
     * @returns {UserIdentity|null}
     */
    this.getState = () => state && { ...state };

    /** Returns the JWT, or null when logged out. */
    this.getToken = () => token;

    /** Returns the shared authentication instance for coordinating concurrent re-login attempts. */
    this.getSessionOwner = () => sessionOwner ?? this;

    /** DOM handlers bound by ccm-ui through data-on-* attributes. */
    this.events = {
      google: async () => {
        if (!this.google || this.gui.busy) return;
        const version = requestVersion;
        // Open directly from the click so browsers allow the popup.
        const popup = this.google.popup.login(this);
        cancelGoogleLogin = popup.cancel;
        this.gui.busy = true;
        this.gui.message = "";
        render();
        try {
          const credentials = await popup.promise;
          if (version !== requestVersion) return;
          this.gui.busy = false;
          await this.login(credentials, "google");
        } catch (error) {
          if (version !== requestVersion) return;
          this.gui.message = error.name === "AbortError" ? "" : this.labels.googleFailed;
        } finally {
          if (cancelGoogleLogin === popup.cancel) cancelGoogleLogin = null;
          if (version === requestVersion) {
            this.gui.busy = false;
            render();
          }
        }
      },
      open: () => {
        if (token) {
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
      requestDelete: () => {
        if (!token || this.gui.busy) return;
        this.gui.mode = "delete";
        this.gui.message = "";
        render();
      },
      keepAccount: () => {
        if (this.gui.busy) return;
        this.gui.mode = "profile";
        this.gui.message = "";
        render();
      },
      deleteAccount: () =>
        this.deleteAccount().catch(() => {
          // The failure is displayed in the dialog
        }),
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
      logout: () => this.logout().catch(console.error),
      cancel: (event) => {
        event?.preventDefault();
        if (this.gui.busy && this.gui.mode === "delete") return;
        cancelGoogleLogin?.();
        this.gui.dialog = false;
        requestVersion++;
        this.gui.busy = false;
        this.gui.message = "";
        cancelPendingLogin();
        render();
      },
    };

    /**
     * Runs extensions sequentially with { app, type } after successful actions.
     * Events: login, register, logout, deleteAccount (after logout).
     * Errors stop dispatch and propagate; completed state changes remain applied.
     */
    this.emit = async (type) => {
      const extensions = [].concat(this.extensions || []);
      for (const extension of extensions) if (extension) await extension({ app: this, type });
      for (const listener of listeners) await listener(type);
    };

    /**
     * Subscribes to this instance's events without depending on its module version.
     * @param {function(string): (void|Promise<void>)} listener - Receives the event type
     * @returns {function(): boolean} Removes the listener
     */
    this.subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    /**
     * Finds the highest compatible ancestor user instance with the same server and realm.
     * @returns {object|null} Matching user instance, or null if this instance owns the session
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
     * @returns {string|null} Serialized session for getItem, otherwise null; also null
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
      if (sessionOwner) {
        this.element?.replaceChildren();
        return;
      }
      // Replacing an open dialog would lose its native modal state and focus handling.
      if (!this.element?.querySelector("[data-user-shell]")) this.ui.render(this.views.main(this), this.element, this);
      const dialog = this.element?.querySelector("dialog");
      if (!dialog) return;
      this.ui.render(this.views.trigger(this), this.element.querySelector("[data-user-trigger]"), this);
      this.ui.render(this.views.dialog(this), dialog, this);
      if (this.gui.dialog) {
        if (!dialog.open) dialog.showModal();
        if (!this.gui.busy) {
          // Focus the initial field or action; after a failed login, focus the password field.
          const focusTarget =
            (this.gui.message && dialog.querySelector('[name="password"]')) || dialog.querySelector("[autofocus]");
          focusTarget?.focus();
        }
      } else if (dialog.open) {
        dialog.close();
        this.element.querySelector("[data-user-trigger] button")?.focus();
      }
    };

    /**
     * Authenticates supplied credentials and completes any waiting interactive login.
     * @param {"login"|"register"} operation - Server operation to perform
     * @param {{user: string, password: string}|{idToken: string}} credentials - Local credentials or provider ID token
     * @param {string} [provider="ccm"] - Authentication provider; registration uses ccm
     * @returns {Promise<UserIdentity>} Copy of the authenticated user metadata
     */
    const authenticate = async (operation, credentials, provider = "ccm") => {
      // Reject another authentication attempt while a request or Google popup is active.
      if (this.gui.busy) throw new Error(this.labels.authenticationBusy);

      // Local authentication requires a username and password; other providers require an ID token.
      if (
        provider === "ccm" &&
        (!credentials || typeof credentials.user !== "string" || typeof credentials.password !== "string")
      )
        throw new TypeError(this.labels.invalidCredentials);
      if (provider !== "ccm" && (!credentials || typeof credentials.idToken !== "string" || !credentials.idToken))
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
         * Google login also returns { user, realm, provider }, which we take from the server.
         */
        const identity = {
          key: result?.key,
          user: provider === "ccm" ? credentials.user : result?.user,
          realm: provider === "ccm" ? this.realm : result?.realm,
          provider: provider === "ccm" ? provider : result?.provider,
        };

        // Accept the session only when its metadata, provider and token format are valid.
        if (
          !isValidIdentity(identity) ||
          identity.provider !== provider ||
          typeof result?.token !== "string" ||
          !result.token
        )
          throw new Error(this.labels.invalidAuthenticationResponse);

        // Keep the session in memory and save it for page reloads if persistence is enabled.
        token = result.token;
        state = identity;
        sessionStorageAccess("setItem", JSON.stringify({ token, ...state }));
      } catch (error) {
        // Show a configured error message only if this attempt still controls the form.
        if (version === requestVersion) {
          if (provider !== "ccm") this.gui.message = this.labels.googleFailed;
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
      this.gui.cancellable = false;
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
      this.gui.cancellable = true;
      render();
      return promise;
    };

    /** Rejects waiting callers without changing an existing authenticated session. */
    const cancelPendingLogin = () => {
      if (!pendingLogin) return;
      const { reject } = pendingLogin;
      pendingLogin = null;
      this.gui.cancellable = false;
      reject(new DOMException(this.labels.loginCancelled, "AbortError"));
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
 * @property {string} provider - Authentication provider, e.g. "ccm" or "google"
 */
