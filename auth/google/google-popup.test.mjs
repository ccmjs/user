import test from "node:test";
import assert from "node:assert/strict";
import { login } from "./google.mjs";

test("popup accepts only its own origin, window and request and cleans up", async t => {
  const previous = { window: globalThis.window, location: globalThis.location };
  t.after(() => Object.assign(globalThis, previous));
  let receive, opened;
  const messages = [];
  const popup = { closed: false, close() { this.closed = true; }, postMessage(...args) { messages.push(args); } };
  globalThis.location = { origin: "https://embedding.example" };
  globalThis.window = {
    open(url) { opened = new URL(url); return popup; },
    addEventListener(type, fn) { receive = fn; },
    removeEventListener() { receive = null; },
  };
  const operation = login({ google: { url: "https://login.example/auth/google/google.html" }, url: "https://server.example", labels: {} });
  const request = new URLSearchParams(opened.hash.slice(1)).get("request");
  const data = { type: "ccm-google-result", request, idToken: "proof" };
  receive({ origin: "https://wrong.example", source: popup, data });
  receive({ origin: opened.origin, source: {}, data });
  receive({ origin: opened.origin, source: popup, data: { ...data, request: "wrong" } });
  assert.equal(popup.closed, false);
  receive({ origin: opened.origin, source: popup, data: { type: "ccm-google-ready", request } });
  assert.equal(messages[0][1], opened.origin);
  receive({ origin: opened.origin, source: popup, data });
  assert.deepEqual(await operation.promise, { idToken: "proof" });
  assert.equal(receive, null); assert.equal(popup.closed, true);
});
