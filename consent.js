/*
 * INSURO – Cookie Consent Manager
 * GDPR/ePrivacy compliant. Gates GA4, GTM and Meta Pixel behind explicit consent.
 *
 * REPLACE THE PLACEHOLDERS BELOW WITH YOUR ACTUAL IDS:
 */
(function () {
  'use strict';

  // ─────────── TODO: replace with your real tracking IDs ───────────
  var GA4_ID       = 'G-7B220SK91Q';       // Google Analytics 4 Measurement ID
  var GTM_ID       = '';                   // Google Tag Manager Container ID (set '' to disable)
  var META_PIXEL_ID = '930728140053205';   // Meta (Facebook) Pixel ID (set '' to disable)
  // ─────────────────────────────────────────────────────────────────

  var STORAGE_KEY = 'insuro_cookie_consent';
  var STORAGE_VERSION = 1;

  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || c.version !== STORAGE_VERSION) return null;
      return c;
    } catch (e) { return null; }
  }

  function saveConsent(consent) {
    consent.timestamp = new Date().toISOString();
    consent.version = STORAGE_VERSION;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch (e) {}
    applyConsent(consent);
    hideBanner();
    hideModal();
  }

  function applyConsent(c) {
    // Update Google Consent Mode v2 (gtag already loaded in <head>)
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage:          c.marketing  ? 'granted' : 'denied',
        ad_user_data:        c.marketing  ? 'granted' : 'denied',
        ad_personalization:  c.marketing  ? 'granted' : 'denied',
        analytics_storage:   c.analytics  ? 'granted' : 'denied'
      });
    }

    if (c.analytics) {
      loadGA4();
      loadGTM();
    }
    if (c.marketing) {
      loadMetaPixel();
    }
  }

  function loadGA4() {
    if (window._insuro_ga4_loaded) return;
    if (!GA4_ID || GA4_ID.indexOf('XXXX') !== -1) return; // placeholder, skip
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { anonymize_ip: true });
    window._insuro_ga4_loaded = true;
  }

  function loadGTM() {
    if (window._insuro_gtm_loaded) return;
    if (!GTM_ID || GTM_ID.indexOf('XXXX') !== -1) return;
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GTM_ID);
    window._insuro_gtm_loaded = true;
  }

  function loadMetaPixel() {
    if (window._insuro_fbq_loaded) return;
    if (!META_PIXEL_ID || META_PIXEL_ID.indexOf('0000') === 0) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
    window._insuro_fbq_loaded = true;
  }

  // ──────────── UI ────────────
  var BANNER_HTML =
    '<div id="cc-banner" role="dialog" aria-live="polite" aria-label="Privolitev za piškotke" style="position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#0A2540;color:#fff;padding:18px 16px;box-shadow:0 -8px 30px rgba(0,0,0,.25);font-family:Inter,sans-serif;display:none">' +
      '<div style="max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:14px;justify-content:space-between">' +
        '<div style="flex:1 1 320px;min-width:0">' +
          '<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:15px;margin-bottom:4px">Piškotki na insuro.si</div>' +
          '<p style="font-size:13px;line-height:1.55;color:rgba(255,255,255,.78);margin:0">Uporabljamo piškotke za delovanje strani, analizo prometa in oglaševanje. Z izbiro &laquo;Sprejmi vse&raquo; soglašate z vsemi piškotki. Več v <a href="piskotki.html" style="color:#7ee3ae;text-decoration:underline">Politiki piškotkov</a>.</p>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
          '<button id="cc-settings" type="button" style="background:transparent;border:1px solid rgba(255,255,255,.3);color:#fff;padding:9px 16px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Nastavitve</button>' +
          '<button id="cc-reject" type="button" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#fff;padding:9px 16px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Zavrni neobvezne</button>' +
          '<button id="cc-accept" type="button" style="background:#0B6B4F;border:0;color:#fff;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Sprejmi vse</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  var MODAL_HTML =
    '<div id="cc-modal" role="dialog" aria-modal="true" aria-label="Nastavitve piškotkov" style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:16px;font-family:Inter,sans-serif">' +
      '<div style="background:#fff;color:#0A2540;max-width:520px;width:100%;max-height:88vh;overflow-y:auto;border-radius:18px;box-shadow:0 30px 60px rgba(0,0,0,.3)">' +
        '<div style="padding:22px 24px 14px;border-bottom:1px solid #e5e7eb;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">' +
          '<div>' +
            '<h2 style="font-family:Poppins,sans-serif;font-size:18px;font-weight:700;margin:0 0 4px;color:#0A2540">Nastavitve piškotkov</h2>' +
            '<p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5">Izberite, katere kategorije piškotkov dovolite. Izbiro lahko kadarkoli spremenite v nogi spletne strani.</p>' +
          '</div>' +
          '<button id="cc-close" type="button" aria-label="Zapri" style="background:#f3f4f6;border:0;width:32px;height:32px;border-radius:999px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div style="padding:18px 24px">' +
          renderCategory('necessary', 'Nujno potrebni', 'Omogočajo osnovno delovanje strani. Brez teh stran ne deluje pravilno.', true, true) +
          renderCategory('analytics', 'Analitika',     'Google Analytics 4 &mdash; razumevanje uporabe in izboljšava strani.', false, false) +
          renderCategory('marketing', 'Oglaševanje',   'Google Ads, Meta Pixel &mdash; merjenje uspešnosti oglasov in prilagojeni oglasi.', false, false) +
        '</div>' +
        '<div style="padding:14px 24px 22px;border-top:1px solid #e5e7eb;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end">' +
          '<button id="cc-modal-reject" type="button" style="background:#f3f4f6;border:0;color:#374151;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Zavrni neobvezne</button>' +
          '<button id="cc-modal-save" type="button" style="background:#0A2540;border:0;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Shrani izbiro</button>' +
          '<button id="cc-modal-accept" type="button" style="background:#0B6B4F;border:0;color:#fff;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Sprejmi vse</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  function renderCategory(id, label, desc, checked, disabled) {
    return (
      '<label style="display:flex;align-items:flex-start;gap:14px;padding:14px;border:1px solid #e5e7eb;border-radius:14px;margin-bottom:10px;cursor:' + (disabled ? 'not-allowed' : 'pointer') + '">' +
        '<input type="checkbox" id="cc-cat-' + id + '" ' + (checked ? 'checked' : '') + ' ' + (disabled ? 'disabled' : '') + ' style="margin-top:2px;width:18px;height:18px;accent-color:#0B6B4F;cursor:inherit">' +
        '<div style="flex:1">' +
          '<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:14px;color:#0A2540;margin-bottom:2px">' + label + (disabled ? ' <span style="font-size:11px;font-weight:500;color:#0B6B4F;background:#f0faf5;padding:2px 8px;border-radius:999px;margin-left:6px">vedno aktivno</span>' : '') + '</div>' +
          '<div style="font-size:12.5px;color:#6b7280;line-height:1.5">' + desc + '</div>' +
        '</div>' +
      '</label>'
    );
  }

  function injectUI() {
    var wrap = document.createElement('div');
    wrap.innerHTML = BANNER_HTML + MODAL_HTML;
    document.body.appendChild(wrap);

    document.getElementById('cc-accept').addEventListener('click', function () {
      saveConsent({ necessary: true, analytics: true, marketing: true });
    });
    document.getElementById('cc-reject').addEventListener('click', function () {
      saveConsent({ necessary: true, analytics: false, marketing: false });
    });
    document.getElementById('cc-settings').addEventListener('click', showModal);

    document.getElementById('cc-modal-accept').addEventListener('click', function () {
      saveConsent({ necessary: true, analytics: true, marketing: true });
    });
    document.getElementById('cc-modal-reject').addEventListener('click', function () {
      saveConsent({ necessary: true, analytics: false, marketing: false });
    });
    document.getElementById('cc-modal-save').addEventListener('click', function () {
      saveConsent({
        necessary: true,
        analytics: document.getElementById('cc-cat-analytics').checked,
        marketing: document.getElementById('cc-cat-marketing').checked
      });
    });
    document.getElementById('cc-close').addEventListener('click', hideModal);
  }

  function showBanner() { var b = document.getElementById('cc-banner'); if (b) b.style.display = 'block'; }
  function hideBanner() { var b = document.getElementById('cc-banner'); if (b) b.style.display = 'none'; }
  function showModal() {
    // sync checkboxes with stored consent
    var c = getConsent() || { analytics: false, marketing: false };
    var a = document.getElementById('cc-cat-analytics');
    var m = document.getElementById('cc-cat-marketing');
    if (a) a.checked = !!c.analytics;
    if (m) m.checked = !!c.marketing;
    var el = document.getElementById('cc-modal'); if (el) el.style.display = 'flex';
  }
  function hideModal() { var el = document.getElementById('cc-modal'); if (el) el.style.display = 'none'; }

  // Public API
  window.openCookieSettings = function () {
    if (!document.getElementById('cc-modal')) injectUI();
    showModal();
  };
  window.resetCookieConsent = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    location.reload();
  };

  // ───────── Init on DOM ready ─────────
  function init() {
    injectUI();
    var c = getConsent();
    if (c) {
      // Returning visitor — apply stored choice silently
      applyConsent(c);
    } else {
      // First visit — show banner (consent defaults are 'denied' via gtag init in <head>)
      showBanner();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
