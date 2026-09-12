/**
 * Authentication with ccm-server: configuration, instance state, API and UI events.
 * Markup lives in resources/views.mjs; presentation lives in resources/styles.css.
 * The token is private; state contains metadata and gui contains transient UI state.
 */
export const component = {
  name: "user",
  ccm: "https://ccmjs.github.io/framework/ccm.js",
  config: {
    // Server providing the registration, login and account deletion JSON API
    url: "http://localhost:8080",

    // UI utilities (templating and declarative event binding)
    ui: ["ccm.load", "././libs/ccm-ui/ccm-ui.mjs"],

    // Views and styles are resolved relative to this component
    views: ["ccm.load", "././resources/views.mjs"],
    css: ["ccm.load", "././resources/styles.css"],

    // Whether the registration form is available
    registration: true,

    // Extensions: async ({ app, type }) => {}, executed sequentially
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
      invalidDeletionResponse: "Invalid account deletion response.",
    },
  },
  Instance: function () {
    // Public domain data; credentials remain private
    this.state = {
      key: null,
      user: null,
      realm: null,
    };

    // Transient GUI state, separate from the domain data
    this.gui = {
      mode: "login", // login, register, profile or delete
      busy: false,
      message: "",
      username: "", // Form draft; state.user is the authenticated username
      cancellable: false,
      dialog: false,
    };

    let token = null;
    let pendingLogin; // Shared promise for callers waiting on the login form
    // Incrementing invalidates older responses; it does not abort the HTTP request.
    let requestVersion = 0;

    /** Renders the current authentication state without resetting the session. */
    this.start = async () => render();

    /** Returns whether this instance holds a server-issued token. */
    this.isLoggedIn = () => token !== null;

    /** Returns the JWT, or null when logged out. */
    this.getToken = () => token;

    /**
     * Logs in with credentials, or waits for an interactive login.
     *
     * @param {{user: string, password: string}} [credentials]
     * @returns {Promise<{key: string, user: string, realm: string}>} User metadata
     */
    this.login = (credentials) => {
      if (token)
        return Promise.resolve({
          key: this.state.key,
          user: this.state.user,
          realm: this.state.realm,
        });
      return credentials ? authenticate("login", credentials) : promptLogin("login");
    };

    /**
     * Registers and logs in a local user, or opens the registration form.
     *
     * @param {{user: string, password: string}} [credentials]
     * @returns {Promise<{key: string, user: string, realm: string}>} User metadata
     */
    this.register = (credentials) => {
      if (!this.registration)
        return Promise.reject(new Error(this.labels.registrationDisabled));
      if (token)
        return Promise.resolve({
          key: this.state.key,
          user: this.state.user,
          realm: this.state.realm,
        });
      return credentials
        ? authenticate("register", credentials)
        : promptLogin("register");
    };

    /** Discards the session and cancels a pending interactive login. */
    this.logout = async () => {
      requestVersion++;
      this.gui.busy = false;
      const changed = token !== null;
      token = null;
      this.state.key = null;
      this.state.user = null;
      this.state.realm = null;
      this.gui.username = "";
      this.gui.message = "";
      this.gui.mode = "login";
      this.gui.dialog = false;
      cancelPendingLogin();
      render();
      if (changed) await this.emit("logout");
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

    /** Rejects waiting callers without changing an existing authenticated session. */
    const cancelPendingLogin = () => {
      if (!pendingLogin) return;
      const { reject } = pendingLogin;
      pendingLogin = null;
      this.gui.cancellable = false;
      reject(new DOMException(this.labels.loginCancelled, "AbortError"));
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

    /** Shared request flow for credential-based calls and form submissions. */
    const authenticate = async (operation, credentials) => {
      if (this.gui.busy)
        throw new Error(this.labels.authenticationBusy);
      if (
        !credentials ||
        typeof credentials.user !== "string" ||
        typeof credentials.password !== "string"
      )
        throw new TypeError(this.labels.invalidCredentials);
      const version = ++requestVersion;
      this.gui.busy = true;
      this.gui.username = credentials.user;
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
                login: "ccm",
                credentials: {
                  user: credentials.user,
                  password: credentials.password,
                },
              };
        const result = await this.ccm.load({
          url: this.url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          params,
        });
        if (version !== requestVersion)
          throw new DOMException(this.labels.loginCancelled, "AbortError");
        if (
          !result ||
          typeof result.key !== "string" ||
          !result.key ||
          typeof result.token !== "string" ||
          !result.token
        )
          throw new Error(this.labels.invalidAuthenticationResponse);
        token = result.token;
        this.state.key = result.key;
        this.state.user = credentials.user;
        this.state.realm = "ccm";
      } catch (error) {
        if (version === requestVersion) {
          if (error.status === 401) this.gui.message = this.labels.invalid;
          else if (error.status === 409) this.gui.message = this.labels.duplicate;
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
          headers: { "Content-Type": "application/json" },
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
        this.gui.dialog = false;
        requestVersion++;
        this.gui.busy = false;
        this.gui.message = "";
        cancelPendingLogin();
        render();
      },
    };

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
  },
};
