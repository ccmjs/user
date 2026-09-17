import test from "node:test";
import assert from "node:assert/strict";
import { component } from "../ccm.user.mjs";
import { helper } from "./support/framework.mjs";

/** Models a provider that owns its token and metadata independently of User. */
function create() {
  let token = null;
  const identity = { key: "person", user: "Person", realm: "ccm", provider: "campus" };
  const provider = {
    host: {}, extensions: [], starts: 0, cancelled: 0, logins: 0,
    getState: () => token ? { ...identity } : null,
    getToken: () => token, isLoggedIn: () => token !== null,
    setDisabled(value) { this.disabled = value; },
    async start() { this.starts++; },
    async cancel() { this.cancelled++; await this.emit("cancel"); },
    async logout() { const changed = !!token; token = null; await this.cancel(); if (changed) await this.emit("logout"); },
    async login() { await this.emit("before-login"); token = `jwt-${++this.logins}`;
      await this.emit("login"); await this.emit("finish"); return this.getState(); },
    restore() { token = "restored"; },
    async emit(type) { for (const extension of this.extensions) await extension({ app: this, type }); },
  };
  const slot = { append(host) { assert.equal(host, provider.host); } };
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; },
    querySelector: selector => selector === "[data-auth-providers]" ? slot : null };
  const events = [];
  const app = Object.assign(new component.Instance(), component.config, {
    providers: [provider], session: false,
    ccm: { helper, load: async () => { throw new Error("User must not exchange provider credentials"); } },
    extensions: [({ type }) => events.push(type)],
    views: { main() {}, trigger() {}, dialog() {} }, ui: { render() {} },
    element: { querySelector: selector => selector === "dialog" ? dialog : { focus() {} } },
  });
  return { app, provider, events };
}

test("User delegates live session access and re-login without issuing server requests", async () => {
  const { app, provider, events } = create();
  await app.init(); await app.ready();
  const waiting = app.login();
  await provider.login();
  assert.equal((await waiting).provider, "campus");
  assert.equal(app.getToken(), "jwt-1");
  assert.equal(app.isLoggedIn(), true);
  await app.logout();
  assert.equal(provider.isLoggedIn(), false); assert.equal(app.getState(), null);
  assert.equal(events.filter(type => type === "logout").length, 1);
  await app.login();
  assert.equal(app.getToken(), "jwt-2"); assert.equal(provider.logins, 2);
  await provider.logout();
  assert.equal(app.getToken(), null);
  assert.equal(events.filter(type => type === "logout").length, 2);
});

test("a restored provider session is selected without copying it into User storage", async () => {
  const { app, provider } = create(); provider.restore();
  await app.init(); await app.ready();
  assert.equal(app.getToken(), "restored");
  assert.deepEqual(app.getState(), provider.getState());
  assert.equal(provider.logins, 0);
});

test("dialog cancellation cancels providers and ignores late login events", async () => {
  const { app, provider } = create();
  await app.init(); await app.ready();
  const rejected = assert.rejects(app.login(), { name: "AbortError" });
  await provider.emit("before-login"); app.events.cancel();
  await provider.emit("login"); await rejected;
  assert.equal(provider.cancelled, 1); assert.equal(app.gui.busy, false); assert.equal(app.isLoggedIn(), false);
});

test("provider failure leaves the shared dialog available for another attempt", async () => {
  const { app, provider } = create();
  await app.init(); await app.ready();
  const rejected = assert.rejects(app.login(), { name: "AbortError" });
  await provider.emit("before-login"); await provider.emit("error");
  assert.equal(app.gui.busy, false); assert.equal(app.gui.dialog, true); assert.equal(app.getState(), null);
  app.events.cancel(); await rejected;
});
