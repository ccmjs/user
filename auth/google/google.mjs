/** Opens the hosted login page; only its matching window, origin and request may reply. */
export function login(app) {
  const url = new URL(app.google.url || "./google.html", import.meta.url);
  const request = crypto.randomUUID();
  url.hash = new URLSearchParams({ origin: location.origin, request }).toString();
  const popup = window.open(url.href, "_blank", "popup,width=520,height=680");
  if (!popup) return { promise: Promise.reject(new Error(app.labels.googlePopupBlocked)), cancel() {} };
  let cancel;
  const promise = new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, credential) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", receive);
      clearInterval(closed);
      clearTimeout(timeout);
      popup.close();
      error ? reject(error) : resolve(credential);
    };
    const receive = event => {
      if (event.origin !== url.origin || event.source !== popup || event.data?.request !== request) return;
      if (event.data.type === "ccm-google-ready") {
        popup.postMessage({ type: "ccm-google-init", request, server: app.url, labels: app.labels.googlePopup }, url.origin);
      } else if (event.data.type === "ccm-google-result" && typeof event.data.idToken === "string") {
        finish(null, { idToken: event.data.idToken });
      } else if (event.data.type === "ccm-google-cancel") {
        finish(new DOMException(app.labels.loginCancelled, "AbortError"));
      }
    };
    window.addEventListener("message", receive);
    const closed = setInterval(() => {
      if (popup.closed) finish(new DOMException(app.labels.loginCancelled, "AbortError"));
    }, 500);
    const timeout = setTimeout(() => finish(new Error(app.labels.googleTimeout)), 5 * 60 * 1000);
    cancel = () => finish(new DOMException(app.labels.loginCancelled, "AbortError"));
  });
  return { promise, cancel: () => cancel() };
}
