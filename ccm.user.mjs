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

    /** Allow private profile pictures for local CCM accounts using the server upload service. */
    profilePicture: true,

    /** Absolute server API URL for registration, login and account deletion. */
    url: "http://localhost:8080",

    /** User area on the server; each realm has its own saved login session. */
    realm: "ccm",

    /** Preserve the CCM token and user metadata across reloads in this tab; logout remains local. */
    session: true,

    /** UI utilities for HTML templates, rendering and DOM event binding. */
    ui: ["ccm.load", "././libs/ccm-ui/ccm-ui.mjs"],

    /** Templates for the account header and authentication dialog. */
    views: ["ccm.load", "././resources/views.mjs"],

    /** Styles for this component instance. */
    css: ["ccm.load", "././resources/styles.css"],

    /** Whether local account registration is available; disabled unless explicitly enabled. */
    // registration: true,

    /** Event handlers receiving { app, type }, awaited sequentially in configuration order. */
    extensions: [],

    /** Independent authentication components mounted in the login dialog. */
    providers: [],

    /** Configurable icons as inline SVG markup or image URLs (SVG, PNG, JPG). */
    icons: {
      /** Icon for the header and profile sign-out actions. */
      logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M9 4H4v16h5 M10 12h10 M16 8l4 4-4 4"/></svg>`,
      /** Icon of the signed-out account button. */
      login: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M14 4h6v16h-6 M3 12h12 M9 6l6 6-6 6"/></svg>`,
      /** Fallback avatar and replacement image when resetting a local profile picture. */
      user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"/></svg>`,
      /** Icon of the dialog close button. */
      close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M6 6l12 12 M6 18L18 6"/></svg>`,
    },

    /** Configurable interface text and error messages. */
    labels: {
      /** Label for choosing a private profile picture. */
      uploadPicture: "Change profile picture",
      /** Replaces the uploaded picture with the configured user icon. */
      removePicture: "Remove picture",
      /** Feedback while the profile image is being changed or removed. */
      savingPicture: "Saving profile picture…",
      /** Feedback while uploading and saving an image. */
      uploadingPicture: "Uploading profile picture…",
      /** Error for unsupported image formats. */
      invalidPicture: "Choose a PNG, JPEG, GIF, WebP or AVIF image.",
      /** Error when uploading or saving a profile picture fails. */
      pictureFailed: "The profile picture could not be saved.",
      /** Error when the server rejects the file size. */
      pictureTooLarge: "The selected image is too large.",
      /** Login dialog heading. */
      title: "Sign in",
      /** Profile dialog heading. */
      profile: "Your profile",
      /** Label for the CCM account key. */
      userId: "User ID",
      /** Label for the authentication provider. */
      provider: "Sign-in provider",
      /** Accessible name of the dialog close button. */
      close: "Close dialog",
      /** Action opening the account deletion confirmation. */
      deleteAccount: "Delete account",
      /** Account deletion dialog heading. */
      deleteTitle: "Delete your account?",
      /** Explanation of the effects of account deletion. */
      deleteDescription:
        "Your account will be marked as deleted. You will be signed out and can no longer sign in. Your account data is retained.",
      /** Action confirming account deletion. */
      confirmDelete: "Delete my account",
      /** Action returning to the profile without deleting the account. */
      keepAccount: "Keep my account",
      /** Error when account deletion fails. */
      deletionFailed: "Account deletion failed. Please try again.",
      /** Message when the server rejects the current session. */
      sessionExpired: "Your session is no longer valid. Please sign in again.",
      /** Registration dialog heading. */
      registerTitle: "Create an account",
      /** Username field and profile label. */
      user: "Username",
      /** Password field label. */
      password: "Password",
      /** Password confirmation field label. */
      confirmation: "Confirm password",
      /** Login action and signed-out header text. */
      login: "Sign in",
      /** Registration submit action. */
      register: "Register",
      /** Action switching from login to registration. */
      showRegister: "No account yet? Register",
      /** Action switching from registration to login. */
      showLogin: "Already have an account? Sign in",
      /** Sign-out action and accessible name of the header icon button. */
      logout: "Sign out",
      /** Status while an operation is in progress. */
      pending: "Please wait …",
      /** Error when the registration passwords differ. */
      mismatch: "The passwords do not match.",
      /** Error when local credentials are rejected. */
      invalid: "The username or password is incorrect.",
      /** Error when the requested username is already registered. */
      duplicate: "This username is already taken.",
      /** Fallback message when login fails. */
      failed: "Sign-in failed. Please try again.",
      /** Fallback message when registration fails. */
      registrationFailed: "Registration failed. Please try again.",
      /** Error when registration is requested but disabled. */
      registrationDisabled: "Registration is disabled.",
      /** Message of the AbortError returned when login is cancelled. */
      loginCancelled: "Login cancelled.",
      /** Error for a concurrent authentication request. */
      authenticationBusy: "Authentication is already in progress.",
      /** Error for incorrectly typed local credentials. */
      invalidCredentials: "Username and password must be strings.",
      /** Error for invalid server identity or token data. */
      invalidAuthenticationResponse: "Invalid authentication response.",
      /** Error when deleting an account without a local session. */
      deletionRequiresLogin: "Sign in before deleting your account.",
      /** Error when another operation prevents account deletion. */
      requestBusy: "A request is already in progress.",
      /** Divider text between external providers and the local login form. */
      or: "or",
      /** Error when external credentials are not an object. */
      invalidProviderCredentials: "Provider credentials must be an object.",
      /** Error when the server does not confirm account deletion. */
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

      /** Browser-local URL for the private uploaded avatar; never persisted as session data. */
      picture: "",

      /** Whether this account has an uploaded profile picture available for removal. */
      hasPicture: false,

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

    /** Session for which a profile image has already been requested. */
    let pictureSession = null;

    /** Invalidates old downloads when an upload, logout or another session supersedes them. */
    let pictureVersion = 0;

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
      selectedProvider = this.providers.find((provider) => provider.isLoggedIn()) ?? null;
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
      resetPicture();
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
    this.isLoggedIn = () => (selectedProvider ? selectedProvider.isLoggedIn() : token !== null);

    /**
     * Returns a copy of the shared user metadata, or `null` when logged out.
     * @returns {UserIdentity|null}
     */
    this.getState = () => (selectedProvider ? selectedProvider.getState() : state && { ...state });

    /** Returns the JWT, or null when logged out. */
    this.getToken = () => (selectedProvider ? selectedProvider.getToken() : token);

    /** Returns the shared authentication instance for coordinating concurrent re-login attempts. */
    this.getSessionOwner = () => sessionOwner ?? this;

    /** DOM handlers bound by ccm-ui through data-on-* attributes. */
    this.events = {
      /** Opens the file picker from the keyboard-accessible avatar button. */
      choosePicture: () => {
        if (this.profilePicture && this.getState()?.provider === "ccm" && !this.gui.busy)
          this.element?.querySelector('[name="profilePicture"]')?.click();
      },

      /** Replaces the uploaded picture with icons.user while preserving its key and permissions. */
      removePicture: async () => {
        if (!this.profilePicture || this.getState()?.provider !== "ccm" || !this.isLoggedIn() || this.gui.busy) return;
        const savedToken = this.getToken();
        const version = ++requestVersion;
        ++pictureVersion;
        this.gui.busy = true;
        this.gui.message = this.labels.savingPicture;
        render();
        try {
          const file = await defaultPicture();
          if (version !== requestVersion || savedToken !== this.getToken()) return;
          const body = new FormData();
          body.set("file", file, "default-picture");
          body.set("token", savedToken);
          body.set("profilePicture", "reset");
          const response = await fetch(new URL("/upload", this.url), { method: "POST", body });
          if (!response.ok) throw Object.assign(new Error(), { status: response.status });
          await response.json();
          if (version !== requestVersion || savedToken !== this.getToken()) return;
          pictureSession = null;
          await restorePicture(true);
          if (version === requestVersion) this.gui.message = "";
        } catch (error) {
          if (version === requestVersion)
            this.gui.message = error.status === 401 ? this.labels.sessionExpired : this.labels.pictureFailed;
        } finally {
          if (version === requestVersion) {
            this.gui.busy = false;
            render();
          }
        }
      },

      /** Uploads a selected image privately, assigns it to this account, then refreshes both avatars. */
      uploadPicture: async (event) => {
        const file = event.currentTarget.files?.[0];
        if (!file || !this.profilePicture || this.getState()?.provider !== "ccm" || !this.isLoggedIn() || this.gui.busy)
          return;
        if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"].includes(file.type)) {
          this.gui.message = this.labels.invalidPicture;
          render();
          return;
        }
        const savedToken = this.getToken();
        const version = ++requestVersion;
        ++pictureVersion;
        this.gui.busy = true;
        this.gui.message = this.labels.uploadingPicture;
        render();
        try {
          const body = new FormData();
          body.set("file", file);
          body.set("token", savedToken);
          const previousKey = await (await pictureRequest({ profilePicture: true }, savedToken)).json();
          if (version !== requestVersion || savedToken !== this.getToken()) return;
          if (previousKey) body.set("key", previousKey);
          else body.set("_", JSON.stringify({ access: { get: "owner", set: "owner", del: "owner" } }));
          const response = await fetch(new URL("/upload", this.url), { method: "POST", body });
          if (!response.ok) throw Object.assign(new Error(), { status: response.status });
          const metadata = await response.json();
          if (version !== requestVersion || savedToken !== this.getToken()) return;
          await (await pictureRequest({ profilePicture: metadata.key }, savedToken)).json();
          if (version !== requestVersion || savedToken !== this.getToken()) return;
          pictureSession = null;
          await restorePicture(true);
          if (version === requestVersion) this.gui.message = "";
        } catch (error) {
          if (version === requestVersion)
            this.gui.message =
              error.status === 401
                ? this.labels.sessionExpired
                : error.status === 413
                  ? this.labels.pictureTooLarge
                  : this.labels.pictureFailed;
        } finally {
          if (version === requestVersion) {
            this.gui.busy = false;
            render();
          }
        }
      },

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

      /** Closes the dialog when a click lands on the backdrop, outside the dialog's bounds. */
      closeOnBackdrop: (event) => {
        if (event.target !== event.currentTarget) return;
        // Backdrop clicks target the dialog too; clicks on its padding must keep it open.
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom)
          this.events.cancel(event);
      },

      /**
       * Closes the dialog and cancels pending login attempts unless account deletion is in progress.
       * @param {Event} [event] - Close-button click or native dialog cancellation
       */
      cancel: (event) => {
        event?.preventDefault();
        if (this.gui.busy && ["delete", "profile"].includes(this.gui.mode)) return;
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

    /** Releases private image bytes and invalidates any pending download. */
    const resetPicture = () => {
      ++pictureVersion;
      pictureSession = null;
      if (this.gui.picture) URL.revokeObjectURL(this.gui.picture);
      this.gui.picture = "";
      this.gui.hasPicture = false;
    };

    /**
     * Turns the configured user icon into file contents for a profile reset.
     * Inline SVG inherits its namespace and current text color from a standalone wrapper.
     * Image URLs must permit fetching their bytes (same origin or CORS).
     * @returns {Promise<Blob>} Default image; no CCM credentials are sent to an icon URL.
     */
    const defaultPicture = async () => {
      const source = this.icons.user.trim();
      if (/^<svg[\s>]/i.test(source)) {
        const color = this.element ? getComputedStyle(this.element).color : "black";
        return new Blob([
          `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" color="${color}">${source}</svg>`,
        ], { type: "image/svg+xml" });
      }
      const response = await fetch(source, { credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error(this.labels.pictureFailed);
      return response.blob();
    };

    /** Sends JSON credentials in the body, never in an image URL. */
    const pictureRequest = async (params, savedToken) => {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, token: savedToken }),
      });
      if (!response.ok) throw Object.assign(new Error(), { status: response.status });
      return response;
    };

    /** Restores local CCM avatars; external accounts use their provider picture without a server lookup. */
    const restorePicture = async (reportError = false) => {
      const savedToken = this.getToken();
      if (!this.profilePicture || !savedToken || this.getState()?.provider !== "ccm") {
        if (pictureSession || this.gui.picture) resetPicture();
        return;
      }
      if (pictureSession === savedToken) return;
      resetPicture();
      pictureSession = savedToken;
      const version = pictureVersion;
      try {
        const key = await (await pictureRequest({ profilePicture: true }, savedToken)).json();
        if (!key || version !== pictureVersion || savedToken !== this.getToken()) return;
        // A reset keeps the file key; its metadata distinguishes the default from a removable custom image.
        const metadata = await (await pictureRequest({ store: "__files", get: key }, savedToken)).json();
        if (!metadata || version !== pictureVersion || savedToken !== this.getToken()) return;
        this.gui.hasPicture = metadata.defaultPicture !== true;
        const blob = await (await pictureRequest({ download: key }, savedToken)).blob();
        if (version !== pictureVersion || savedToken !== this.getToken()) return;
        this.gui.picture = URL.createObjectURL(blob);
        render();
      } catch (error) {
        if (reportError) throw error;
        // Keep the standard icon if the local file or session is unavailable.
        if (version === pictureVersion) render();
      }
    };

    /** Updates the views while preserving the existing dialog element. */
    const render = () => {
      // Only the highest matching user instance displays the UI; child user instances keep their containers empty.
      if (sessionOwner) return this.element?.replaceChildren();

      // Create the UI shell only once so updates preserve the existing dialog, its modal state and focus handling.
      if (!this.element?.querySelector("[data-user-shell]")) this.ui.render(this.views.main(this), this.element, this);

      /** Existing dialog whose contents are updated without replacing the dialog itself. */
      const dialog = this.element?.querySelector("dialog");
      if (!dialog) return;
      void restorePicture();

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
      return Promise.all(rendered)
        .then(() => this.emit("render"))
        .catch(console.error);
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
      const cancelled = this.providers.map((provider) => provider.cancel());
      if (!cancelled.length) return this.emit("cancel").catch(console.error);
      return Promise.all(cancelled)
        .then(() => this.emit("cancel"))
        .catch(console.error);
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
