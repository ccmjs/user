import test from "node:test";
import assert from "node:assert/strict";
import { component } from "../../ccm.user.mjs";
import { helper } from "../../test/support/framework.mjs";

function create(load) {
  const app = Object.assign(new component.Instance(), component.config, {
    ccm: { load, helper },
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
  await app.login({ idToken: "google-proof" }, "google");
  assert.deepEqual(await waiting, { key: "external", user: "Google User", realm: "ccm", provider: "google" });
  assert.equal(app.getToken(), "ccm-jwt");
});

test("closing the dialog cancels the Google popup and ignores a late result", async () => {
  let finish, cancelled = 0, requests = 0;
  const { app } = create(async () => { requests++; });
  app.google = { popup: { login: () => ({
    promise: new Promise(resolve => { finish = resolve; }),
    cancel() { cancelled++; },
  }) } };
  const waiting = app.login();
  const rejected = assert.rejects(waiting, { name: "AbortError" });
  const google = app.events.google();
  assert.equal(app.gui.busy, true);
  app.events.cancel();
  finish({ idToken: "late-proof" });
  await Promise.all([google, rejected]);
  assert.equal(cancelled, 1);
  assert.equal(requests, 0);
  assert.equal(app.gui.busy, false);
  assert.equal(app.gui.dialog, false);
  assert.equal(app.isLoggedIn(), false);
});

test("Google responses must match the requested realm and provider and contain a usable token", async () => {
  const valid = { key: "account", user: "Person", realm: "ccm", provider: "google", token: "jwt" };
  for (const change of [{ realm: "other" }, { provider: "ccm" }, { user: null }, { token: "" }, { token: 123 }]) {
    const { app } = create(async () => ({ ...valid, ...change }));
    await assert.rejects(app.login({ idToken: "proof" }, "google"), /Invalid authentication response/);
    assert.equal(app.isLoggedIn(), false);
    assert.equal(app.getState(), null);
    assert.equal(app.gui.busy, false);
  }
});
