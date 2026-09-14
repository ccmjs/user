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
      googleUnavailable:
        "Google sign-in could not be loaded. Please reopen this dialog to retry.",
      googleLogin: "Sign in with Google",
      googlePopupBlocked: "Please allow the login popup and try again.",
      googleTimeout: "Google sign-in timed out. Please try again.",
      invalidProviderCredentials: "An ID token is required for provider login.",
      invalidDeletionResponse: "Invalid account deletion response.",
    },
  },
  Instance: function () {
    /**
     * Public user metadata, or `null` when logged out. Credentials remain private.
     * @type {UserIdentity|null}
     */
    this.state = null;

    // Transient GUI state, separate from the domain data
    this.gui = {
      mode: "login", // login, register, profile or delete
      busy: false,
      message: "",
      username: "", // Form draft; state.user is the authenticated username
      cancellable: false,
      dialog: false,
    };

    let cancelGoogleLogin;
    let token = null;
    let pendingLogin; // Shared promise for callers waiting on the login form
    // Incrementing invalidates older responses; it does not abort the HTTP request.
    let requestVersion = 0;

    /** Restores cached metadata; the next authenticated request validates the session. */
    this.init = async () => {
      const saved = sessionStorageAccess("getItem");
      if (!saved) return;
      try {
        const session = JSON.parse(saved);
        if (
          !isValidIdentity(session) ||
          typeof session.token !== "string" ||
          !session.token
        )
          throw new Error(this.labels.invalidAuthenticationResponse);
        token = session.token;
        this.state = {
          key: session.key,
          user: session.user,
          realm: session.realm,
          provider: session.provider,
        };
      } catch {
        // Discard malformed entries, including the old token-only storage format.
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
      if (token) return Promise.resolve({ ...this.state });
      return credentials
        ? authenticate("login", credentials, provider)
        : promptLogin("login");
    };

    /**
     * Registers and logs in a local user, or opens the registration form.
     *
     * @param {{user: string, password: string}} [credentials]
     * @returns {Promise<UserIdentity>} User metadata
     */
    this.register = (credentials) => {
      if (!this.registration)
        return Promise.reject(new Error(this.labels.registrationDisabled));
      if (token) return Promise.resolve({ ...this.state });
      return credentials
        ? authenticate("register", credentials)
        : promptLogin("register");
    };

    /** Discards the session and cancels a pending interactive login. */
    this.logout = async () => {
      cancelGoogleLogin?.();
      requestVersion++;
      this.gui.busy = false;
      const changed = token !== null;
      token = null;
      sessionStorageAccess("removeItem");
      this.state = null;
      this.gui.username = "";
      this.gui.message = "";
      this.gui.mode = "login";
      this.gui.dialog = false;
      cancelPendingLogin();
      render();
      if (changed) await this.emit("logout");
    };

    /** Returns whether this instance holds a server-issued token. */
    this.isLoggedIn = () => token !== null;

    /** Returns the JWT, or null when logged out. */
    this.getToken = () => token;

    /** Marks the current account as deleted and discards its local session. */
    this.deleteAccount = async () => {
      if (!token) throw new Error(this.labels.deletionRequiresLogin);
      if (this.gui.busy) throw new Error(this.labels.requestBusy);
      const version = ++requestVersion;
      this.gui.busy = true;
      this.gui.message = "";
      render();
      try {
        const result = await this.ccm.load({
          url: this.url,
          method: "POST",
          params: { deleteAccount: true, token },
        });
        if (result !== true)
          throw new Error(this.labels.invalidDeletionResponse);
        if (version !== requestVersion) return;
      } catch (error) {
        if (version === requestVersion)
          this.gui.message =
            error.status === 401
              ? this.labels.sessionExpired
              : this.labels.deletionFailed;
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
          this.gui.message =
            error.name === "AbortError" ? "" : this.labels.googleFailed;
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
        if (
          this.gui.mode === "register" &&
          credentials.password !== fields.namedItem("confirmation").value
        ) {
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
      switchMode: () => {
        if (this.gui.busy || !this.registration) return;
        this.gui.mode = this.gui.mode === "login" ? "register" : "login";
        this.gui.message = "";
        render();
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
      for (const extension of extensions)
        if (extension) await extension({ app: this, type });
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
        const server = new URL(this.url).href;
        const key = `ccm-user-session:${JSON.stringify([server, this.realm])}`;
        return sessionStorage[method](key, value) ?? null;
      } catch {
        return null;
      }
    };

    /** Updates the views while preserving the existing dialog element. */
    const render = () => {
      // Replacing an open dialog would lose its native modal state and focus handling.
      if (!this.element?.querySelector("[data-user-shell]"))
        this.ui.render(this.views.main(this), this.element, this);
      const dialog = this.element?.querySelector("dialog");
      if (!dialog) return;
      this.ui.render(
        this.views.trigger(this),
        this.element.querySelector("[data-user-trigger]"),
        this,
      );
      this.ui.render(this.views.dialog(this), dialog, this);
      if (this.gui.dialog) {
        if (!dialog.open) dialog.showModal();
        if (!this.gui.busy)
          dialog
            .querySelector(
              this.gui.message
                ? '[name="password"], [autofocus]'
                : "[autofocus]",
            )
            ?.focus();
      } else if (dialog.open) {
        dialog.close();
        this.element.querySelector("[data-user-trigger] button")?.focus();
      }
    };

    /** Shared request flow for credential-based calls and form submissions. */
    const authenticate = async (operation, credentials, provider = "ccm") => {
      if (this.gui.busy) throw new Error(this.labels.authenticationBusy);
      if (
        provider === "ccm" &&
        (!credentials ||
          typeof credentials.user !== "string" ||
          typeof credentials.password !== "string")
      )
        throw new TypeError(this.labels.invalidCredentials);
      if (
        provider !== "ccm" &&
        (!credentials ||
          typeof credentials.idToken !== "string" ||
          !credentials.idToken)
      )
        throw new TypeError(this.labels.invalidProviderCredentials);
      const version = ++requestVersion;
      this.gui.busy = true;
      if (provider === "ccm") this.gui.username = credentials.user;
      this.gui.message = "";
      render();
      try {
        const params =
          operation === "register"
            ? {
                register: {
                  user: credentials.user,
                  password: credentials.password,
                },
              }
            : {
                login: provider,
                credentials,
              };
        params.realm = this.realm;
        const result = await this.ccm.load({
          url: this.url,
          method: "POST",
          params,
        });
        if (version !== requestVersion)
          throw new DOMException(this.labels.loginCancelled, "AbortError");
        const identity = {
          key: result?.key,
          user: provider === "ccm" ? credentials.user : result?.user,
          realm: provider === "ccm" ? this.realm : result?.realm,
          provider: provider === "ccm" ? provider : result?.provider,
        };
        if (
          !isValidIdentity(identity) ||
          identity.provider !== provider ||
          typeof result?.token !== "string" ||
          !result.token
        )
          throw new Error(this.labels.invalidAuthenticationResponse);
        token = result.token;
        this.state = identity;
        sessionStorageAccess(
          "setItem",
          JSON.stringify({
            token,
            key: this.state.key,
            user: this.state.user,
            realm: this.state.realm,
            provider: this.state.provider,
          }),
        );
      } catch (error) {
        if (version === requestVersion) {
          if (provider !== "ccm") this.gui.message = this.labels.googleFailed;
          else if (error.status === 401) this.gui.message = this.labels.invalid;
          else if (error.status === 409)
            this.gui.message = this.labels.duplicate;
          else if (operation === "register")
            this.gui.message = this.labels.registrationFailed;
          else this.gui.message = this.labels.failed;
        }
        throw error;
      } finally {
        if (version === requestVersion) {
          this.gui.busy = false;
          render();
        }
      }
      const value = {
        key: this.state.key,
        user: this.state.user,
        realm: this.state.realm,
        provider: this.state.provider,
      };
      const waiting = pendingLogin;
      pendingLogin = null;
      this.gui.cancellable = false;
      this.gui.dialog = false;
      // Interactive callers receive the session before extensions run.
      waiting?.resolve(value);
      render();
      await this.emit(operation);
      return value;
    };

    /** Opens one shared login flow; failed submissions leave its promise pending. */
    const promptLogin = (nextMode) => {
      if (pendingLogin) return pendingLogin.promise;
      this.gui.mode = nextMode;
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

    /**
     * Checks the shape of user metadata and its realm, not the token's validity.
     *
     * @param {unknown} value - User metadata, e.g. this.state or a saved session
     * @returns {boolean} Whether all required identity fields are valid
     */
    const isValidIdentity = (value) =>
      this.ccm.helper.isDataset(value) &&
      typeof value.key === "string" &&
      typeof value.user === "string" &&
      value.realm === this.realm &&
      typeof value.provider === "string" &&
      value.provider !== "";

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
