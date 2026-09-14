import test from "node:test";
import assert from "node:assert/strict";
import { component } from "../../ccm.user.mjs";

function create(load) {
  const app = Object.assign(new component.Instance(), component.config, {
    ccm: { load },
    views: { main: app => app.gui },
    ui: { render: () => {} },
  });
  return { app };
}

test("Google callback uses verified server metadata and resolves interactive login", async () => {
  const { app } = create(async request => {
    assert.deepEqual(request.params, { login: "google", credentials: { idToken: "google-proof" }, realm: "ccm" });
    return { key: "external", token: "ccm-jwt", user: "Google User", realm: "ccm", provider: "google" };
  });
  const waiting = app.login();
  await app.loginWithProvider("google", { idToken: "google-proof" });
  assert.deepEqual(await waiting, { key: "external", user: "Google User", realm: "ccm", provider: "google" });
  assert.equal(app.getToken(), "ccm-jwt");
});

test("late provider responses cannot restore a cancelled session", async () => {
  let finish;
  const { app } = create(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.loginWithProvider("google", { idToken: "proof" });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await app.logout();
  finish({ key: "external", token: "jwt", user: "Name", realm: "ccm", provider: "google" });
  await rejected;
  assert.equal(app.isLoggedIn(), false);
});
