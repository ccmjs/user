import { readFileSync } from "node:fs";
import vm from "node:vm";

// Use the bundled framework's actual helpers in component tests.
const window = {};
vm.runInNewContext(
  readFileSync(new URL("../../libs/framework/ccm.js", import.meta.url), "utf8"),
  { window },
);
export const helper = window.ccm.helper;
