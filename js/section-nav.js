/*
 * section-nav.js — auto-builds an "on this page" scrollspy rail from the
 * page's own <section> headings. Language-neutral: labels come from each
 * page's headings, so localized pages get localized labels for free.
 * Self-gating: renders nothing unless the page has 3+ qualifying sections,
 * so it is safe to include on every page.
 */
(function () {
  "use strict";

  var MIN_SECTIONS = 3;
  var MAX_LABEL = 26;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function isVisible(el) {
    if (el.hasAttribute("hidden")) return false;
    var s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    return el.getBoundingClientRect().height > 40;
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9À-￿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function labelFor(heading) {
    var text = (heading.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > MAX_LABEL) text = text.slice(0, MAX_LABEL - 1).trim() + "…";
    return text;
  }

  ready(function () {
    var sections = Array.prototype.slice.call(document.querySelectorAll("section"));
    var used = {};
    var entries = [];

    sections.forEach(function (sec) {
      // Only top-level content sections (skip sections nested inside another section).
      if (sec.parentElement && sec.parentElement.closest("section")) return;
      var heading = sec.querySelector("h2, h1");
      if (!heading) return;
      if (!isVisible(sec)) return;

      var label = labelFor(heading);
      if (!label) return;

      var id = sec.id;
      if (!id) {
        id = slugify(label) || "section";
        var base = id, n = 2;
        while (document.getElementById(id) || used[id]) { id = base + "-" + n++; }
        sec.id = id;
      }
      used[id] = true;
      entries.push({ id: id, label: label, el: sec });
    });

    if (entries.length < MIN_SECTIONS) return;

    var nav = document.createElement("nav");
    nav.className = "section-rail";
    nav.setAttribute("aria-label", "On this page");

    var list = document.createElement("ul");
    entries.forEach(function (e) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + e.id;
      a.textContent = e.label;
      a.setAttribute("data-target", e.id);
      li.appendChild(a);
      list.appendChild(li);
      e.link = a;
      // Keep anchored sections clear of the sticky top bar.
      if (!e.el.style.scrollMarginTop) e.el.style.scrollMarginTop = "90px";
    });
    nav.appendChild(list);
    document.body.appendChild(nav);

    function setActive(id) {
      entries.forEach(function (e) {
        var on = e.id === id;
        e.link.classList.toggle("active", on);
        if (on) { e.link.setAttribute("aria-current", "true"); }
        else { e.link.removeAttribute("aria-current"); }
      });
    }

    if ("IntersectionObserver" in window) {
      var visible = {};
      var io = new IntersectionObserver(function (recs) {
        recs.forEach(function (r) {
          if (r.isIntersecting) visible[r.target.id] = r.intersectionRatio;
          else delete visible[r.target.id];
        });
        var best = null, bestRatio = -1;
        entries.forEach(function (e) {
          if (visible[e.id] != null && visible[e.id] > bestRatio) {
            bestRatio = visible[e.id]; best = e.id;
          }
        });
        if (best) setActive(best);
      }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.5, 1] });
      entries.forEach(function (e) { io.observe(e.el); });
    }

    setActive(entries[0].id);
  });
})();
