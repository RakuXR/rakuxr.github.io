---
title: "The Weekend the Engine Grew Up"
date: 2025-12-27
author: Kevin Griffin
tags: [tflite, federated-sync, spatial-anchors, openxr, multi-repo, year-end, weekend-build]
description: "A 276-commit weekend that landed TensorFlow Lite for on-device SLM inference, AES-256-GCM federated sync, OpenXR composition layers, Kalman-filtered anchor stabilization, and a hardware-abstraction layer for the optical channel. The engine ends 2025 with the surface area of a real platform."
series: learning-to-code-with-ai
slug: the-week-the-engine-grew-up
---

There are weekends where a codebase moves forward, and there are weekends where a codebase changes category. The weekend between Christmas and New Year's was the second kind.

Two hundred seventy-six commits landed across the repos. The runtime grew the kind of surface area that turns a research project into a platform. Spatial anchors. OpenXR composition. On-device small-language-model inference. Federated sync with real crypto. Hardware abstraction for the optical communications channel. Most of it landed in parallel agent-authored PRs, reviewed and merged through the multi-vendor workflow that has been running for two months.

Saturday morning I sat down with coffee and a queue full of high-priority TODOs. By the end of the weekend I closed the laptop and looked at a different engine than the one I had opened yesterday. This is the post about what shipped, what it means, and why I think 2026 is the year other people start to take this engine seriously.

## The big landings

**TensorFlow Lite C API for SLM inference.** This is the one I am most excited about. The runtime can now load small language models in TFLite format and run inference against them as a first-class runtime operation. The motivation is straightforward: not every model needs to be a cloud round-trip. Some of the AI behaviors that drive an AR experience are tight, focused, and small enough to run on-device. The TFLite path gives us that. The cloud LLM path through the XRAssistantService gives us the other end. The engine now spans both.

**Spatial Anchors Complete (Epic #555).** Full spatial-anchor lifecycle: create, persist, share across devices, restore in a different session, expire. The persistence layer is cloud-backed through libcurl HTTP, with the encryption layer (AES-256-GCM, PBKDF2 key derivation) landing the same weekend. Anchors are first-class runtime objects now. An AR experience that needs to land a virtual object on the same kitchen counter today, tomorrow, and a month from now, across two different pairs of glasses owned by two different people, works.

**Kalman-filtered anchor pose stabilization.** A small thing that matters a lot. Anchor poses without filtering jitter just enough to feel wrong. Anchor poses with Kalman state-prediction filtering feel solid. The runtime now applies the filter automatically; applications above do not have to know.

**OpenXR composition layer manager and action spaces.** Continuing the OpenXR backbone work from November. The composition layer manager is what lets a single frame combine the camera passthrough, the user's virtual content, and any system overlays in the right order with the right blend modes. Foundational and easy to underestimate.

**Production AES-256-GCM encryption and UDP peer discovery for shared anchors.** This is what makes "share an anchor with a friend who is in the same room" actually safe to ship. The shared-anchor protocol uses authenticated encryption end-to-end. Peer discovery happens over UDP locally without going through a cloud round-trip. The privacy and latency story for shared-AR is real.

**Hardware abstraction layer for the optical channel (33 sensor TODOs resolved).** The optical link, when present on a device, is now a peer to the RF link. Both are abstracted behind the same dual-mode link manager that landed in November. The runtime above does not care which radio is on the wire.

**Federated sync wired through to real crypto.** The federated-sync subsystem was stub-driven for most of fall. This weekend it grew real implementations: HTTP transport, JSON envelope, crypto signature verification. AI/ML model updates can now be distributed to devices through the federated pathway safely.

**Vendor eye-SDK integration and token verification.** A handful of vendor-specific eye-tracking SDKs are now wired up behind the OpenXR provider interface, with proper token-based authentication for the vendor's licensing layer.

**GPU profiling instrumentation across the renderer (15 TODOs resolved).** Per-pass GPU timing, memory budgets, and pipeline-stall detection are now live. If a frame goes long, we can see exactly which pass cost the budget.

**Runtime Updater functionality (10 TODOs resolved).** The runtime can update itself in the field now. Versioned, signed, with rollback. This is the kind of plumbing that nobody notices until they need it, at which point it is the difference between a platform and an art project.

## What I learned from the pace

Two hundred seventy-six commits across one long holiday weekend is a pace that does not work in a traditional dev workflow. It works in this one because the workflow is built around agents shipping in parallel against a queue that I keep filled. A few observations from running at that pace through the Christmas-to-New-Year stretch:

**The Epic structure earned its keep.** Around mid-month I switched the issue tracker to an Epic-of-sub-issues pattern (Epic #506 for Runtime Core Phase 1, Epic #555 for Spatial Anchors, Epic #508 for OpenXR Extensions). Each Epic gets one PR that closes a coherent body of work. The agents implement the sub-issues in parallel, but the merge happens as one atomic Epic-level PR. That gave the codebase a much cleaner history and made review tractable.

**The TODO-tracking system was the right move.** Earlier in the month I added an automated system that scans the codebase for `TODO` comments and creates GitHub issues for each one, with prioritization. By the time the Christmas sprint started, there were 342 tracked runtime TODOs. The agents picked off the highest-priority ones first. We closed roughly 150 of them this weekend. The codebase is meaningfully cleaner than it was at the start of December.

**Cross-repo merge timing matters.** The runtime and the SDK had to land their changes within hours of each other for several Epics this weekend. When the runtime publishes a new C API, the SDK has to update its bindings on the same day. I held a few SDK PRs and merged a few runtime PRs in the same hour to keep the integration honest.

**The agents are getting better at their roles.** The PRs landing this weekend are noticeably cleaner than the PRs landing in September. Some of that is the codebase being more mature. Some of it is the workflow being more disciplined. Some of it is the models themselves getting better at the kind of work this codebase produces. All three are real.

## Where the engine is, going into 2026

The check-list version:

- AR1+ to AR2 Gen1 pivot: done
- OpenXR backbone: done
- Cloud LLM intent integration through the XRAssistantService: done
- On-device SLM inference through TFLite: done
- Sub-millimeter anchoring for high-precision overlays: done
- Spatial anchors with persistence, sharing, and proper crypto: done
- Wi-Fi 7 offloaded rendering pipeline: done
- Dual-mode RF / optical link manager: done
- Eye tracking, hand tracking, full-body tracking: done
- Foveated rendering with multi-profile optimization: done
- Hardware abstraction for sensors and optical channel: done
- Federated sync for model and content distribution: done
- Runtime updater with versioning and rollback: done
- Multi-platform builds (Linux, macOS, Windows MSVC 2026): done
- Telemetry and OpenTelemetry pipeline: done
- 342 TODOs tracked, ~150 closed this month: in progress, but coming together

What is not done: the AI subsystems that bind the model layer to the simulation step. Behavior trees. Navigation meshes. Crowd sim. Sensory systems. Decision trees. That is the work I expect to land in the first week of January. The runtime is ready to receive them. Today the engine has the bones. Next weekend it gets the nerves.

## What I want partners, builders, and labs to take from this

If you are a hardware partner sizing whether this engine can ship on your device in 2026, the answer is yes, and the work to make that real is mostly the vendor-specific glue at this point. The engine itself is ready.

If you are an AI lab looking at where your model's inference budget could be best spent in an AR runtime, the TFLite on-device path and the cloud LLM XRAssistantService path are both production-quality now. If your model fits the on-device budget, it can run on the simulation step. If it does not, the cloud path is open. Either way, the integration is model-agnostic, and I want your model to be the best model behind it.

If you are a developer thinking about building on top of this engine in 2026, the surface area is real. The C API is stable. The SDK bindings (Unity and Unreal) are real. The OpenXR backbone means the engine targets multiple devices. The blog at this URL has been a public log of how the engine got here. Read it back if you want to know what the engineering culture is going to be when you bring an experience to this platform.

276 commits, a year ending, an engine grown up. Different weekend, same workflow. Back to building Saturday.
