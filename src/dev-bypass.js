// dev-bypass.js
(function () {
  // Make it obvious in the console that the bypass ran
  console.log("[dev-bypass] loaded early");

  // Tag the window so app code can detect local dev
  window.__LOCAL_DEV__ = true;

  // 1) Kill any redirect to base44 login
  const origReplace = window.location.replace.bind(window.location);
  const origAssign  = window.location.assign.bind(window.location);
  window.location.replace = (url) => {
    if (typeof url === "string" && url.includes("base44.app/login")) {
      console.warn("[dev-bypass] blocked location.replace to:", url);
      return;
    }
    return origReplace(url);
  };
  window.location.assign = (url) => {
    if (typeof url === "string" && url.includes("base44.app/login")) {
      console.warn("[dev-bypass] blocked location.assign to:", url);
      return;
    }
    return origAssign(url);
  };

  // 2) Stub the base44 login-info call so any code that tries it won’t explode
  const B44 = "app.base44.com/api/apps/public/login-info/by-id";
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = (typeof input === "string" ? input : (input && input.url)) || "";
    if (url.includes(B44)) {
      console.warn("[dev-bypass] intercepting login-info fetch:", url);
      const mock = { ok: true, status: 200, json: async () => ({ ok: true, local: true }) };
      return new Response(JSON.stringify(await mock.json()), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return origFetch(input, init);
  };
})();
