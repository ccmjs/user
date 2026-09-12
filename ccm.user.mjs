export const component = {
  name: "user",
  ccm: "https://ccmjs.github.io/framework/ccm.js",
  config: {
    // Server providing the register and login JSON API
    url: "http://localhost:8080",

    // UI utilities (templating and declarative event binding)
    ui: ["ccm.load", "././libs/ccm-ui/ccm-ui.mjs"],

    // Views and styles are resolved relative to this component
    views: ["ccm.load", "././resources/views.mjs"],
    css: ["ccm.load", "././resources/styles.css"],

    // Whether the registration form is available
    registration: true,

    // Optional callback: async ({ app, type, user }) => {}
    onchange: null,

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
    },
  },
  Instance: function () {
    // Public state used by the views; credentials remain private
    this.state = {
      key: null,
      user: null,
      realm: null,
      mode: "login",
      busy: false,
      message: "",
      username: "",
      cancellable: false,
      dialog: false,
    };

    let token = null;
    let pending;
    let generation = 0;

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
     * @returns {Promise<object>} User metadata
     */
    this.login = (credentials) => {
      if (token)
        return Promise.resolve({
          key: this.state.key,
          user: this.state.user,
          realm: this.state.realm,
        });
      return credentials ? authenticate("login", credentials) : prompt("login");
    };

    /**
     * Registers and logs in a local user, or opens the registration form.
     *
     * @param {{user: string, password: string}} [credentials]
     * @returns {Promise<object>} User metadata
     */
    this.register = (credentials) => {
      if (!this.registration)
        return Promise.reject(new Error("Registration is disabled."));
      if (token)
        return Promise.resolve({
          key: this.state.key,
          user: this.state.user,
          realm: this.state.realm,
        });
      return credentials
        ? authenticate("register", credentials)
        : prompt("register");
    };

    /** Discards the session and cancels a pending interactive login. */
    this.logout = async () => {
      generation++;
      this.state.busy = false;
      const changed = token !== null;
      token = null;
      this.state.key = null;
      this.state.user = null;
      this.state.realm = null;
      this.state.username = "";
      this.state.message = "";
      this.state.mode = "login";
      this.state.dialog = false;
      cancel();
      render();
      if (changed) await notify("logout");
    };

    const prompt = (nextMode) => {
      if (pending) return pending.promise;
      this.state.mode = nextMode;
      this.state.dialog = true;
      this.state.message = "";
      const promise = new Promise((resolve, reject) => {
        pending = { resolve, reject };
      });
      pending.promise = promise;
      this.state.cancellable = true;
      render();
      return promise;
    };

    const cancel = () => {
      if (!pending) return;
      const { reject } = pending;
      pending = null;
      this.state.cancellable = false;
      reject(new DOMException("Login cancelled.", "AbortError"));
    };

    const notify = async (type) => {
      await this.onchange?.({
        app: this,
        type,
        user: token
          ? {
              key: this.state.key,
              user: this.state.user,
              realm: this.state.realm,
            }
          : null,
      });
    };

    const authenticate = async (operation, credentials) => {
      if (this.state.busy)
        throw new Error("Authentication is already in progress.");
      if (
        !credentials ||
        typeof credentials.user !== "string" ||
        typeof credentials.password !== "string"
      )
        throw new TypeError("Username and password must be strings.");
      const current = ++generation;
      this.state.busy = true;
      this.state.username = credentials.user;
      this.state.message = "";
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
        if (current !== generation)
          throw new DOMException("Login cancelled.", "AbortError");
        if (
          !result ||
          typeof result.key !== "string" ||
          !result.key ||
          typeof result.token !== "string" ||
          !result.token
        )
          throw new Error("Invalid authentication response.");
        token = result.token;
        this.state.key = result.key;
        this.state.user = credentials.user;
        this.state.realm = "ccm";
      } catch (error) {
        if (current === generation) {
          this.state.message =
            error.status === 401
              ? this.labels.invalid
              : error.status === 409
                ? this.labels.duplicate
                : operation === "register"
                  ? this.labels.registrationFailed
                  : this.labels.failed;
        }
        throw error;
      } finally {
        if (current === generation) {
          this.state.busy = false;
          render();
        }
      }
      const value = {
        key: this.state.key,
        user: this.state.user,
        realm: this.state.realm,
      };
      const waiting = pending;
      pending = null;
      this.state.cancellable = false;
      this.state.dialog = false;
      waiting?.resolve(value);
      render();
      await notify(operation);
      return value;
    };

    /** Marks the current account as deleted and discards its local session. */
    this.deleteAccount = async () => {
      if (!token) throw new Error("Sign in before deleting your account.");
      if (this.state.busy) throw new Error("A request is already in progress.");
      const current = ++generation;
      this.state.busy = true;
      this.state.message = "";
      render();
      try {
        const result = await this.ccm.load({
          url: this.url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          params: { deleteAccount: true, token },
        });
        if (result !== true)
          throw new Error("Invalid account deletion response.");
        if (current !== generation) return;
      } catch (error) {
        if (current === generation)
          this.state.message =
            error.status === 401
              ? this.labels.sessionExpired
              : this.labels.deletionFailed;
        throw error;
      } finally {
        if (current === generation) {
          this.state.busy = false;
          render();
        }
      }
      await this.logout();
      await notify("deleteAccount");
    };

    /** DOM handlers bound by ccm-ui through data-on-* attributes. */
    this.events = {
      open: () => {
        if (token) {
          this.state.mode = "profile";
          this.state.dialog = true;
          this.state.message = "";
          render();
        } else {
          this.login().catch((error) => {
            if (error.name !== "AbortError") console.error(error);
          });
        }
      },
      requestDelete: () => {
        if (!token || this.state.busy) return;
        this.state.mode = "delete";
        this.state.message = "";
        render();
      },
      keepAccount: () => {
        if (this.state.busy) return;
        this.state.mode = "profile";
        this.state.message = "";
        render();
      },
      deleteAccount: () =>
        this.deleteAccount().catch(() => {
          // The failure is displayed in the dialog
        }),
      submit: async (event) => {
        event.preventDefault();
        if (this.state.busy) return;
        const fields = event.currentTarget.elements;
        const credentials = {
          user: fields.namedItem("user").value,
          password: fields.namedItem("password").value,
        };
        if (
          this.state.mode === "register" &&
          credentials.password !== fields.namedItem("confirmation").value
        ) {
          this.state.username = credentials.user;
          this.state.message = this.labels.mismatch;
          render();
          return;
        }
        try {
          await authenticate(this.state.mode, credentials);
        } catch (error) {
          // Authentication failures are displayed in the form
          if (token) console.error(error);
        }
      },
      switchMode: () => {
        if (this.state.busy || !this.registration) return;
        this.state.mode = this.state.mode === "login" ? "register" : "login";
        this.state.message = "";
        render();
      },
      logout: () => this.logout().catch(console.error),
      cancel: (event) => {
        event?.preventDefault();
        if (this.state.busy && this.state.mode === "delete") return;
        this.state.dialog = false;
        generation++;
        this.state.busy = false;
        this.state.message = "";
        cancel();
        render();
      },
    };

    const render = () => {
      // Keep the native dialog mounted while replacing its content
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
      if (this.state.dialog) {
        if (!dialog.open) dialog.showModal();
        if (!this.state.busy)
          dialog
            .querySelector(
              this.state.message
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
