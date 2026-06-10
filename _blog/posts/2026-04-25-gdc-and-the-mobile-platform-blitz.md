---
title: "Looking Back at GDC and the Mobile Platform Blitz"
date: 2026-04-25
author: RakuAI Team
tags: [gdc, ios, android, demos, spatial-audio, weekend-build]
description: "Late March 2026 was the GDC eve release and a two-platform mobile push that landed in the same week. Here is what shipped, what broke forty-eight hours before I flew out, and which fixes look small on the diff but kept the laptop demo from going sideways in front of strangers. This is what shipping a spatial runtime at conference speed actually looks like."
series: learning-to-code-with-ai
slug: gdc-and-the-mobile-platform-blitz
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="GDC demo build plus iOS and Android mobile platform launch sharing one C API" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gdc-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="gdc-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#gdc-bg)"/>
  <text x="600" y="64" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">One C API, Every Surface</text>
  <text x="600" y="100" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">GDC demo build, iOS and Android shipped the same week</text>
  <g font-family="system-ui,sans-serif" text-anchor="middle">
    <ellipse cx="600" cy="240" rx="120" ry="56" fill="#1a1a33" stroke="url(#gdc-accent)" stroke-width="3"/>
    <text x="600" y="235" fill="#a388ff" font-size="20" font-weight="700">RakuAI C API</text>
    <text x="600" y="260" fill="#9090b0" font-size="14">touch / audio / GPU / assets</text>
    <g font-size="15" fill="#c8c8e0">
      <rect x="120" y="180" width="180" height="60" rx="12" fill="#16213a" stroke="#00cec9" stroke-width="2"/><text x="210" y="216">iOS · Metal</text>
      <rect x="120" y="270" width="180" height="60" rx="12" fill="#16213a" stroke="#00cec9" stroke-width="2"/><text x="210" y="306">Android · Oboe</text>
      <rect x="900" y="180" width="180" height="60" rx="12" fill="#1a1a33" stroke="#6c5ce7" stroke-width="2"/><text x="990" y="216">Desktop demo</text>
      <rect x="900" y="270" width="180" height="60" rx="12" fill="#1a1a33" stroke="#6c5ce7" stroke-width="2"/><text x="990" y="306">Browser fallback</text>
    </g>
    <line x1="300" y1="210" x2="480" y2="235" stroke="#00cec9" stroke-width="2"/>
    <line x1="300" y1="300" x2="480" y2="250" stroke="#00cec9" stroke-width="2"/>
    <line x1="720" y1="235" x2="900" y2="210" stroke="#6c5ce7" stroke-width="2"/>
    <line x1="720" y1="250" x2="900" y2="300" stroke="#6c5ce7" stroke-width="2"/>
  </g>
  <text x="600" y="410" text-anchor="middle" fill="#00cec9" font-family="system-ui,sans-serif" font-size="16" font-weight="600">Spatial audio: HRTF localization on every platform</text>
</svg>
<figcaption>Adding a platform is a known shape, not an open-ended architecture problem.</figcaption>
</figure>

<p class="post-hook">A real engine running real code beats any deck. RakuAI carried one to GDC, shipped two mobile platforms the same week, and proved that adding a new surface is a known shape — not a rewrite.</p>

GDC was a month ago. The flight back was full of notes. The conversations that started in the hallways and side meetings are still echoing through the inbox. Today is the right Saturday to write down what shipped in the run-up to the trip, what almost did not, and what came out of it.

GDC is the place where you find out, in three days of dense conversation, which of your assumptions hold and which were a guess that you had been treating as a fact. I came home with both kinds of answers and a longer list of people to follow up with than I expected.

## The release tag tells the story

The version that ran on the laptop I brought along is `v1.3.8.26.10.09`. The commit that bumped it had a one-line message: "GDC 2026 Eve Release." That was March 25. I was on a plane the next morning.

The eve-of-GDC commit is the one I want to write about, because it is the one that almost did not land.

## Forty-eight hours before I flew out

The build that everyone agreed was "the demo build" failed in four different ways the week before GDC. The fix commit is `b70a48dc` on March 7, pulled in a single PR titled "fix(demos): fix black screens, crashes, and expand API test coverage." The four ways:

**Black screens.** The animation showcase, the AI behavior test, the CSG boolean test, and the gameplay framework test all rendered black. The cause was a missing call to `raku_editor_init()` that the demos needed to register debug-draw resources. The CMake link targets had been refactored a sprint earlier and the editor library got pruned out of the demo binaries because nobody noticed they depended on it. Fix: re-add the link, restore the init call.

**A null crash.** The SLM dialogue demo crashed on startup with a null QA pointer. The dialogue model loader was returning early on a config-not-found path without flagging the error. Fix: surface the error, and ship a working config.

**A network demo that disconnected immediately.** The network echo demo opened a socket, got handshake, then closed. The disconnection detection was firing on the first idle frame instead of after a real timeout. Fix: actual timeout instead of "first idle."

**An XR test that exited 1 with no OpenXR runtime.** Exiting non-zero with no runtime present is the wrong default for a demo machine that may not have an XR runtime installed. Fix: exit 0 gracefully, log the absence.

None of those are clever. All of them are the kind of thing that looks fine on the developer's machine and looks broken on a stranger's machine. Forty-eight hours from a trip like this is exactly when those failures surface, because the demo finally gets run on the laptop it will actually live on for the next week, in front of people who will form an opinion in fifteen seconds.

## The polish commits I needed working in time

Two more March 26 commits, the day before I left.

**Ground plane specularity.** The world-model demo had a green ground plane and a few floating shapes. With a global specular material applied, the green ground was washing out to white under the demo lighting. The fix was ten lines: matte material on the ground plane, specular on the dynamic objects only. Suddenly the demo looked like a deliberate art direction instead of an engine in mid-debug.

**Forced NVIDIA dGPU on the conference laptop.** Hybrid laptops with both Intel UHD and a discrete NVIDIA card default to the Intel chip unless an explicit hint says otherwise. The hint is two exported symbols: `NvOptimusEnablement` for NVIDIA Optimus, `AmdPowerXpressRequestHighPerformance` for AMD's equivalent. Adding them to the demo binary forced the dGPU. The HUD now also prints the GPU name in the title bar, so I can see at a glance what the demo is actually running on. Result: ran on the Quadro T2000 instead of the integrated UHD. Frame time dropped by more than half.

Neither of those commits is more than fifty lines. Both of them are the difference between "the demo runs at thirty frames" and "the demo runs at ninety and looks intentional."

## The browser fallback that became the better show-and-tell

The other thing that landed in the GDC week was a standalone browser demo at `web/seed-explorer/`. A single HTML file, zero dependencies, JavaScript port of the Simplex noise terrain generator the runtime uses on the native side. It renders three views of a generated world to a 512x512 canvas using `putImageData`: biome map, height map, temperature map. There is a `raku://seed/` URL scheme baked in so a seed is shareable.

This was supposed to be a backup in case the laptop flaked or the wifi at the venue was a mess. It became the thing I actually opened most often in side conversations. Someone else's laptop on a coffee-shop table cannot install our SDK on the spot, but it can load a URL. The conversation goes from "send me the binaries" to "open this link." That is a different kind of conversation. The browser demo is staying in the rotation.

## The mobile platform blitz

The other half of March was iOS and Android, both shipped in the same week.

**Android.** Twelve commits in the F1 series (F1.2 through F1.15), starting with the NativeActivity and JNI bridge scaffold and ending with the Android performance profiler. In between: touch input wired through JNI, GitHub Actions workflow for AAB builds, Firebase Crashlytics integration, and Oboe activated as the audio backend. Oboe is the right choice for low-latency audio on Android. The C API wrapper around it lets the same audio callbacks work cross-platform.

**iOS.** Seven commits in the F2 series (F2.1 through F2.7) over two days. Started with the Xcode project and Swift app shell. Added an arm64 cross-compilation toolchain. Wired Metal as the renderer (the F2.2 commit message reads "iOS Metal renderer integration, glue layer, CMake toolchain, 51 tests" and the test count is the part I am proudest of). Added gesture input through `UIGestureRecognizer`. Built the spatial audio backend on top of `AVAudioEngine`. Wired asset bundle download and caching through `URLSession`.

Both platforms got the same shape: a thin native layer that exposes touch, audio, GPU, and asset delivery to the same C API the desktop runtime uses. That is the contract. The platform-specific code is the implementation. Adding a new platform from here is a known shape, not an open-ended architecture problem.

## Spatial audio is the underrated win

The piece of work I keep getting questions about is spatial audio. The header is at `include/raku/raku_spatial_audio.h`. The implementation is split between platforms: HRTF processing for spatial localization, mixer groups for per-channel control, effects (reverb, delay), and reverb zones for room acoustics. On Android the audio path is Oboe. On iOS it is `AVAudioEngine`. The spatial-audio commit is `e0aef6c6` from March 6.

The reason this matters for an AR engine is that audio is half of presence. Visual AR with stereo (or worse, mono) audio breaks immersion the moment the user turns their head. Spatial audio that updates as the user moves makes the virtual content feel like it is in the room. The cost is real: HRTF processing is not free. The benefit is also real: nobody has ever come back from a good spatial-audio demo wanting it disabled.

## What GDC actually moved

Three things worth writing down.

**Partner conversations.** The hallway conversations and the side meetings are the ones that are now landing on the calendar. The conference talks were excellent. The conversations between the talks were the reason the trip paid for itself. When I write specifically about partner directions on a future Saturday, those threads will be the substance.

**A clearer read on where the field is.** There were sessions on world models, on AI-driven content pipelines, on the gap between research demos and shippable runtimes, on the spatial-AR hardware roadmap from a few different vendors. Some of what I assumed about the competitive landscape was correct. A few things I had been quietly worrying about turned out to be less of a threat than I thought. A few things I had not been worrying about turned out to deserve more attention. That recalibration alone was worth the flight.

**Permission to keep going.** GDC was a forcing function. The demo I carried around was not perfect. It was specific, it was a real engine running real code, and it answered a different category of question than a deck. The number of "send me a follow-up email" responses was high enough to confirm the direction is the right one. That is the metric.

The mobile platforms shipped. The demos I showed worked. The browser fallback turned into a feature. Saturday well used.

<div class="post-cta">
<h3>The runtime built for the device on your face</h3>
<p>One C API, spatial audio everywhere, and a thermal-aware runtime engineered for smart glasses — not a PC engine squeezed down to fit. See where your AI lives in the real world.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/smart-glasses.html">For Smart Glasses</a>
<a class="cta-btn cta-secondary" href="/developers/">For Developers</a>
</div>
</div>
