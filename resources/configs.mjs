/** Demo with local registration and an independent Google authentication component. */
export const demo = {
  registration: true,
  providers: [["ccm.instance", "https://ccmjs.github.io/google_login/ccm.google_login.mjs", {
    // Resolve provider resources independently of the page embedding this demo.
    url: "https://ccmjs.github.io/google_login/auth.html",
    ui: ["ccm.load", "https://ccmjs.github.io/google_login/libs/ccm-ui/ccm-ui.mjs"],
    views: ["ccm.load", "https://ccmjs.github.io/google_login/resources/views.mjs"],
    css: ["ccm.load", "https://ccmjs.github.io/google_login/resources/styles.css"],
  }]],
};
