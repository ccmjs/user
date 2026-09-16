import { clientId } from "./google-config.mjs";

const params = new URLSearchParams(location.hash.slice(1));
const request = params.get("request");
const origin = params.get("origin");
const message = document.querySelector("#message");
const retry = document.querySelector("#retry");
let initialized = false;
let completed = false;

function allowedURL(value) {
  const url = new URL(value);
  if (url.username || url.password ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))))
    throw new Error("Eine HTTPS-Adresse ist erforderlich (lokal ist HTTP erlaubt).");
  return url;
}

function send(type, extra = {}) {
  window.opener.postMessage({ type, request, ...extra }, origin);
}

try {
  if (!window.opener || !request || request.length > 128 || allowedURL(origin).origin !== origin)
    throw new Error("Bitte öffne diese Seite über den Google-Button der User-Komponente.");
  document.querySelector("#origin").textContent = origin;
  window.addEventListener("message", event => {
    if (initialized || event.source !== window.opener || event.origin !== origin ||
        event.data?.type !== "ccm-google-init" || event.data.request !== request) return;
    try {
      allowedURL(event.data.server);
      initialized = true;
      if (!clientId) throw new Error("Die Google-Client-ID fehlt noch in auth/google/google-config.mjs.");
      loadGoogle();
    } catch (error) { message.textContent = error.message; }
  });
  send("ccm-google-ready");
} catch (error) { message.textContent = error.message; }

/** Loads the Google button after the opener handshake, or retries a failed load. */
function loadGoogle() {
  retry.hidden = true;
  message.textContent = "Google-Anmeldung wird geladen …";
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.onload = () => {
    google.accounts.id.initialize({
      client_id: clientId, ux_mode: "popup", auto_select: false,
      callback: response => {
        if (completed || typeof response.credential !== "string") return;
        completed = true;
        send("ccm-google-result", { idToken: response.credential });
        message.textContent = "Anmeldung wird an die Webseite übergeben …";
      },
    });
    google.accounts.id.renderButton(document.querySelector("#google"), {
      type: "standard", theme: "outline", size: "large",
    });
    message.textContent = "";
  };
  script.onerror = () => {
    message.textContent = "Google konnte nicht geladen werden. Bitte versuche es erneut.";
    retry.hidden = false;
    script.remove();
  };
  document.head.append(script);
}

retry.addEventListener("click", loadGoogle);
