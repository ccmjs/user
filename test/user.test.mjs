import * as templates from "./support/templates.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { component } from "../ccm.user.mjs";
import { helper } from "./support/framework.mjs";

function create(load = async () => ({ key: "account", token: "jwt" }), config = {}) {
  let view;
  const app = Object.assign(new component.Instance(), component.config, { registration: true }, config, {
    ccm: { load, helper },
    views: { main: app => { view = app.gui; return app.gui; } },
    ui: { render: () => {} },
  });
  app.url = new URL(app.url).href; // Configuration after the init phase.
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
  }, { extensions: [event => { if (event.type !== "cancel") events.push(event.type); }] });
  assert.equal(app.getToken(), null);
  assert.equal(app.getState(), null);
  const value = await app.register({ user: "André", password: "secret" });
  assert.deepEqual(requests[0].params, { register: { user: "André", password: "secret" }, realm: "ccm" });
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.getState().key, "account");
  assert.equal(app.isLoggedIn(), true);
  assert.deepEqual(value, { key: "account", user: "André", realm: "ccm", provider: "ccm" });
  assert.deepEqual(JSON.parse(JSON.stringify(app.getState())), {
    key: "account", user: "André", realm: "ccm", provider: "ccm",
  });
  assert.equal(Object.hasOwn(app, "state"), false);
  const snapshot = app.getState();
  snapshot.key = "changed";
  assert.equal(app.getState().key, "account");
  value.key = "changed";
  assert.equal(app.getState().key, "account");
  await app.start();
  assert.equal(app.getToken(), "jwt");
  assert.equal(app.getState().user, "André");
  assert.equal(app.getState().realm, "ccm");
  assert.equal(JSON.stringify(app.getState()).includes("jwt"), false);
  await app.logout();
  assert.equal(app.isLoggedIn(), false);
  assert.equal(app.getState(), null);
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
  assert.equal(app.gui.dialog, true);
  await submit(app, { user: "a", password: "wrong" });
  assert.equal(view().message, app.labels.invalid);
  assert.equal(app.isLoggedIn(), false);
  await submit(app, { user: "a", password: "right" });
  assert.equal((await waiting).key, "account");
  assert.equal(app.gui.dialog, false);
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
  assert.equal(app.getState(), null);
  assert.equal(app.gui.dialog, false);
});

test("extensions run sequentially with the component and event type", async () => {
  const events = [];
  const { app } = create(async request => request.params.deleteAccount
    ? true : { key: "account", token: "jwt" }, {
    extensions: [
      async event => {
        if (event.type === "cancel") return;
        assert.deepEqual(Object.keys(event).sort(), ["app", "type"]);
        assert.equal(event.app, app);
        await Promise.resolve();
        events.push(`first:${event.type}`);
      },
      ({ type }) => { if (type !== "cancel") events.push(`second:${type}`); },
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

test("reload restores token and metadata without a server request or login event", async t => {
  const storage = browserStorage(t);
  const { app } = create();
  await app.login({ user: "a", password: "secret" });
  const saved = JSON.parse([...storage.values()][0]);
  assert.deepEqual(saved, { token: "jwt", key: "account", user: "a", realm: "ccm", provider: "ccm" });
  let requests = 0;
  const events = [];
  const { app: reloaded } = create(async () => { requests++; }, { extensions: [({ type }) => events.push(type)] });
  await reloaded.init(); await reloaded.ready();
  await reloaded.start();
  assert.equal(requests, 0);
  assert.deepEqual(events, []);
  assert.equal(reloaded.getToken(), app.getToken());
  assert.deepEqual(reloaded.getState(), app.getState());
  assert.equal(reloaded.gui.dialog, false);
  assert.equal(JSON.stringify(reloaded.getState()).includes("jwt"), false);
  await reloaded.logout();
  assert.equal(storage.size, 0);
});

test("External sessions save only CCM credentials and restore the selected realm", async t => {
  const storage = browserStorage(t);
  const metadata = { key: "campus_account", user: "External user", realm: "tea", provider: "campus", picture: "https://example.org/avatar.png" };
  const { app } = create(async () => ({ ...metadata, token: "ccm-jwt" }), { realm: "tea" });
  await app.login({ code: "campus-proof" }, "campus");
  assert.deepEqual(JSON.parse([...storage.values()][0]), { ...metadata, token: "ccm-jwt" });
  const { app: reloaded } = create(undefined, { realm: "tea" });
  await reloaded.init(); await reloaded.ready();
  assert.deepEqual(reloaded.getState(), metadata);
  assert.equal(reloaded.getToken(), "ccm-jwt");
});

test("malformed, old or mismatched session entries are discarded", async t => {
  const storage = browserStorage(t);
  const key = 'ccm-user-session:["http://localhost:8080/","ccm"]';
  for (const saved of ["old-jwt", "null", "{}", JSON.stringify({ token: "jwt", key: "a", user: "a", realm: "other", provider: "ccm" })]) {
    storage.set(key, saved);
    let requests = 0;
    const { app } = create(async () => { requests++; });
    await app.init(); await app.ready();
    assert.equal(requests, 0);
    assert.equal(app.getToken(), null);
    assert.equal(storage.size, 0);
  }
});

test("storage is isolated by server and realm and can be disabled", async t => {
  const storage = browserStorage(t);
  const { app } = create();
  await app.login({ user: "a", password: "pw" });
  for (const config of [{ url: "https://other.example" }, { realm: "other" }, { session: false }]) {
    const { app: other } = create(undefined, config);
    await other.init(); await other.ready();
    assert.equal(other.getToken(), null);
    await other.logout();
    assert.equal(storage.size, 1);
    if (config.session === false) {
      await other.login({ user: "b", password: "pw" });
      assert.equal(storage.size, 1);
      assert.equal(JSON.parse([...storage.values()][0]).user, "a");
    }
  }
});

test("successful account deletion clears the saved session", async t => {
  const storage = browserStorage(t);
  const { app } = create(async request => request.params.deleteAccount ? true : { key: "a", token: "jwt" });
  await app.register({ user: "a", password: "pw" });
  assert.equal(storage.size, 1);
  await app.deleteAccount();
  assert.equal(storage.size, 0);
});

test("blocked sessionStorage does not prevent login or logout", async t => {
  browserStorage(t);
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new DOMException("Blocked", "SecurityError"); } });
  const { app } = create();
  await app.init(); await app.ready();
  await app.login({ user: "a", password: "pw" });
  assert.equal(app.getToken(), "jwt");
  await app.logout();
  assert.equal(app.getToken(), null);
});

test("views handle null state before login and after logout", async () => {
  const views = await import("../resources/views.mjs");
  const { app } = create();
  Object.assign(app.ui, templates);
  assert.match(String(views.trigger(app)), /Sign in/);
  assert.match(String(views.dialog(app)), /name="password"/);
  await app.login({ user: "André", password: "pw" });
  assert.match(String(views.trigger(app)), /André/);
  assert.match(String(views.dialog(app)), /Your profile/);
  await app.logout();
  assert.equal(app.getState(), null);
  assert.match(String(views.trigger(app)), /Sign in/);
  assert.match(String(views.dialog(app)), /name="password"/);
});

test("identity keys must be single valid CCM keys on login and restoration", async t => {
  const storage = browserStorage(t);
  const storageKey = 'ccm-user-session:["http://localhost:8080/","ccm"]';
  assert.equal(helper.isKey(["app", "user"]), true);
  for (const key of [["app", "user"], "", "1user", "User", "user-name", "a".repeat(33)]) {
    const { app } = create(async () => ({ key, token: "jwt" }));
    await assert.rejects(app.login({ user: "a", password: "pw" }), /Invalid authentication response/);
    assert.equal(app.getState(), null);
    storage.set(storageKey, JSON.stringify({ key, token: "jwt", user: "a", realm: "ccm", provider: "ccm" }));
    await app.init(); await app.ready();
    assert.equal(app.getState(), null);
    assert.equal(storage.size, 0);
  }
});


test("trigger and profile show the provider picture with a standard icon fallback", async () => {
  const views = await import("../resources/views.mjs");
  const { app } = create(async () => ({ key: "account", token: "jwt", user: "Person", realm: "ccm",
    provider: "campus", picture: "https://example.org/avatar.png" }));
  Object.assign(app.ui, templates);
  assert.doesNotMatch(String(views.trigger(app)), /data-on-error/);
  await app.login({ code: "proof" }, "campus");
  assert.match(String(views.trigger(app)), /src="https:\/\/example.org\/avatar.png"/);
  assert.match(String(views.trigger(app)), /data-on-error="hideProfilePicture"/);
  assert.match(String(views.trigger(app)), /class="icon"/);
  assert.match(String(views.dialog(app)), /src="https:\/\/example.org\/avatar.png"/);
  assert.match(String(views.dialog(app)), /data-on-error="hideProfilePicture"/);
  let removed = false;
  app.events.hideProfilePicture({ currentTarget: { remove() { removed = true; } } });
  assert.equal(removed, true);
  await app.logout();
  assert.doesNotMatch(String(views.trigger(app)), /avatar.png/);
});

test("an old failed request cannot clear busy state or set errors on a newer login", async () => {
  const requests = [];
  const { app } = create(() => new Promise((resolve, reject) => requests.push({ resolve, reject })));
  const old = app.login({ user: "old", password: "pw" });
  const rejected = assert.rejects(old, { status: 401 });
  await app.logout();
  const current = app.login({ user: "current", password: "pw" });
  requests[0].reject(Object.assign(new Error("Old failure"), { status: 401 }));
  await rejected;
  assert.equal(app.gui.busy, true);
  assert.equal(app.gui.message, "");
  requests[1].resolve({ key: "current", token: "new-token" });
  await current;
  assert.equal(app.getState().user, "current");
  assert.equal(app.getToken(), "new-token");
  assert.equal(app.gui.busy, false);
});

test("invalid credentials and duplicate requests never reach the server", async () => {
  let calls = 0, finish;
  const { app } = create(() => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  });
  for (const [credentials, provider] of [
    [{}, "ccm"], [{ user: "a", password: 123 }, "ccm"],
    [[], "external"], ["invalid", "external"],
  ]) await assert.rejects(app.login(credentials, provider), TypeError);
  assert.equal(calls, 0);
  const pending = app.login({ user: "a", password: "pw" });
  await assert.rejects(app.login({ user: "b", password: "pw" }), /already in progress/);
  assert.equal(calls, 1);
  finish({ key: "account", token: "jwt" });
  await pending;
});

test("a stale deletion response cannot sign out a newly authenticated user", async () => {
  let finishDeletion;
  const { app } = create(request => request.params.deleteAccount
    ? new Promise(resolve => { finishDeletion = resolve; })
    : Promise.resolve({ key: request.params.credentials.user, token: "jwt" }));
  await app.login({ user: "old", password: "pw" });
  const deleting = app.deleteAccount();
  await app.logout();
  await app.login({ user: "current", password: "pw" });
  finishDeletion(true);
  await deleting;
  assert.equal(app.getState().key, "current");
  assert.equal(app.isLoggedIn(), true);
});

test("interactive login resolves even when a subsequent extension fails", async () => {
  const failure = new Error("Extension failed");
  const { app } = create(undefined, { extensions: [() => { throw failure; }] });
  const waiting = app.login();
  await assert.rejects(app.login({ user: "a", password: "pw" }), error => error === failure);
  assert.equal((await waiting).key, "account");
  assert.equal(app.isLoggedIn(), true);
});

test("views escape user text and offer a provider slot only in login mode", async () => {
  const views = await import("../resources/views.mjs");
  const { app } = create();
  Object.assign(app.ui, templates);
  app.gui.username = '\"><img src=x onerror=alert(1)>';
  const login = String(views.dialog(app));
  assert.match(login, /data-auth-providers/);
  assert.match(login, /class="auth-divider"/);
  assert.doesNotMatch(login, /<img src=x/);
  assert.match(login, /&quot;&gt;&lt;img/);
  app.gui.mode = "register";
  const registration = String(views.dialog(app));
  assert.doesNotMatch(registration, /data-auth-providers|class="auth-divider"/);
  assert.match(registration, /name="confirmation"/);
  await app.login({ user: "<script>alert(1)</script>", password: "pw" });
  assert.doesNotMatch(String(views.trigger(app)), /<script>/);
  assert.doesNotMatch(String(views.dialog(app)), /<script>/);
  assert.match(String(views.trigger(app)), /&lt;script&gt;/);
});

test("external credentials are provider-defined and pass unchanged to the server", async () => {
  const credentials = { code: "authorization-code", verifier: "proof-key" };
  const { app } = create(async request => {
    assert.deepEqual(request.params, { login: "campus", credentials, realm: "ccm" });
    return { key: "campus_user", user: "Person", realm: "ccm", provider: "campus", token: "jwt" };
  });
  assert.equal((await app.login(credentials, "campus")).provider, "campus");
});

test("UI events await extensions in order and stop dispatch on errors", async () => {
  const calls = [];
  let finish;
  const failure = new Error("UI hook failed");
  const { app } = create(undefined, { extensions: [
    () => { calls.push("first"); return new Promise(resolve => { finish = resolve; }); },
    () => { calls.push("second"); throw failure; },
    () => calls.push("third"),
  ] });
  const subscribers = [];
  app.subscribe(type => subscribers.push(type));
  const emitted = app.emit("cancel");
  assert.deepEqual(calls, ["first"]);
  finish();
  await assert.rejects(emitted, error => error === failure);
  assert.deepEqual(calls, ["first", "second"]);
  assert.deepEqual(subscribers, []);
});

test("UI events reach listeners after extensions with the same event payload", async () => {
  const calls = [];
  const { app } = create(undefined, { extensions: [null, async event => {
    await Promise.resolve();
    assert.deepEqual(event, { app, type: "render" });
    calls.push("extension");
  }] });
  app.subscribe(type => calls.push(type));
  await app.emit("render");
  assert.deepEqual(calls, ["extension", "render"]);
});
