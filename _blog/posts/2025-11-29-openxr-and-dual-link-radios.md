---
title: "OpenXR Is the Skeleton, Dual-Link Radios Are the Nerve"
date: 2025-11-29
author: Kevin Griffin
tags: [openxr, rf-optical, ar-glasses, openxr-extensions, oss-standards, weekend-build]
description: "Woke up Saturday wanting to make a real bet on standards. By the end of the weekend the runtime had its OpenXR backbone (graphics binding, frame lifecycle, action sync) plus a dual-mode RF / optical link manager that lets the tether switch radios on the fly. Both bets are working."
series: learning-to-code-with-ai
slug: openxr-and-dual-link-radios
---

The temptation when you are building an engine for AR glasses is to build everything yourself. Build your own pose API. Build your own graphics binding. Build your own input model. Build your own controller abstractions. Each of those decisions is forty hours of agent work and another forty hours of human review. It compounds into a year of effort and an engine that nothing else in the ecosystem speaks the language of.

I am taking the other path. Where a standard exists that fits the use case, the engine adopts the standard. OpenXR is the headline example. This weekend the runtime grew the OpenXR backbone it has needed for two months.

## What landed on OpenXR

Most of the heavy lifting landed across the weekend:

- OpenXR graphics-API binding with session and swapchain management
- OpenXR frame lifecycle integration with device-lost handling
- OpenXR action synchronization and view-location operations
- OpenXR extension support for XR_FB_passthrough, XR_FB_foveation, and XR_EXT_hand_tracking
- OpenXR composition layer manager and action spaces

If you read those PR titles back to back they sound like a vendor-conformance checklist, which is what they are. The point is that any device on any hardware partner that ships an OpenXR-conformant runtime is now a viable target for Raku, because the parts of the engine that talk to the device speak the same protocol the device's runtime speaks.

The agents handled most of this work. The PRs that landed this weekend are unusually clean because OpenXR is a well-specified standard with a published header and a working test suite. The agent reads the header, reads the spec section, writes the implementation, runs the conformance tests, and the PR is either green or red without much ambiguity. That is exactly the kind of work autonomous coding agents are best at.

## The dual-mode RF / Optical link manager

The other big piece of this weekend is the dual-mode link manager. This is a Raku-specific thing rather than a standards thing.

The picture: AR glasses with an external compute tether. The tether is sometimes a phone, sometimes a beltpack, sometimes a desktop. The link between the glasses and the tether is Wi-Fi 7 today and may be free-space optical tomorrow on certain device targets. The runtime cannot assume one link technology. It has to be able to switch.

The link manager that landed this weekend handles that. The runtime opens both an RF link and (where supported) an optical link. It monitors latency and throughput on each. It moves traffic to whichever link is performing better and falls back to the other when one degrades. The switch is non-disruptive to the application above.

This is the kind of subsystem you cannot really retrofit. If you wait until the second link technology arrives to build the abstraction, you spend three months unwinding the assumptions that the first link technology snuck into every layer above it. We built the abstraction first. Now whichever link technology a hardware partner picks, the runtime is ready.

## OpenXR extensions and where they fall short

A specific note for OpenXR people reading this. The XR_FB_passthrough and XR_FB_foveation extensions we added support for this weekend are the right ones for the foveation and passthrough quality bar we want to hit, and the hand-tracking extension XR_EXT_hand_tracking is the right one for the cross-vendor hand-tracking interface.

What is missing from the extension set, and what we are building proprietary code for, is sub-millimeter anchoring (the calligraphy use case from earlier this fall), low-latency multiplayer pose-sync at the timescales we want, and the AI-runtime hooks that let the model layer participate in scene reasoning every frame. These are areas where OpenXR has not standardized yet, and our engine is shipping its own interfaces in the meantime. The intent is that when OpenXR catches up (and there is active work in the working group on some of these), we adopt the standard and deprecate our own.

That is the pattern I want the engine to maintain. Adopt where standards exist. Build where they do not. Be ready to adopt where they catch up.

## Telemetry and stub completeness

A quieter thing landed this weekend: structured JSON / OTLP logging with OpenTelemetry integration. This is the kind of plumbing that does not get its own announcement, but it is what lets us answer the question "where is the latency budget going" without instrumenting the code by hand every time. The telemetry pipeline is wired through to every subsystem now, and the dashboards Phase 1 is producing are real.

Also this weekend: a documentation PR that took a hard look at the stub implementations in the codebase and classified each one as either "actually a useful test utility" or "actually a hole." The useful ones got renamed and documented. The holes got tracked. The agents wrote and landed that classification work themselves. It is a small thing. It is also the kind of small thing that, neglected for too long, turns into a serious mess.

## What I want builders and partners to take from this

If you are an OpenXR working-group person, this engine is being built as a good citizen of the standard. We adopt extensions where they fit. We file conformance bugs when our implementation finds them. We will publish what we have built where standards have not caught up yet, and we would rather standardize than maintain a fork.

If you are a hardware partner whose device is OpenXR-conformant, the engine is closer to running on your device this weekend than it was last weekend. The remaining work is vendor-specific glue. We are happy to do that work together.

If you are working on the next-generation link technology between glasses and tether (Wi-Fi 7+, free-space optical, mmWave, anything), the link-manager abstraction is the layer to plug into. The runtime above does not need to know which radio you are. The runtime below abstracts you.

Ninety-eight commits across the weekend. Engine grew a backbone and a nerve. Closing the laptop at the end of the weekend feels good.
