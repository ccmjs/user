import test from "node:test";
import assert from "node:assert/strict";
import { component } from "../ccm.user.mjs";
import { helper } from "./support/framework.mjs";

function create(load) {
  const app = Object.assign(new component.Instance(), component.config, {
    ccm: { load, helper },
    views: { main: app => app.gui },
    ui: { render: () => {} },
  });
  return { app };
}

test("External callback uses verified server metadata and resolves interactive login", async () => {
  const { app } = create(async request => {
    assert.deepEqual(request.params, { login: "campus", credentials: { code: "campus-proof" }, realm: "ccm" });
    return { key: "external", token: "ccm-jwt", user: "External User", realm: "ccm", provider: "campus" };
  });
  const waiting = app.login();
  await app.login({ code: "campus-proof" }, "campus");
  assert.deepEqual(await waiting, { key: "external", user: "External User", realm: "ccm", provider: "campus" });
  assert.equal(app.getToken(), "ccm-jwt");
});

test("External responses must match the requested realm and provider and contain a usable token", async () => {
  const valid = { key: "account", user: "Person", realm: "ccm", provider: "campus", token: "jwt" };
  for (const change of [{ realm: "other" }, { provider: "ccm" }, { user: null }, { token: "" }, { token: 123 }]) {
    const { app } = create(async () => ({ ...valid, ...change }));
    await assert.rejects(app.login({ code: "proof" }, "campus"), /Invalid authentication response/);
    assert.equal(app.isLoggedIn(), false);
    assert.equal(app.getState(), null);
    assert.equal(app.gui.busy, false);
  }
});
