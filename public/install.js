// Capture the browser's one-use install event before React hydrates.
(function () {
  if (window.__kinoPwa) return;
  var state = window.__kinoPwa = { prompt: null, installed: false, prompting: false };
  function changed() { window.dispatchEvent(new Event('kino-install-change')); }
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    state.installed = false;
    state.prompt = event;
    changed();
  });
  window.addEventListener('appinstalled', function () {
    state.installed = true;
    state.prompt = null;
    changed();
  });

  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
      }).catch(function () {});
      if ('caches' in window) caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (key) { return key.startsWith('mgldrama-'); }).map(function (key) { return caches.delete(key); }));
      }).catch(function () {});
      return;
    }
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function () {});
  }
  if (document.readyState === 'complete') registerWorker();
  else window.addEventListener('load', registerWorker, { once: true });
})();
