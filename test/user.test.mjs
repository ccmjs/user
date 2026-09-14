import assert from "node:assert/strict";
import test from "node:test";
import { component } from "../ccm.user.mjs";

function create(load = async () => ({ key: "account", token: "jwt" }), config = {}) {
  let view;
  const app = Object.assign(new component.Instance(), component.config, config, {
    ccm: { load },
    views: { main: app => { view = app.gui; return app.gui; } },
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
  }, { extensions: [event => events.push(event.type)] });
  assert.equal(app.getToken(), null);
  const value = await app.register({ user: "André", password: "secret" });
  assert.deepEqual(requests[0].params, { register: { user: "André", password: "secret" } });
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.state.key, "account");
  assert.equal(app.isLoggedIn(), true);
  assert.deepEqual(value, { key: "account", user: "André", realm: "ccm" });
  assert.deepEqual(JSON.parse(JSON.stringify(app.state)), {
    key: "account", user: "André", realm: "ccm",
  });
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
  assert.equal(app.gui.cancellable, true);
  await submit(app, { user: "a", password: "wrong" });
  assert.equal(view().message, app.labels.invalid);
  assert.equal(app.isLoggedIn(), false);
  await submit(app, { user: "a", password: "right" });
  assert.equal((await waiting).key, "account");
  assert.equal(app.gui.cancellable, false);
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
  assert.equal(app.gui.dialog, false);
  const login = app.login();
  const cancelled = assert.rejects(login, { name: "AbortError" });
  assert.equal(app.gui.dialog, true);
  app.events.cancel();
  await cancelled;
  assert.equal(app.gui.dialog, false);
  await app.login({ user: "a", password: "pw" });
  assert.equal(app.gui.dialog, false);
  app.events.open();
  assert.equal(app.gui.dialog, true);
  assert.equal(app.gui.mode, "profile");
  app.events.requestDelete();
  assert.equal(app.gui.mode, "delete");
  app.events.keepAccount();
  assert.equal(app.gui.mode, "profile");
  app.events.cancel();
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.gui.dialog, false);
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
  assert.equal(app.gui.message, app.labels.deletionFailed);
  fail = false;
  await app.deleteAccount();
  assert.deepEqual(requests.at(-1), { deleteAccount: true, token: "jwt" });
  assert.equal(app.getToken(), null);
  assert.equal(app.state.user, null);
  assert.equal(app.gui.dialog, false);
});

test("extensions run sequentially with the component and event type", async () => {
  const events = [];
  const { app } = create(async request => request.params.deleteAccount
    ? true : { key: "account", token: "jwt" }, {
    extensions: [
      async event => {
        assert.deepEqual(Object.keys(event).sort(), ["app", "type"]);
        assert.equal(event.app, app);
        await Promise.resolve();
        events.push(`first:${event.type}`);
      },
      ({ type }) => events.push(`second:${type}`),
    ],
  });
  await app.login({ user: "a", password: "pw" });
  await app.deleteAccount();
  assert.deepEqual(events, [
    "first:login", "second:login", "first:logout", "second:logout",
    "first:deleteAccount", "second:deleteAccount",
  ]);
});

test("extension errors stop dispatch without reverting authentication", async () => {
  const failure = new Error("Extension failed");
  let reached = false;
  const { app } = create(undefined, {
    extensions: [
      async () => { throw failure; },
      () => { reached = true; },
    ],
  });
  await assert.rejects(app.login({ user: "a", password: "pw" }), error => error === failure);
  assert.equal(reached, false);
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.gui.busy, false);
});

function browserStorage(t) {
  const values = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor);
    else delete globalThis.sessionStorage;
  });
  return values;
}

test("reload restores server-verified metadata and stores only the CCM token", async t => {
  const storage = browserStorage(t);
  const { app } = create();
  await app.init();
  await app.login({ user: "a", password: "secret" });
  assert.deepEqual([...storage.values()], ["jwt"]);
  const events = [];
  const { app: reloaded } = create(async request => {
    assert.deepEqual(request.params, { session: true, token: "jwt" });
    return { key: "account", user: "server-name", realm: "ccm" };
  }, { extensions: [({ type }) => events.push(type)] });
  await reloaded.init();
  await reloaded.start();
  assert.equal(reloaded.getToken(), "jwt");
  assert.deepEqual(reloaded.state, { key: "account", user: "server-name", realm: "ccm" });
  assert.deepEqual(events, []);
  assert.equal(reloaded.gui.dialog, false);
  await reloaded.logout();
  assert.equal(storage.size, 0);
});

test("Google sessions restore without reopening Google and deletion clears storage", async t => {
  const storage = browserStorage(t);
  const { app } = create(async () => ({ key: "google-account", user: "Google user", realm: "google", token: "ccm-jwt" }));
  await app.loginWithProvider("google", { idToken: "google-proof" });
  assert.deepEqual([...storage.values()], ["ccm-jwt"]);
  const { app: reloaded } = create(async () => ({ key: "google-account", user: "Google user", realm: "google" }));
  await reloaded.init();
  assert.equal(reloaded.state.realm, "google");
  await reloaded.logout();
  const { app: local } = create(async request => request.params.deleteAccount ? true : { key: "local", token: "jwt" });
  await local.register({ user: "a", password: "pw" });
  await local.deleteAccount();
  assert.equal(storage.size, 0);
});

test("invalid or expired sessions are removed; temporary failures preserve the saved token", async t => {
  const storage = browserStorage(t);
  for (const status of [401, 403, 500]) {
    const { app } = create();
    await app.login({ user: "a", password: "pw" });
    const { app: reloaded } = create(async () => { throw Object.assign(new Error(), { status }); });
    await reloaded.init();
    assert.equal(reloaded.isLoggedIn(), false);
    assert.equal(reloaded.gui.busy, false);
    assert.equal(storage.size, status === 500 ? 1 : 0);
  }
});

test("storage is isolated by server and sessionKey and can be disabled", async t => {
  const storage = browserStorage(t);
  const { app } = create();
  await app.login({ user: "a", password: "pw" });
  for (const config of [{ url: "https://other.example" }, { sessionKey: "other" }, { session: false }]) {
    const { app: other } = create(async () => { assert.fail("Must not restore another session"); }, config);
    await other.init();
    assert.equal(other.getToken(), null);
    await other.logout();
    assert.equal(storage.size, 1);
  }
  const { app: disabled } = create(undefined, { session: false });
  await disabled.login({ user: "b", password: "pw" });
  assert.equal(storage.size, 1);
});

test("logout prevents an in-flight restoration from signing back in", async t => {
  const storage = browserStorage(t);
  const { app } = create();
  await app.login({ user: "a", password: "pw" });
  let finish;
  const { app: reloaded } = create(() => new Promise(resolve => { finish = resolve; }));
  const restoring = reloaded.init();
  await reloaded.logout();
  finish({ key: "account", user: "a", realm: "ccm" });
  await restoring;
  assert.equal(reloaded.isLoggedIn(), false);
  assert.equal(storage.size, 0);
});

test("blocked sessionStorage does not prevent login or logout", async t => {
  browserStorage(t);
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new DOMException("Blocked", "SecurityError"); } });
  const { app } = create();
  await app.init();
  await app.login({ user: "a", password: "pw" });
  assert.equal(app.getToken(), "jwt");
  await app.logout();
  assert.equal(app.getToken(), null);
});
