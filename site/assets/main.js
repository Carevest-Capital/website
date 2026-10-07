(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- sticky header shadow ---- */
  var header = document.querySelector(".site-header");
  var onScroll = function () {
    if (header) header.classList.toggle("is-stuck", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- mobile nav ---- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "×" : "≡";
    });
  }

  /* ---- reveal on scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); ro.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { ro.observe(el); });
  }

  /* ---- count up ---- */
  function formatNum(v, decimals) {
    return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function runCount(el) {
    var target = parseFloat(el.getAttribute("data-target"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce) { el.textContent = prefix + formatNum(target, decimals) + suffix; return; }
    var dur = 1400, start = null;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + formatNum(target * eased, decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + formatNum(target, decimals) + suffix;
    }
    requestAnimationFrame(tick);
  }
  var counters = document.querySelectorAll("[data-count]");
  if (!("IntersectionObserver" in window)) {
    counters.forEach(runCount);
  } else {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCount(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---- returns calculator ---- */
  var amt = document.getElementById("calcAmt");
  if (amt) {
    var amtLabel = document.getElementById("calcAmtLabel");
    var monthly = document.getElementById("calcMonthly");
    var yearly = document.getElementById("calcYear");
    var bars = document.getElementById("calcBars");
    var YIELD = (parseFloat(amt.getAttribute("data-yield")) || 7.75) / 100;
    var money = function (v) { return "$" + Math.round(v).toLocaleString("en-US"); };
    var updateCalc = function () {
      var v = parseFloat(amt.value);
      var perYear = v * YIELD;
      var perMonth = perYear / 12;
      if (amtLabel) amtLabel.textContent = money(v);
      if (monthly) monthly.textContent = money(perMonth);
      if (yearly) yearly.textContent = money(perYear);
      if (bars) {
        var pct = (v - 10000) / (1000000 - 10000);
        var kids = bars.children;
        for (var i = 0; i < kids.length; i++) {
          var base = 20 + (i / (kids.length - 1)) * 62;
          var h = base * (0.45 + pct * 0.55);
          kids[i].style.height = Math.max(8, Math.min(100, h)) + "%";
        }
      }
    };
    amt.addEventListener("input", updateCalc);
    updateCalc();
    var acctWrap = document.getElementById("calcAcct");
    if (acctWrap) {
      acctWrap.addEventListener("click", function (e) {
        var btn = e.target.closest(".calc__pill");
        if (!btn) return;
        Array.prototype.forEach.call(acctWrap.children, function (c) { c.classList.remove("is-on"); });
        btn.classList.add("is-on");
      });
    }
  }

  /* ---- FAQ / accordion ---- */
  document.querySelectorAll(".faq").forEach(function (faq) {
    faq.addEventListener("click", function (e) {
      var q = e.target.closest(".faq__q");
      if (!q) return;
      var open = q.getAttribute("aria-expanded") === "true";
      var panel = q.nextElementSibling;
      q.setAttribute("aria-expanded", open ? "false" : "true");
      panel.style.maxHeight = open ? "0px" : (panel.scrollHeight + 30) + "px";
    });
  });

  /* ---- team bio expand ---- */
  document.querySelectorAll(".person__more").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var bio = btn.parentElement.querySelector(".person__bio");
      if (!bio) return;
      var isHidden = bio.hasAttribute("hidden");
      if (isHidden) { bio.removeAttribute("hidden"); btn.textContent = "Read less"; }
      else { bio.setAttribute("hidden", ""); btn.textContent = "Read more"; }
    });
  });

  /* ---- forms: front-end only until a form backend is wired ---- */
  document.querySelectorAll("form[data-demo]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = form.querySelector(".form-confirm");
      if (msg) { msg.hidden = false; form.querySelectorAll("input, select, textarea, button").forEach(function (el) { el.disabled = true; }); }
    });
  });
})();
