# Changelog

Notable changes to the ccmjs User component are documented here, newest first.

## 1.2.0

### Changed

- The demo now uses the bundled Google Login v1.2.0 provider. The Google sign-in
  button displays the official Google G alongside the configured label.
- The sign-in and sign-out controls now have a minimum height of 44 px.
- The account button and dialogs now use the ccmjs tile logo and its colors.
  Set `icons.login` to replace the logo on the sign-in button and in every dialog header.

### Fixed

- Normalize the server URL during initialization so nested instances configured
  with an origin such as `https://example.org` and `https://example.org/`
  can share their login session.

## 1.1.0

### Added

- English and German labels and configurable account icons in `resources/content.mjs`.

### Changed

- The User component now uses ccmjs 29.1.0.
- The demo uses the bundled Google Login v1.1.0 with its own framework declaration.

### Fixed

- Profile picture uploads preserve the path of the configured CCM API. An API
  mounted at `/api` or `/api/` receives uploads at `/api/upload`.

## 1.0.0

### Added

- Initial release with local CCM registration and login, support for external
  authentication providers, and private profile pictures for local accounts.
