import assert from "node:assert/strict";
import test from "node:test";
import { component } from "../ccm.user.mjs";
import { helper } from "./support/framework.mjs";

function create(parent = null, config = {}) {
  const calls = { requests: [], renders: 0, cleared: 0, events: [] };
  const host = { parent };
  const app = Object.assign(new component.Instance(), component.config, {
    parent: host, session: false, registration: true,
    ccm: { helper, load: async request => {
      calls.requests.push(request.params);
      return request.params.deleteAccount ? true : { key: "account", token: "jwt" };
    } },
    ui: { render() { calls.renders++; } },
    views: { main: () => "" },
    element: { querySelector: () => null, replaceChildren() { calls.cleared++; } },
    extensions: [event => calls.events.push(event)],
  }, config);
  host.user = app;
  return { app, host, calls };
}

test("only the highest matching user renders, even when children initialize first", async () => {
  const root = create();
  const middle = create(root.host);
  const leaf = create(middle.host);
  await root.app.init();
  await middle.app.init();
  await leaf.app.init();
  await leaf.app.ready();
  await middle.app.ready();
  await root.app.ready();
  for (const { app } of [root, middle, leaf]) await app.start();
  assert.equal(root.app.getSessionOwner(), root.app);
  assert.equal(middle.app.getSessionOwner(), root.app);
  assert.equal(leaf.app.getSessionOwner(), root.app);
  assert.equal(root.calls.renders, 1);
  assert.equal(middle.calls.renders, 0);
  assert.equal(leaf.calls.renders, 0);
  assert.equal(leaf.calls.cleared, 1);
  await leaf.app.login({ user: "Tea", password: "pw" });
  assert.equal(root.calls.requests.length, 1);
  assert.equal(leaf.calls.requests.length, 0);
  assert.deepEqual(leaf.app.getState(), root.app.getState());
  assert.equal(Object.hasOwn(leaf.app, "state"), false);
  const snapshot = leaf.app.getState();
  snapshot.user = "changed";
  assert.notEqual(root.app.getState().user, "changed");
  assert.deepEqual(leaf.app.getState(), root.app.getState());
  assert.deepEqual(middle.app.getState(), root.app.getState());
  assert.equal(leaf.app.getToken(), "jwt");
  for (const { app, calls } of [root, middle, leaf]) {
    assert.equal(calls.events.length, 1);
    assert.equal(calls.events[0].app, app);
    assert.equal(calls.events[0].type, "login");
  }
  await middle.app.logout();
  for (const { app, calls } of [root, middle, leaf]) {
    assert.equal(app.getState(), null);
    assert.equal(app.isLoggedIn(), false);
    assert.deepEqual(calls.events.map(event => event.type), ["login", "logout"]);
  }
});

test("independent servers, realms and sibling branches retain their own login areas", async () => {
  const root = create();
  const realm = create(root.host, { realm: "tea" });
  const server = create(root.host, { url: "https://other.example" });
  const siblingA = create({});
  const siblingB = create(siblingA.host.parent);
  for (const { app, calls } of [root, realm, server, siblingA, siblingB]) {
    await app.init(); await app.ready();
    await app.start();
    assert.equal(app.getSessionOwner(), app);
    assert.equal(calls.renders, 1);
  }
  // A different intermediate realm does not hide a matching higher ancestor.
  const leaf = create({ parent: realm.host, user: null }, { url: "http://localhost:8080/" });
  await leaf.app.init(); await leaf.app.ready();
  assert.equal(leaf.app.getSessionOwner(), root.app);
});

test("interactive callers share one promise and cancellation reaches all of them", async () => {
  const root = create();
  const child = create(root.host);
  await root.app.init(); await child.app.init();
  await child.app.ready(); await root.app.ready();
  const first = root.app.login();
  const second = child.app.login();
  assert.equal(first, second);
  assert.equal(root.app.gui.dialog, true);
  assert.equal(child.app.gui.dialog, false);
  const cancelled = assert.rejects(second, { name: "AbortError" });
  child.app.events.cancel();
  await cancelled;
  assert.equal(root.app.gui.dialog, false);
  const waiting = child.app.login();
  await root.app.login({ user: "Tea", password: "pw" });
  assert.equal((await waiting).key, "account");
});

test("registration and account deletion delegate and notify each instance once", async () => {
  const root = create();
  const child = create(root.host, { registration: false });
  await root.app.init(); await child.app.init();
  await child.app.ready(); await root.app.ready();
  await child.app.register({ user: "Tea", password: "pw" });
  await child.app.deleteAccount();
  assert.equal(root.calls.requests.length, 2);
  assert.equal(child.calls.requests.length, 0);
  for (const { calls } of [root, child])
    assert.deepEqual(calls.events.map(event => event.type), ["register", "logout", "deleteAccount"]);
  root.app.registration = false;
  await assert.rejects(child.app.register(), /disabled/);
});

test("Google callbacks use the owner transport and preserve provider identity", async () => {
  const root = create(null, { ccm: { helper, load: async request => {
    assert.equal(request.params.login, "google");
    return { key: "google_user", token: "jwt", user: "Tea", realm: "ccm", provider: "google" };
  } } });
  const child = create(root.host);
  await root.app.init(); await child.app.init();
  await child.app.ready(); await root.app.ready();
  await child.app.login({ idToken: "proof" }, "google");
  assert.equal(root.app.getState().provider, "google");
  assert.deepEqual(child.app.getState(), root.app.getState());
});

test("only the owner restores, writes and removes browser storage", async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const calls = [];
  const session = { key: "account", token: "jwt", user: "Tea", realm: "ccm", provider: "ccm" };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: () => { calls.push("get"); return JSON.stringify(session); },
    setItem: () => calls.push("set"), removeItem: () => calls.push("remove"),
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else delete globalThis.sessionStorage;
  });
  const root = create(null, { session: true });
  const child = create(root.host, { session: true });
  await root.app.init(); await child.app.init();
  await child.app.ready(); await root.app.ready();
  assert.deepEqual(calls, ["get"]);
  assert.equal(child.app.getToken(), "jwt");
  await child.app.logout();
  await child.app.login({ user: "Tea", password: "pw" });
  assert.deepEqual(calls, ["get", "remove", "set"]);
});

test("extension failures stop group dispatch without rolling back shared state", async () => {
  const failure = new Error("Extension failed");
  const root = create(null, { extensions: [() => { throw failure; }] });
  const child = create(root.host);
  await root.app.init(); await child.app.init();
  await child.app.ready(); await root.app.ready();
  await assert.rejects(child.app.login({ user: "Tea", password: "pw" }), error => error === failure);
  assert.equal(child.app.getToken(), "jwt");
  assert.equal(child.calls.events.length, 0);
});

test("separate module versions delegate through the public interface and retain their extensions", async () => {
  const { component: otherVersion } = await import("../ccm.user.mjs?version-test");
  assert.notEqual(otherVersion, component);
  const root = create();
  const host = { parent: root.host };
  const events = [];
  const child = Object.assign(new otherVersion.Instance(), otherVersion.config, {
    parent: host, session: false, ccm: { helper },
    extensions: [event => events.push(event)],
  });
  host.user = child;
  await root.app.init();
  await child.init();
  await child.ready();
  await root.app.ready();
  await child.login({ user: "Tea", password: "pw" });
  assert.equal(child.getSessionOwner(), root.app);
  assert.deepEqual(child.getState(), root.app.getState());
  assert.equal(events[0].app, child);
  assert.equal(events[0].type, "login");
  await root.app.logout();
  assert.equal(child.getState(), null);
  assert.equal(events[1].type, "logout");
});

test("subscribers can unsubscribe without affecting application extensions", async () => {
  const { app, calls } = create();
  const received = [];
  const unsubscribe = app.subscribe(type => received.push(type));
  await app.login({ user: "Tea", password: "pw" });
  unsubscribe();
  await app.logout();
  assert.deepEqual(received, ["login"]);
  assert.deepEqual(calls.events.map(event => event.type), ["login", "logout"]);
});
