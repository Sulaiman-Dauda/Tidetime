/*!
 * Tidetime embed SDK — lightweight, dependency-free booking widget loader.
 *
 * Features: inline embeds that auto-resize, modal popups, a floating button,
 * and prerendering so popups open instantly (the iframe is warmed in the
 * background and revealed on click).
 *
 * Usage (inline, auto-resizing):
 *   <div data-tidetime-inline="https://app.tidetime.com/jane/intro"></div>
 *   <script src="https://app.tidetime.com/embed.js" async></script>
 *
 * Usage (popup trigger with prerender-on-hover):
 *   <button data-tidetime-url="https://app.tidetime.com/jane/intro">Book</button>
 *   <script src="https://app.tidetime.com/embed.js" async></script>
 *
 * Programmatic:
 *   Tidetime('inline', { target: '#el', url: '…' });
 *   Tidetime('prerender', { url: '…' });           // warm the popup frame
 *   Tidetime('popup', { url: '…' });               // open (instant if warmed)
 *   Tidetime('floatingButton', { url: '…', text: 'Book a call' });
 *   Tidetime('config', { theme: 'dark' });        // match your site's theme
 *   Tidetime('on', { event: 'bookingSuccessful', handler: function (d) {} });
 *
 * Lifecycle / events you can subscribe to via Tidetime('on', …):
 *   - 'frameLoaded'        the iframe document loaded (coarse)
 *   - 'ready'              the in-frame app mounted + handshake completed
 *   - 'bookingSuccessful'  a booking was confirmed (popup auto-closes after)
 *   - 'linkFailed'         the iframe failed to load
 *
 * Handshake: the frame broadcasts `tidetime:ready` (v:1) on a retry loop until
 * the SDK replies `tidetime:ack` + `tidetime:connect` (carrying theme config).
 * This survives the race where a prerendered frame loads before this script does.
 */
(function () {
  "use strict";

  var STYLE_ID = "tidetime-embed-styles";
  var inlineFrames = [];
  var prerendered = {}; // key -> iframe (hidden, warmed)
  var listeners = {}; // event -> [handlers]
  var activeModal = null;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      ".tt-inline{width:100%;min-height:520px;border:0;border-radius:12px;overflow:hidden;transition:height .15s ease}" +
      ".tt-prerender{position:fixed;left:-99999px;top:0;width:920px;height:720px;border:0;visibility:hidden}" +
      ".tt-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:2147483000;opacity:0;transition:opacity .18s ease}" +
      ".tt-overlay.tt-open{opacity:1}" +
      ".tt-modal{position:relative;width:min(920px,94vw);height:min(720px,92vh);background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35)}" +
      ".tt-modal iframe{width:100%;height:100%;border:0;visibility:visible;position:static}" +
      ".tt-close{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:8px;background:rgba(15,23,42,.06);cursor:pointer;font-size:18px;line-height:1;color:#0f172a;z-index:2}" +
      ".tt-close:hover{background:rgba(15,23,42,.12)}" +
      ".tt-fab{position:fixed;bottom:20px;right:20px;z-index:2147482000;background:#0f172a;color:#fff;border:0;border-radius:999px;padding:12px 20px;font:600 14px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}" +
      ".tt-fab:hover{background:#1e293b}";
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  var PROTOCOL_VERSION = 1;
  var config = { theme: null }; // host-supplied defaults (e.g. Tidetime('init',{theme:'dark'}))

  function withEmbedParam(url) {
    try {
      var u = new URL(url, window.location.href);
      u.searchParams.set("embed", "1");
      if (config.theme) u.searchParams.set("theme", config.theme);
      return u.toString();
    } catch (e) {
      return url + (url.indexOf("?") === -1 ? "?" : "&") + "embed=1";
    }
  }

  function makeFrame(url) {
    var frame = document.createElement("iframe");
    frame.src = withEmbedParam(url);
    // Remember the frame's origin so we can validate inbound postMessages came
    // from the Tidetime frame and not a spoofing page/frame on the host site.
    try {
      frame._ttOrigin = new URL(url, window.location.href).origin;
    } catch (e) {
      frame._ttOrigin = null;
    }
    frame.setAttribute("title", "Tidetime booking");
    frame.allow = "payment";
    frame._ttState = "loading"; // loading -> ready (after handshake)
    frame.addEventListener("load", function () {
      // The page document loaded; the in-frame bridge will follow up with a
      // namespaced 'tidetime:ready' once React mounts. Surface a coarse signal.
      emit("frameLoaded", { url: url });
    });
    frame.addEventListener("error", function () {
      frame._ttState = "error";
      emit("linkFailed", { url: url });
    });
    return frame;
  }

  // Complete the handshake with a frame: acknowledge readiness + push config.
  function ackFrame(source) {
    try {
      source.postMessage({ type: "tidetime:ack", v: PROTOCOL_VERSION }, "*");
      source.postMessage({ type: "tidetime:connect", v: PROTOCOL_VERSION, theme: config.theme }, "*");
    } catch (e) {
      /* cross-origin — ignore */
    }
  }

  function frameForSource(source) {
    for (var i = 0; i < inlineFrames.length; i++) {
      if (inlineFrames[i].contentWindow === source) return inlineFrames[i];
    }
    for (var k in prerendered) {
      if (prerendered[k] && prerendered[k].contentWindow === source) return prerendered[k];
    }
    if (activeModal) {
      var f = activeModal.querySelector("iframe");
      if (f && f.contentWindow === source) return f;
    }
    return null;
  }

  function emit(event, data) {
    var hs = listeners[event] || [];
    for (var i = 0; i < hs.length; i++) {
      try {
        hs[i](data);
      } catch (e) {
        /* ignore handler errors */
      }
    }
  }

  /* ---- inline -------------------------------------------------------------- */

  function renderInline(target, url) {
    injectStyles();
    var frame = makeFrame(url);
    frame.className = "tt-inline";
    target.innerHTML = "";
    target.appendChild(frame);
    inlineFrames.push(frame);
  }

  /* ---- prerender + popup --------------------------------------------------- */

  function prerender(url) {
    injectStyles();
    var key = withEmbedParam(url);
    if (prerendered[key]) return prerendered[key];
    var frame = makeFrame(url);
    frame.className = "tt-prerender";
    document.body.appendChild(frame);
    prerendered[key] = frame;
    return frame;
  }

  function openPopup(url) {
    injectStyles();
    var key = withEmbedParam(url);
    var frame = prerendered[key];
    if (frame) {
      delete prerendered[key];
    } else {
      frame = makeFrame(url);
    }
    frame.className = "";

    var overlay = document.createElement("div");
    overlay.className = "tt-overlay";
    var modal = document.createElement("div");
    modal.className = "tt-modal";
    var close = document.createElement("button");
    close.className = "tt-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "&times;";

    modal.appendChild(frame);
    modal.appendChild(close);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add("tt-open");
    });
    activeModal = overlay;

    function dismiss() {
      if (overlay._dismissed) return;
      overlay._dismissed = true;
      overlay.classList.remove("tt-open");
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
      if (activeModal === overlay) activeModal = null;
      document.removeEventListener("keydown", onKey);
      // Warm a fresh frame for the next open.
      prerender(url);
    }
    function onKey(e) {
      if (e.key === "Escape") dismiss();
    }
    close.addEventListener("click", dismiss);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) dismiss();
    });
    document.addEventListener("keydown", onKey);
    overlay._dismiss = dismiss;
  }

  function closeActiveModal() {
    if (activeModal && activeModal._dismiss) activeModal._dismiss();
  }

  /* ---- triggers ------------------------------------------------------------ */

  function addFloatingButton(opts) {
    injectStyles();
    prerender(opts.url);
    var btn = document.createElement("button");
    btn.className = "tt-fab";
    btn.textContent = (opts && opts.text) || "Book a time";
    btn.addEventListener("mouseenter", function () {
      prerender(opts.url);
    });
    btn.addEventListener("click", function () {
      openPopup(opts.url);
    });
    document.body.appendChild(btn);
    return btn;
  }

  function scan() {
    injectStyles();
    var inlines = document.querySelectorAll("[data-tidetime-inline]");
    for (var i = 0; i < inlines.length; i++) {
      var url = inlines[i].getAttribute("data-tidetime-inline");
      if (url && !inlines[i]._ttBound) {
        inlines[i]._ttBound = true;
        renderInline(inlines[i], url);
      }
    }
    var triggers = document.querySelectorAll("[data-tidetime-url]");
    for (var j = 0; j < triggers.length; j++) {
      (function (node) {
        if (node._ttBound) return;
        node._ttBound = true;
        var turl = node.getAttribute("data-tidetime-url");
        node.addEventListener("mouseenter", function () {
          prerender(turl);
        });
        node.addEventListener("click", function (e) {
          e.preventDefault();
          openPopup(turl);
        });
      })(triggers[j]);
    }
  }

  /* ---- host <-> frame messaging ------------------------------------------- */

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object") return;
    // Only trust messages that originate from a frame we created, and whose
    // origin matches that frame's origin. This stops any other page/frame from
    // spoofing booking/ready/resize events to the host's callbacks.
    var frame = frameForSource(e.source);
    if (!frame || (frame._ttOrigin && e.origin !== frame._ttOrigin)) return;

    if (d.type === "tidetime:resize" && typeof d.height === "number") {
      if (inlineFrames.indexOf(frame) !== -1) {
        frame.style.height = Math.max(d.height, 200) + "px";
      }
    } else if (d.type === "tidetime:bookingSuccessful") {
      emit("bookingSuccessful", d);
      // Give the host callback a beat, then close the modal.
      setTimeout(closeActiveModal, 300);
    } else if (d.type === "tidetime:ready") {
      // Complete the handshake (idempotent — the frame retries until acked) and
      // mark the frame ready so consumers know it's interactive.
      if (e.source) ackFrame(e.source);
      if (frame._ttState === "ready") return; // already announced
      frame._ttState = "ready";
      emit("ready", d);
    }
  });

  /* ---- public API ---------------------------------------------------------- */

  function api(action, opts) {
    opts = opts || {};
    switch (action) {
      case "init":
        if (opts.theme === "dark" || opts.theme === "light") config.theme = opts.theme;
        scan();
        break;
      case "config":
        if (opts.theme === "dark" || opts.theme === "light") config.theme = opts.theme;
        break;
      case "inline":
        if (opts.target && opts.url) {
          var el =
            typeof opts.target === "string"
              ? document.querySelector(opts.target)
              : opts.target;
          if (el) renderInline(el, opts.url);
        }
        break;
      case "prerender":
        if (opts.url) prerender(opts.url);
        break;
      case "popup":
      case "modal":
        if (opts.url) openPopup(opts.url);
        break;
      case "floatingButton":
        if (opts.url) addFloatingButton(opts);
        break;
      case "on":
        if (opts.event && typeof opts.handler === "function") {
          (listeners[opts.event] = listeners[opts.event] || []).push(opts.handler);
        }
        break;
      default:
        break;
    }
  }

  // Drain any calls queued before the script loaded.
  var existing = window.Tidetime;
  window.Tidetime = api;
  if (existing && existing.q && existing.q.length) {
    for (var k = 0; k < existing.q.length; k++) {
      api.apply(null, existing.q[k]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
