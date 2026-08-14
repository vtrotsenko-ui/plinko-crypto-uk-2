/**
 * Minimal cookie consent banner. Stores only a local preference flag
 * (localStorage) - no cookies are set by this script itself, and no
 * analytics/advertising scripts are loaded until (if ever) the visitor
 * accepts. See /privacy-cookie-policy/ for the full policy.
 */
(function () {
  "use strict";
  var STORAGE_KEY = "cookie-consent";

  function getConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* ignore - private browsing etc. */
    }
  }

  function init() {
    var banner = document.querySelector("[data-cookie-banner]");
    if (!banner) return;
    if (getConsent()) return;

    banner.classList.add("visible");
    var acceptBtn = banner.querySelector("[data-cookie-accept]");
    var rejectBtn = banner.querySelector("[data-cookie-reject]");

    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () {
        setConsent("accepted");
        banner.classList.remove("visible");
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener("click", function () {
        setConsent("rejected");
        banner.classList.remove("visible");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
