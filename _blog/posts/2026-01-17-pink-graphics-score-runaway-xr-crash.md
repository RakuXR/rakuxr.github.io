---
title: "Pink Graphics, Score Runaway, XR Crash. Four Bugs in One Saturday."
date: 2026-01-17
author: RakuAI Team
tags: [debugging, demo, shooter, shader-cache, weekend-build]
description: "Four unrelated bugs, zero overlapping subsystems, one Saturday. Pink missing-shader graphics. A score that double-counted. A hard XR-boot crash. A camera that refused to lock. This is the kind of integration failure that escapes every unit test — and the init-order, event-ownership, and boot-guardian discipline that turns a broken demo into a runtime partners can trust."
series: learning-to-code-with-ai
slug: pink-graphics-score-runaway-xr-crash
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Four unrelated demo bugs fixed in one Saturday: pink shaders, score runaway, XR crash, camera lock" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pink-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#pink-bg)"/>
  <text x="600" y="60" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Four Bugs, One Saturday</text>
  <text x="600" y="96" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Zero overlapping subsystems, one integration failure</text>
  <g font-family="system-ui,sans-serif" font-size="16">
    <rect x="100" y="150" width="460" height="120" rx="14" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="330" y="200" text-anchor="middle" fill="#e84393" font-size="22" font-weight="800">PINK OF DOOM</text>
    <text x="330" y="234" text-anchor="middle" fill="#9090b0">missing-shader fallback color</text>
    <rect x="640" y="150" width="460" height="120" rx="14" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="870" y="200" text-anchor="middle" fill="#ff7aa8" font-size="22" font-weight="800">SCORE x2</text>
    <text x="870" y="234" text-anchor="middle" fill="#9090b0">two subscribers, one event</text>
    <rect x="100" y="290" width="460" height="120" rx="14" fill="#1a1a33" stroke="#6c5ce7" stroke-width="2"/>
    <text x="330" y="340" text-anchor="middle" fill="#a388ff" font-size="22" font-weight="800">XR CRASH</text>
    <text x="330" y="374" text-anchor="middle" fill="#9090b0">init before device ready</text>
    <rect x="640" y="290" width="460" height="120" rx="14" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="870" y="340" text-anchor="middle" fill="#00cec9" font-size="22" font-weight="800">CAMERA LOST</text>
    <text x="870" y="374" text-anchor="middle" fill="#9090b0">race on async ship spawn</text>
  </g>
</svg>
<figcaption>Each subsystem worked alone. The integration is where demos live or die.</figcaption>
</figure>

<p class="post-hook">Four bugs in four subsystems that all pass their unit tests — that is the failure mode that ships broken demos. Catching it is the discipline that makes a sample you can actually run on RakuAI.</p>

There is a specific kind of Saturday that anyone who has shipped a demo knows. The demo worked at the end of last weekend. You picked it up this Saturday morning. It is now broken in four different ways and none of the ways are related to each other.

That was today. The demo was the Shooter game we ship as one of the canonical samples. The bugs were waiting like party guests nobody invited.

## What was broken

The demo booted. That was the good news. After that:

**The graphics were pink.** Anyone who has worked in a real-time renderer knows the pink-of-doom. It is the "missing shader" placeholder color, hot pink, screaming at you that something in the rendering pipeline failed to find the shader it expected. Every procedurally generated object in the demo was rendering in this color. Ships. Asteroids. Particles. All pink. Pink everywhere.

**The score ran away.** Every kill registered twice. The kill-counter went up in pairs. Twenty enemies down, "score: forty." Forty enemies down, "score: eighty." On paper it looks like the game was being kind, but in practice the leaderboard was inflated and the high-score logic was firing on completely wrong thresholds.

**XR boot crashed.** The demo on a flat screen booted clean. The moment I plugged in a headset and switched to XR mode, hard exit. No backtrace surfaced through the launcher. The renderer thread was gone before the launcher could grab a log.

**The camera would not lock onto the ship.** Standard third-person orbit camera, supposed to keep the ship in frame. On boot, the camera spawned at world origin and stayed there. The ship was visible across the void as a small dot in the distance.

Four bugs. Zero overlap in subsystems. The kind of Saturday morning that decides whether you have the workflow or not.

## What caused each

I want to talk through each one because each one teaches a different lesson about how a codebase grows and breaks in an agent-driven workflow.

### The pink graphics

Root cause: shader handles were being looked up by string name on every render call, and a refactor over the holiday had moved the shader-cache initialization to a different point in the boot sequence. The procedural generators were now rendering before the shader cache had warmed up. They were getting back the null-handle fallback, which the renderer dutifully rendered as hot pink.

The fix was to create an explicit `ShaderCache` utility that caches resolved shader references on first use and exposes a synchronous `GetOrCreate` API that the procedural generators can call without caring about boot order. Every procedural generator was updated to use it. Pink gone.

The lesson: an init-order assumption that lived implicitly in the boot sequence got broken by a refactor that did not flag the assumption. Implicit ordering is fragile. The new cache makes the ordering explicit and self-healing.

### The score runaway

Root cause: the `GameplayHUD` was tallying kills on the UI side, and `ScoreManager` was also tallying kills on the simulation side. Both were listening to the same kill-event signal. Both were adding to a shared score field. The score got incremented twice per kill.

The fix was to pick the canonical owner of the score. `ScoreManager` owns the truth. The `GameplayHUD` reads from `ScoreManager` and renders. The duplicate increment in the HUD was removed.

The lesson: in an event-driven engine, two subscribers to the same event will both run. If both write to the same state, the state will be wrong in proportion to how many subscribers wrote. The fix is to draw a clear line about who owns what state. Once drawn, the bug becomes impossible.

### The XR boot crash

Root cause: the XR subsystem was trying to initialize before the underlying graphics device was ready. On flat-screen boot, the order happened to work out because the graphics device was always ready by the time the user pressed "Start." On XR boot, the headset detection triggered the XR init path before the graphics device was confirmed ready. The XR subsystem dereferenced a null device handle. Crash.

The fix was an `XRBootstrap` that detects XR at the earliest possible point in boot, defers actual XR init until the graphics device confirms ready, and gracefully shuts down if anything in the chain reports a fault. The crash now becomes a clean error message and the user falls back to flat-screen.

The lesson: hard crashes are the worst kind of error because they kill the logging that would have told you what happened. Detecting the failure earlier and reporting it cleanly is worth the engineering cost.

### The camera that would not lock

Root cause: the orbit camera tries to target the player ship on boot. The ship is spawned by the procedural generator, asynchronously, a few frames after the camera initializes. The camera was looking for the ship on the very first frame, finding nothing, and then never trying again.

The fix was to give the orbit camera a retry mechanism. It looks for the ship for a bounded number of frames before giving up, and once it locks on, it stays locked. The camera now spawns at origin briefly, then snaps to the ship within the first second of gameplay.

The lesson: race conditions between systems that initialize on slightly different schedules will bite you. The fix is a small retry, bounded so it does not loop forever, with an explicit timeout that produces a useful error if the retry exhausts.

## What I learned about the Shooter demo specifically

Three things, all uncomfortable.

**Each subsystem was working in isolation. The integration was broken.** The renderer worked. The score system worked. The XR subsystem worked. The camera worked. The Shooter demo as an integrated experience did not work. This is the kind of failure that escapes unit tests every time, because unit tests by their nature exercise things in isolation.

**The holiday refactor over the late-December break was the proximate cause for at least two of these bugs.** The shader-cache reorganization and the kill-event subscription split both landed in the holiday-sprint window. Both were correct PRs in isolation. Both broke the demo in non-obvious ways. The lesson is to run the integrated demos as part of CI, not just the unit tests. That work landed this morning as a separate PR.

**The XR boot path needed its own boot guardian.** Hard crashes are unacceptable because they kill the diagnostic. Every boot path that touches non-trivial hardware needs a guardian. We have that now for XR. We do not have it for spatial audio or for the Wi-Fi 7 link. Adding both is on the queue for the next two Saturdays.

## What partners and builders should take from this

If you are building anything that integrates multiple subsystems with init-order dependencies, the lesson is the same one the Shooter demo just learned. Make the init order explicit. Make the failure modes graceful. Run the integrated demo in CI, not just the unit tests.

If you are an indie team thinking about adopting Raku, the Shooter demo is a real sample that we test against every release. If it breaks, you see it break. That is the kind of public-discipline signal that matters more than a feature list.

If you are an AI lab thinking about plugging your model into an AR experience, the XR boot path now has a defensible guardian. Your model will not see a hard crash on the way in. You will get clean error reporting if anything in the chain fails. The infrastructure is in place.

Four bugs. One Saturday. The demo builds clean now. The party guests have been escorted out.

Back to building.

<div class="post-cta">
<h3>Ship on a runtime that runs its own samples</h3>
<p>RakuAI tests its demos against every release with integration CI and graceful XR boot guardians. That is the public-discipline signal that matters more than a feature list. Start building on it.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/developers/">Start Building</a>
<a class="cta-btn cta-secondary" href="/creator.html">For Creators</a>
</div>
</div>
