/** Demo configuration used by index.html, enabling local registration and Google sign-in. */
export const demo = {
  registration: true,
  extensions: [["ccm.load", "././resources/extensions.mjs#google"]],
  google: {
    url: "https://ccmjs.github.io/user/auth/google/google.html",
    displayName: "name", // name, given_name, family_name, email or id
    picture: true,
  },
};
