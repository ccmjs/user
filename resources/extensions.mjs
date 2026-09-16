import { google as createGoogleExtension } from "../auth/google/extension.mjs";

/** Google handlers keep each user instance's configuration and pending popup separate. */
const googleHandlers = new WeakMap();

/**
 * Adds Google sign-in using the optional settings in config.google.
 * @param {{app: Object, type: string}} event - User instance and emitted event
 */
export function google(event) {
  const { app, type } = event;
  if (app.getSessionOwner() !== app || (type !== "render" && type !== "cancel")) return;
  if (!googleHandlers.has(app)) googleHandlers.set(app, createGoogleExtension(app.google));
  return googleHandlers.get(app)(event);
}
