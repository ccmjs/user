# Changelog

Notable changes to the ccmjs User component are documented here, newest first.

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
