/** Interface text for the account button, dialogs and authentication errors. */
export const labels = {
  /** English defaults. */
  en: {
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

  /** German translations of the same labels. */
  de: {
    uploadPicture: "Profilbild ändern",
    removePicture: "Bild entfernen",
    savingPicture: "Profilbild wird gespeichert …",
    uploadingPicture: "Profilbild wird hochgeladen …",
    invalidPicture: "Wähle ein Bild im Format PNG, JPEG, GIF, WebP oder AVIF.",
    pictureFailed: "Das Profilbild konnte nicht gespeichert werden.",
    pictureTooLarge: "Das ausgewählte Bild ist zu groß.",
    title: "Anmelden",
    profile: "Dein Profil",
    userId: "Benutzer-ID",
    provider: "Anmeldedienst",
    close: "Dialog schließen",
    deleteAccount: "Konto löschen",
    deleteTitle: "Dein Konto löschen?",
    deleteDescription:
      "Dein Konto wird als gelöscht markiert. Du wirst abgemeldet und kannst dich mit diesem Konto nicht mehr anmelden. Deine Kontodaten bleiben erhalten.",
    confirmDelete: "Mein Konto löschen",
    keepAccount: "Mein Konto behalten",
    deletionFailed: "Dein Konto konnte nicht gelöscht werden. Bitte versuche es erneut.",
    sessionExpired: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    registerTitle: "Konto erstellen",
    user: "Benutzername",
    password: "Passwort",
    confirmation: "Passwort bestätigen",
    login: "Anmelden",
    register: "Registrieren",
    showRegister: "Noch kein Konto? Registrieren",
    showLogin: "Schon ein Konto? Anmelden",
    logout: "Abmelden",
    pending: "Bitte warten …",
    mismatch: "Die Passwörter stimmen nicht überein.",
    invalid: "Benutzername oder Passwort ist falsch.",
    duplicate: "Dieser Benutzername ist bereits vergeben.",
    failed: "Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.",
    registrationFailed: "Die Registrierung ist fehlgeschlagen. Bitte versuche es erneut.",
    registrationDisabled: "Die Registrierung ist deaktiviert.",
    loginCancelled: "Anmeldung abgebrochen.",
    authenticationBusy: "Eine Anmeldung läuft bereits.",
    invalidCredentials: "Benutzername und Passwort müssen Zeichenketten sein.",
    invalidAuthenticationResponse: "Die Antwort auf die Anmeldung ist ungültig.",
    deletionRequiresLogin: "Melde dich an, bevor du dein Konto löschst.",
    requestBusy: "Eine Anfrage läuft bereits.",
    or: "oder",
    invalidProviderCredentials: "Die Anmeldedaten des Anmeldedienstes müssen als Objekt vorliegen.",
    invalidDeletionResponse: "Der Server hat die Löschung des Kontos nicht bestätigt.",
  },
};

/** Shared icons. Each value accepts trusted inline SVG markup or an image URL. */
export const icons = {
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
  /** Pencil on the button for changing a local profile picture. */
  editPicture: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="m4 20 5-1L20 8l-4-4L5 15z M14 6l4 4"/></svg>`,
};
