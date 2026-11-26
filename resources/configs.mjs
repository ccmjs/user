const server = "https://kless.inf.h-brs.de/api/";

/** Demo with CCM registration and Google sign-in on the same backend. */
export const demo = {
  url: server,
  registration: true,
  providers: [["ccm.instance", "././libs/google_login/ccm.google_login-1.1.0.min.mjs", { server }]],
};
