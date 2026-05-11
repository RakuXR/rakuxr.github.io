---
title: "Looking Back at GDC and the Mobile Platform Blitz"
date: 2026-04-25
author: Kevin Griffin
tags: [gdc, ios, android, demos, spatial-audio, weekend-build]
description: "Late March 2026 was the GDC eve release and a two-platform mobile push that landed in the same week. Here is what shipped, what broke forty-eight hours before the booth opened, and which fixes look small on the diff but kept the demo from going sideways in front of strangers."
series: learning-to-code-with-ai
slug: gdc-and-the-mobile-platform-blitz
---

GDC was a month ago. The booth packed up. The demo machine came home. The conversations that started there are still echoing through the inbox. Today is the right Saturday to write down what shipped in the run-up to the show, what almost did not, and what came out of it.

## The release tag tells the story

The version that ran on the booth machine is `v1.3.8.26.10.09`. The commit that bumped it had a one-line message: "GDC 2026 Eve Release." That was March 25. The conference floor opened the next morning.

The eve-of-GDC commit is the one I want to write about, because it is the one that almost did not land.

## Forty-eight hours before the booth opened

The build that everyone agreed was "the demo build" failed in four different ways the week before GDC. The fix commit is `b70a48dc` on March 7, pulled in a single PR titled "fix(demos): fix black screens, crashes, and expand API test coverage." The four ways:

**Black screens.** The animation showcase, the AI behavior test, the CSG boolean test, and the gameplay framework test all rendered black. The cause was a missing call to `raku_editor_init()` that the demos needed to register debug-draw resources. The CMake link targets had been refactored a sprint earlier and the editor library got pruned out of the demo binaries because nobody noticed they depended on it. Fix: re-add the link, restore the init call.

**A null crash.** The SLM dialogue demo crashed on startup with a null QA pointer. The dialogue model loader was returning early on a config-not-found path without flagging the error. Fix: surface the error, and ship a working config.

**A network demo that disconnected immediately.** The network echo demo opened a socket, got handshake, then closed. The disconnection detection was firing on the first idle frame instead of after a real timeout. Fix: actual timeout instead of "first idle."

**An XR test that exited 1 with no OpenXR runtime.** Exiting non-zero with no runtime present is the wrong default for a demo machine that may not have an XR runtime installed. Fix: exit 0 gracefully, log the absence.

None of those are clever. All of them are the kind of thing that looks fine on the developer's machine and looks broken on a stranger's machine. Forty-eight hours from a conference is exactly when those failures surface, because the demo finally gets run on a machine that is not the one it was developed on.

## The polish commits the booth depended on

Two more March 26 commits, the day before doors opened.

**Ground plane specularity.** The world-model demo had a green ground plane and a few floating shapes. With a global specular material applied, the green ground was washing out to white under the demo lighting. The fix was ten lines: matte material on the ground plane, specular on the dynamic objects only. Suddenly the demo looked like a deliberate art direction instead of an engine in mid-debug.

**Forced NVIDIA dGPU on the booth machine.** Hybrid laptops with both Intel UHD and a discrete NVIDIA card default to the Intel chip unless an explicit hint says otherwise. The hint is two exported symbols: `NvOptimusEnablement` for NVIDIA Optimus, `AmdPowerXpressRequestHighPerformance` for AMD's equivalent. Adding them to the demo binary forced the dGPU. The HUD now also prints the GPU name in the title bar, so we can see at a glance what the demo is actually running on. Result: ran on the Quadro T2000 instead of the integrated UHD. Frame time dropped by more than half.

Neither of those commits is more than fifty lines. Both of them are the difference between "the demo runs at thirty frames" and "the demo runs at ninety and looks intentional."

## The browser fallback that almost stole the show

The other thing that landed in the GDC week was a standalone browser demo at `web/seed-explorer/`. A single HTML file, zero dependencies, JavaScript port of the Simplex noise terrain generator the runtime uses on the native side. It renders three views of a generated world to a 512x512 canvas using `putImageData`: biome map, height map, temperature map. There is a `raku://seed/` URL scheme baked in so a seed is shareable.

This was supposed to be a backup in case the booth machine flaked. It became one of the most useful things to put in front of partner conversations. A laptop that cannot install our SDK can still load a URL. The conversation goes from "send me the binaries" to "open this link." That is a different kind of conversation. The browser demo is staying in the demo rotation.

## The mobile platform blitz

The other half of March was iOS and Android, both shipped in the same week.

**Android.** Twelve commits in the F1 series (F1.2 through F1.15), starting with the NativeActivity and JNI bridge scaffold and ending with the Android performance profiler. In between: touch input wired through JNI, GitHub Actions workflow for AAB builds, Firebase Crashlytics integration, and Oboe activated as the audio backend. Oboe is the right choice for low-latency audio on Android. The C API wrapper around it lets the same audio callbacks work cross-platform.

**iOS.** Seven commits in the F2 series (F2.1 through F2.7) over two days. Started with the Xcode project and Swift app shell. Added an arm64 cross-compilation toolchain. Wired Metal as the renderer (the F2.2 commit message reads "iOS Metal renderer integration, glue layer, CMake toolchain, 51 tests" and the test count is the part I am proudest of). Added gesture input through `UIGestureRecognizer`. Built the spatial audio backend on top of `AVAudioEngine`. Wired asset bundle download and caching through `URLSession`.

Both platforms got the same shape: a thin native layer that exposes touch, audio, GPU, and asset delivery to the same C API the desktop runtime uses. That is the contract. The platform-specific code is the implementation. Adding a new platform from here is a known shape, not an open-ended architecture problem.

## Spatial audio is the underrated win

The piece of work I keep getting questions about is spatial audio. The header is at `include/raku/raku_spatial_audio.h`. The implementation is split between platforms: HRTF processing for spatial localization, mixer groups for per-channel control, effects (reverb, delay), and reverb zones for room acoustics. On Android the audio path is Oboe. On iOS it is `AVAudioEngine`. The spatial-audio commit is `e0aef6c6` from March 6.

The reason this matters for an AR engine is that audio is half of presence. Visual AR with stereo (or worse, mono) audio breaks immersion the moment the user turns their head. Spatial audio that updates as the user moves makes the virtual content feel like it is in the room. The cost is real: HRTF processing is not free. The benefit is also real: nobody has ever come back from a good spatial-audio demo wanting it disabled.

## What GDC actually moved

Two practical outcomes worth writing down.

**Partner conversations.** The conversations that came out of the booth are the ones that are now landing on the calendar. When I write specifically about partner directions on a future Saturday, those threads will be the substance.

**Permission to keep going.** The booth was a forcing function. The demo that ran there was not perfect. It was specific, it was a real engine running real code, and it answered a different category of question than a deck. That answer was good enough to fund another six months of building. That is the metric.

The mobile platforms shipped. The demo did not crash on stage. The browser fallback turned into a feature. Saturday well used.
