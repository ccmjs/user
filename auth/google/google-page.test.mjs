import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("hosted page requires validated opener handshake before automatically loading Google", async () => {
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, { disabled: true, addEventListener(type, fn) { this[type] = fn; } });
    return elements.get(key);
  };
  const replies = []; const scripts = []; let receive, options;
  const opener = { postMessage(...args) { replies.push(args); } };
  const context = {
    clientId: "test-client", URL, URLSearchParams,
    location: { hash: '#origin=https%3A%2F%2Fapp.example&request=test' },
    window: { opener, addEventListener(type, fn) { receive = fn; }, close() {} },
    document: { querySelector: element, createElement() { return {}; }, head: { append(script) { scripts.push(script); } } },
    google: { accounts: { id: { initialize(value) { options = value; }, renderButton() {} } } },
  };
  const source = (await readFile(new URL('./google-page.mjs', import.meta.url), 'utf8')).replace('import { clientId } from "./google-config.mjs";', '');
  vm.runInNewContext(source, context);
  assert.equal(scripts.length, 0);
  receive({ source: {}, origin: 'https://app.example', data: { type: 'ccm-google-init', request: 'test', server: 'https://server.example' } });
  assert.equal(scripts.length, 0);
  receive({ source: opener, origin: 'https://wrong.example', data: { type: 'ccm-google-init', request: 'test', server: 'https://server.example' } });
  receive({ source: opener, origin: 'https://app.example', data: { type: 'ccm-google-init', request: 'wrong', server: 'https://server.example' } });
  assert.equal(scripts.length, 0);
  receive({ source: opener, origin: 'https://app.example', data: { type: 'ccm-google-init', request: 'test', server: 'https://server.example' } });
  assert.equal(scripts.length, 1);
  assert.equal(element('#origin').textContent, 'https://app.example');
  assert.equal(scripts[0].src, 'https://accounts.google.com/gsi/client');
  scripts[0].onload();
  assert.equal(options.ux_mode, 'popup');
  options.callback({ credential: 'proof' });
  assert.equal(replies.at(-1)[0].idToken, 'proof');
  assert.equal(replies.at(-1)[1], 'https://app.example');
  assert.equal(context.location.hash.includes('proof'), false);
});
