/*!
 * Tidetime embed SDK — lightweight, dependency-free booking widget loader.
 *
 * Usage (inline):
 *   <div data-tidetime-inline="https://app.tidetime.com/jane/intro"></div>
 *   <script src="https://app.tidetime.com/embed.js" async></script>
 *
 * Usage (popup / floating button), programmatic:
 *   <script src="https://app.tidetime.com/embed.js" async></script>
 *   <script>
 *     Tidetime('init');
 *     Tidetime('popup', { url: 'https://app.tidetime.com/jane/intro' });
 *     Tidetime('floatingButton', { url: 'https://app.tidetime.com/jane/intro', text: 'Book a call' });
 *   </script>
 */
(function () {
  "use strict";

  var STYLE_ID = "tidetime-embed-styles";
  var FRAME_QS = "embed=1";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      ".tt-inline{width:100%;min-height:640px;border:0;border-radius:12px;overflow:hidden}" +
      ".tt-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:2147483000;opacity:0;transition:opacity .18s ease}" +
      ".tt-overlay.tt-open{opacity:1}" +
      ".tt-modal{position:relative;width:min(920px,94vw);height:min(720px,92vh);background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35)}" +
      ".tt-modal iframe{width:100%;height:100%;border:0}" +
      ".tt-close{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:8px;background:rgba(15,23,42,.06);cursor:pointer;font-size:18px;line-height:1;color:#0f172a}" +
      ".tt-close:hover{background:rgba(15,23,42,.12)}" +
      ".tt-fab{position:fixed;bottom:20px;right:20px;z-index:2147482000;background:#0f172a;color:#fff;border:0;border-radius:999px;padding:12px 20px;font:600 14px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}" +
      ".tt-fab:hover{background:#1e293b}";
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function withEmbedParam(url) {
    try {
      var u = new URL(url, window.location.href);
      u.searchParams.set("embed", "1");
      return u.toString();
    } catch (e) {
      return url + (url.indexOf("?") === -1 ? "?" : "&") + FRAME_QS;
    }
  }

  function makeFrame(url) {
    var frame = document.createElement("iframe");
    frame.src = withEmbedParam(url);
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("title", "Tidetime booking");
    frame.allow = "payment";
    return frame;
  }

  function renderInline(target, url) {
    var frame = makeFrame(url);
    frame.className = "tt-inline";
    target.innerHTML = "";
    target.appendChild(frame);
  }

  function openPopup(url) {
    injectStyles();
    var overlay = document.createElement("div");
    overlay.className = "tt-overlay";

    var modal = document.createElement("div");
    modal.className = "tt-modal";

    var close = document.createElement("button");
    close.className = "tt-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "&times;";

    var frame = makeFrame(url);

    modal.appendChild(frame);
    modal.appendChild(close);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add("tt-open");
    });

    function dismiss() {
      overlay.classList.remove("tt-open");
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }
    close.addEventListener("click", dismiss);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) dismiss();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        dismiss();
        document.removeEventListener("keydown", onKey);
      }
    });
  }

  function addFloatingButton(opts) {
    injectStyles();
    var btn = document.createElement("button");
    btn.className = "tt-fab";
    btn.textContent = (opts && opts.text) || "Book a time";
    btn.addEventListener("click", function () {
      openPopup(opts.url);
    });
    document.body.appendChild(btn);
    return btn;
  }

  function scanInline() {
    injectStyles();
    var nodes = document.querySelectorAll("[data-tidetime-inline]");
    for (var i = 0; i < nodes.length; i++) {
      var url = nodes[i].getAttribute("data-tidetime-inline");
      if (url) renderInline(nodes[i], url);
    }
  }

  function api(action, opts) {
    switch (action) {
      case "init":
        scanInline();
        break;
      case "inline":
        if (opts && opts.target && opts.url) {
          var el =
            typeof opts.target === "string"
              ? document.querySelector(opts.target)
              : opts.target;
          if (el) renderInline(el, opts.url);
        }
        break;
      case "popup":
        if (opts && opts.url) openPopup(opts.url);
        break;
      case "floatingButton":
        if (opts && opts.url) addFloatingButton(opts);
        break;
      default:
        break;
    }
  }

  // Drain any queued calls made before the script loaded.
  var existing = window.Tidetime;
  window.Tidetime = api;
  if (existing && existing.q && existing.q.length) {
    for (var j = 0; j < existing.q.length; j++) {
      api.apply(null, existing.q[j]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanInline);
  } else {
    scanInline();
  }
})();
