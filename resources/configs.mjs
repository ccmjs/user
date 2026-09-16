/** Demo configuration used by index.html, enabling local registration and Google sign-in. */
export const demo = {
  registration: true,
  google: {
    url: "https://ccmjs.github.io/user/auth/google/google.html",
    popup: ["ccm.load", "././auth/google/google.mjs"],
  },
};
