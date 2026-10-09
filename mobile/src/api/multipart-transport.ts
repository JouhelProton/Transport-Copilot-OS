// React Native's XMLHttpRequest supports local URI attachments. Expo fetch's
// FormData converter only supports Blob/bytes entries and rejects URI objects.
export const multipartFetch: typeof fetch = (input, init = {}) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  const cleanup = () => init.signal?.removeEventListener("abort", abort);
  const abort = () => {
    xhr.abort();
    cleanup();
    const error = new Error("Request aborted");
    error.name = "AbortError";
    reject(error);
  };
  xhr.open(init.method ?? "POST", String(input));
  new Headers(init.headers).forEach((value, name) => xhr.setRequestHeader(name, value));
  xhr.onload = () => {
    cleanup();
    try {
    const headers = new Headers();
    for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
      const separator = line.indexOf(":");
      if (separator > 0) headers.append(line.slice(0, separator), line.slice(separator + 1).trim());
    }
    resolve(new Response(xhr.status === 204 ? null : xhr.responseText, { status: xhr.status, headers }));
    } catch (error) { reject(error); }
  };
  xhr.onerror = () => { cleanup(); reject(new TypeError("Network request failed")); };
  xhr.onabort = () => { cleanup(); const error = new Error("Request aborted"); error.name = "AbortError"; reject(error); };
  if (init.signal?.aborted) { abort(); return; }
  init.signal?.addEventListener("abort", abort, { once: true });
  try { xhr.send(init.body as XMLHttpRequestBodyInit); } catch (error) { cleanup(); reject(error); }
});
