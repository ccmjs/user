import assert from "node:assert/strict";
import test from "node:test";
import { component } from "../ccm.user.mjs";

function create(load = async () => ({ key: "account", token: "jwt" }), config = {}) {
  let view;
  const app = Object.assign(new component.Instance(), component.config, config, {
    ccm: { load },
    views: { main: app => { view = app.state; return app.state; } },
    ui: { render: () => {} },
  });
  return { app, view: () => view };
}

function submit(app, credentials, confirmation) {
  return app.events.submit({
    preventDefault() {},
    currentTarget: {
      elements: { namedItem: name => ({ value: ({ ...credentials, confirmation })[name] }) },
    },
  });
}

test("register, token access, metadata and logout", async () => {
  const requests = [], events = [];
  const { app } = create(async request => {
    requests.push(request);
    return { key: "account", token: "jwt" };
  }, { onchange: event => events.push(event.type) });
  assert.equal(app.getToken(), null);
  const value = await app.register({ user: "André", password: "secret" });
  assert.deepEqual(requests[0].params, { register: { user: "André", password: "secret" } });
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.state.key, "account");
  assert.equal(app.isLoggedIn(), true);
  assert.deepEqual(value, { key: "account", user: "André", realm: "ccm" });
  value.key = "changed";
  assert.equal(app.state.key, "account");
  await app.start();
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.state.user, "André");
  assert.equal(app.state.realm, "ccm");
  assert.equal(Object.hasOwn(app.state, "session"), false);
  assert.equal(JSON.stringify(app.state).includes("jwt"), false);
  assert.equal(app.getValue, undefined);
  assert.equal(app.getKey, undefined);
  await app.logout();
  assert.equal(app.isLoggedIn(), false);
  assert.equal(app.state.key, null);
  assert.equal(app.state.user, null);
  assert.equal(app.state.realm, null);
  assert.deepEqual(events, ["register", "logout"]);
});

test("interactive login waits for successful form submission after an error", async () => {
  let attempts = 0;
  const { app, view } = create(async request => {
    assert.equal(request.params.login, "ccm");
    if (++attempts === 1) throw Object.assign(new Error(), { status: 401 });
    return { key: "account", token: "jwt" };
  });
  const waiting = app.login();
  assert.equal(waiting, app.login());
  assert.equal(app.state.cancellable, true);
  await submit(app, { user: "a", password: "wrong" });
  assert.equal(view().message, app.labels.invalid);
  assert.equal(app.isLoggedIn(), false);
  await submit(app, { user: "a", password: "right" });
  assert.equal((await waiting).key, "account");
  assert.equal(app.state.cancellable, false);
  assert.equal(app.getToken(), "jwt");
});

test("password confirmation prevents registration requests", async () => {
  let calls = 0;
  const { app, view } = create(async () => { calls++; });
  const waiting = app.register();
  const cancelled = assert.rejects(waiting, { name: "AbortError" });
  await submit(app, { user: "a", password: "one" }, "two");
  assert.equal(calls, 0);
  assert.equal(view().message, app.labels.mismatch);
  app.events.cancel();
  await cancelled;
});

test("logout invalidates an in-flight authentication response", async () => {
  let finish;
  const { app } = create(() => new Promise(resolve => { finish = resolve; }));
  const loggingIn = app.login({ user: "a", password: "pw" });
  const rejected = assert.rejects(loggingIn, { name: "AbortError" });
  await app.logout();
  finish({ key: "account", token: "jwt" });
  await rejected;
  assert.equal(app.getToken(), null);
});

test("invalid responses and disabled registration cannot create a session", async () => {
  const { app } = create(async () => ({ key: "a" }), { registration: false });
  await assert.rejects(app.register({ user: "a", password: "pw" }), /disabled/);
  await assert.rejects(app.login({ user: "a", password: "pw" }), /Invalid authentication response/);
  assert.equal(app.isLoggedIn(), false);
});

test("header actions open login and profile dialogs; cancellation keeps the session", async () => {
  const { app } = create();
  await app.start();
  assert.equal(app.state.dialog, false);
  const login = app.login();
  const cancelled = assert.rejects(login, { name: "AbortError" });
  assert.equal(app.state.dialog, true);
  app.events.cancel();
  await cancelled;
  assert.equal(app.state.dialog, false);
  await app.login({ user: "a", password: "pw" });
  assert.equal(app.state.dialog, false);
  app.events.open();
  assert.equal(app.state.dialog, true);
  assert.equal(app.state.mode, "profile");
  app.events.requestDelete();
  assert.equal(app.state.mode, "delete");
  app.events.keepAccount();
  assert.equal(app.state.mode, "profile");
  app.events.cancel();
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.state.dialog, false);
});

test("account deletion requires success before clearing the local session", async () => {
  const requests = [];
  let fail = true;
  const { app } = create(async request => {
    requests.push(request.params);
    if (!request.params.deleteAccount) return { key: "account", token: "jwt" };
    if (fail) throw Object.assign(new Error("Unavailable"), { status: 500 });
    return true;
  });
  await app.login({ user: "a", password: "pw" });
  app.events.open();
  app.events.requestDelete();
  await assert.rejects(app.deleteAccount(), { status: 500 });
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.state.message, app.labels.deletionFailed);
  fail = false;
  await app.deleteAccount();
  assert.deepEqual(requests.at(-1), { deleteAccount: true, token: "jwt" });
  assert.equal(app.getToken(), null);
  assert.equal(app.state.user, null);
  assert.equal(app.state.dialog, false);
});
