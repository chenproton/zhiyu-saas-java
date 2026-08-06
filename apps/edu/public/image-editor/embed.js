(function () {
  var base = '/image-editor'; // vendored 2026-08-05, base rewritten to same-origin for offline self-hosting
  // The current release. Version-less and 'latest' callers load this; pinned
  // callers fall forward to it when their pin isn't published. The image
  // editor is a standalone product on its own release cadence — callers that
  // need a specific build (e.g. the email builder) pin one explicitly via
  // createEditor({ version }).
  var latestVersion = '2.2.0';
  var loadPromise = null;

  function implReady() {
    return !!(
      window.__ImageEditorImpl__ &&
      typeof window.__ImageEditorImpl__.createEditor === 'function'
    );
  }

  // Load a versioned bundle. Point asset resolution at it BEFORE it evaluates:
  // the bundle captures window.ImageEditor.baseUrl during its own evaluation,
  // which happens before onload fires. A 404'd script never evaluates, so a
  // later inject re-assigns safely. A corrupt-but-HTTP-200 body fires onload
  // without registering the impl, so success is "the impl registered", not
  // "the script tag loaded".
  function inject(version) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = base + '/' + version + '/editor.js';
      window.ImageEditor.baseUrl = base + '/' + version;
      s.onload = function () {
        if (!implReady()) {
          s.remove();
          reject(new Error('impl-not-registered@' + version));
          return;
        }
        window.dispatchEvent(new Event('image-editor-ready'));
        resolve();
      };
      s.onerror = function () {
        s.remove();
        reject(new Error('load-failed@' + version));
      };
      document.head.appendChild(s);
    });
  }

  function load(opts) {
    if (loadPromise) return loadPromise;
    if (implReady()) {
      loadPromise = Promise.resolve();
      return loadPromise;
    }

    var requested = (opts && opts.version) || 'latest';
    var version = requested === 'latest' ? latestVersion : requested;

    loadPromise = inject(version)
      .catch(function (err) {
        // A pinned version may be unpublished (or corrupt) — fall forward to
        // the latest bundle instead of failing the caller on a stale pin.
        if (version !== latestVersion) {
          // This file ships raw to browsers: keep it free of trailing commas
          // in call args (the only non-ES5 syntax it would contain).
          // prettier-ignore
          console.warn(
            '[image-editor] version ' +
              version +
              ' unavailable; falling back to latest ' +
              latestVersion
          );
          return inject(latestVersion);
        }
        throw err;
      })
      .catch(function (err) {
        // Don't memoize failure: a transient CDN blip shouldn't kill the
        // image editor for the whole page session — let a reopen retry.
        loadPromise = null;
        throw err;
      });
    return loadPromise;
  }

  function createEditor(opts) {
    return load(opts).then(function () {
      return window.__ImageEditorImpl__.createEditor(opts);
    });
  }

  window.ImageEditor = {
    load: load,
    createEditor: createEditor,
    baseUrl: base + '/' + latestVersion,
  };
})();
