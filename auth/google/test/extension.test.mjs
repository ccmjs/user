import test from "node:test";
import assert from "node:assert/strict";
import { google, defaults } from "../extension.mjs";
import { demo } from "../../../resources/configs.mjs";
import { component } from "../../../ccm.user.mjs";
import { helper } from "../../../test/support/framework.mjs";

/** Minimal DOM surface to exercise extension insertion through the real render hook. */
function create(extensions, load = async () => ({
  key: "account", user: "Person", realm: "ccm", provider: "google", token: "jwt",
})) {
  let slot;
  const doc = { createElement: () => ({ dataset: {}, addEventListener(type, handler) { this[type] = handler; } }) };
  const dialog = {
    open: false,
    showModal() { this.open = true; }, close() { this.open = false; },
    querySelector: selector => selector === "[data-auth-providers]" ? slot : null,
  };
  const app = Object.assign(new component.Instance(), component.config, {
    session: false, registration: true, extensions,
    ccm: { helper, load },
    element: { querySelector: selector => selector === "dialog" ? dialog
      : selector === "[data-auth-providers]" ? slot : selector === "[data-user-shell]" ? {} : { focus() {} } },
    views: { main: () => "", trigger: () => "", dialog: () => "" },
    ui: { render(content, target) {
      if (target !== dialog) return;
      slot = {
        ownerDocument: doc, children: [],
        append(button) { this.children.push(button); },
        querySelector() { return this.children.find(button => button.dataset.provider === "google"); },
      };
    } },
  });
  return { app, dialog, buttons: () => slot.children };
}

/** Mocks only the popup window; message validation and cleanup use the real adapter. */
function browser(t) {
  const previous = new Map(["window", "location"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let receive, url;
  const messages = [];
  const popup = { closed: false, close() { this.closed = true; }, postMessage(data) { messages.push(data); } };
  globalThis.location = { origin: "https://app.example" };
  globalThis.window = {
    open(value) { url = new URL(value); return popup; },
    addEventListener(type, handler) { receive = handler; },
    removeEventListener() { receive = null; },
  };
  t.after(() => {
    for (const [key, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  return {
    popup, messages,
    reply(type, extra = {}) {
      receive?.({ source: popup, origin: url.origin, data: {
        type, request: new URLSearchParams(url.hash.slice(1)).get("request"), ...extra,
      } });
    },
  };
}

test("Google extension mounts once per render and independently owns its labels", async t => {
  const browserUI = browser(t);
  const [loader, resource] = demo.extensions[0];
  assert.equal(loader, "ccm.load");
  const [path, name] = resource.split("#");
  const extension = (await import(new URL(`../../../${path}`, import.meta.url)))[name];
  assert.equal(typeof extension, "function");
  const { app, buttons } = create([extension]);
  app.google = { labels: { button: "Google verwenden", popup: { heading: "Anmelden für" } } };
  const waiting = app.login();
  assert.equal(buttons().length, 1);
  assert.equal(buttons()[0].textContent, "Google verwenden");
  await app.emit("render");
  assert.equal(buttons().length, 1);
  const operation = buttons()[0].click();
  assert.equal(app.gui.busy, true);
  assert.equal(buttons()[0].disabled, true);
  browserUI.reply("ccm-google-ready");
  assert.equal(browserUI.messages[0].labels.heading, "Anmelden für");
  assert.equal(browserUI.messages[0].labels.loading, defaults.labels.popup.loading);
  browserUI.reply("ccm-google-result", { idToken: "proof" });
  await operation;
  assert.equal((await waiting).provider, "google");
  assert.equal(app.gui.busy, false);
  assert.equal(browserUI.popup.closed, true);
  assert.equal(buttons().length, 0);
  assert.equal(component.config.google, undefined);
});

test("closing or logging out cancels an extension popup and ignores late results", async t => {
  for (const action of ["cancel", "logout"]) await t.test(action, async t => {
    const browserUI = browser(t);
    let requests = 0;
    const { app, buttons } = create([google()], async () => { requests++; });
    const waiting = app.login();
    const rejected = assert.rejects(waiting, { name: "AbortError" });
    const operation = buttons()[0].click();
    if (action === "cancel") app.events.cancel();
    else await app.logout();
    browserUI.reply("ccm-google-result", { idToken: "late" });
    await Promise.all([operation, rejected]);
    assert.equal(browserUI.popup.closed, true);
    assert.equal(requests, 0);
    assert.equal(app.gui.busy, false);
    assert.equal(app.isLoggedIn(), false);
  });
});

test("provider failures leave the interactive login available for another attempt", async t => {
  const browserUI = browser(t);
  const { app, buttons } = create([google({ labels: { failed: "Try another method" } })], async () => {
    throw Object.assign(new Error(), { status: 401 });
  });
  const waiting = app.login();
  const rejected = assert.rejects(waiting, { name: "AbortError" });
  const operation = buttons()[0].click();
  browserUI.reply("ccm-google-result", { idToken: "proof" });
  await operation;
  assert.equal(app.gui.message, "Try another method");
  assert.equal(app.gui.busy, false);
  assert.equal(buttons().length, 1);
  app.events.cancel();
  await rejected;
});

test("Google and an unrelated provider can share the slot; registration has no provider buttons", async () => {
  const other = ({ app, type }) => {
    if (type !== "render" || !app.gui.dialog || app.gui.mode !== "login") return;
    const slot = app.element.querySelector("[data-auth-providers]");
    const button = slot.ownerDocument.createElement("button");
    button.textContent = "Other provider";
    slot.append(button);
  };
  const { app, buttons } = create([other, google()]);
  const waiting = app.login();
  const rejected = assert.rejects(waiting, { name: "AbortError" });
  await app.start();
  assert.deepEqual(buttons().map(button => button.textContent), ["Other provider", "Sign in with Google"]);
  app.gui.mode = "register";
  await app.start();
  assert.equal(buttons().length, 0);
  app.events.cancel();
  await rejected;
});

test("Google extension sends display preferences with the proof of identity", async t => {
  for (const settings of [{}, { displayName: "id", picture: false }]) await t.test(JSON.stringify(settings), async t => {
    const browserUI = browser(t);
    const { app, buttons } = create([google(settings)], async request => {
      assert.deepEqual(request.params.credentials, {
        idToken: "proof", displayName: settings.displayName ?? "name", picture: settings.picture ?? true,
      });
      return { key: "account", user: "google-id", realm: "ccm", provider: "google", token: "jwt" };
    });
    const waiting = app.login();
    const operation = buttons()[0].click();
    browserUI.reply("ccm-google-result", { idToken: "proof" });
    await operation;
    assert.equal((await waiting).user, "google-id");
    assert.equal(app.getState().picture, undefined);
  });
});
