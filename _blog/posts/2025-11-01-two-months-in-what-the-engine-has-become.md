---
title: "Two Months In: What the Engine Has Become"
date: 2025-11-01
author: Kevin Griffin
tags: [reflection, architecture, ar-glasses, multi-repo, agent-workflow]
description: "Two months since the first commit. A quiet week. A good week to take stock of what the engine actually is now, where the architecture has settled, and what the road to a December production-readiness milestone looks like."
series: learning-to-code-with-ai
slug: two-months-in-what-the-engine-has-become
---

A quiet week. Three commits total. The agents were running cooler on purpose; I have been thinking about architecture rather than shipping new code. The codebase ends the week roughly where it started it, which is the right state for the kind of work I was doing.

Two months ago today the runtime repo was an empty README. The kind of week worth writing about is the one where the writer takes stock. So that is what this is.

## What the engine actually is, today

If I had to describe Raku in one paragraph to someone who has not been reading along, the description would be:

A cross-platform AR runtime, written in C++ and exposed through a stable C API, with Unity and Unreal SDK bindings. It targets AR glasses primarily and runs on whatever hardware is available today (currently coming online for Meta Quest passthrough, with desktop and mobile preview builds). It is designed from the foundation up around the assumption that AI is a runtime concern, not an editor feature. Sub-millimeter anchoring is supported. OpenXR is the conformance target where standards exist. The codebase is built with autonomous coding agents on the dev team, working through a public issue queue.

That paragraph would have been an aspirational mission statement on day one. It is now a description of what is in the repo.

## What surprised me about the last two months

Three things.

**The agent-driven workflow scaled past where I expected it to.** I had a worry going in that the autonomous agents would produce a codebase that worked in isolated PRs and turned into mush across many merges. The mush has not happened. The codebase is more coherent at two months than codebases I have inherited from human teams at two years. The reason is the discipline I have been writing about every week (smaller queue, earlier review, multi-vendor pairing for review independence, documentation as input). Those disciplines work.

**The hardware pivot was less expensive than I feared.** Moving from AR1+ as the product target to AR2 Gen1 in early October was a decision I sat with for several days because the cost looked large. The actual cost was a couple of PRs (a thorough rename sweep, a documentation pass). The reason the cost was small is the modular architecture established in week one. Subsystems that did not need to know about the device-class boundary did not have to change. The ones that did, changed cleanly through their well-defined surfaces. That is the dividend of drawing the architecture early.

**The partnership conversations are happening earlier than I planned.** I expected to be in "build the engine, ship a demo, then have partnership conversations" mode through the end of the year. The actual sequence has been "build the engine, have partnership conversations along the way that inform what to build next, then ship demos that match what those conversations need." NTT QONOQ. Meta. The next ones I am not going to name yet. The conversations are sharper than the demos right now, which is a good place to be.

## Where the architecture has settled

A short list of the architectural decisions that I no longer expect to revisit:

- The runtime is C++ exposed through a stable C API. Other language bindings sit on top of the C API, not on top of C++ directly.
- The SDK is multi-binding from day one. Unity and Unreal are first-class. Godot is on the roadmap. Web-native is on the roadmap. The C API is the bottleneck. The bindings are not.
- Subsystems are DLLs. Each one has a public surface; nothing inside one subsystem reaches into another subsystem's internals. The surfaces are reviewed PRs.
- AI is a runtime concern, not an editor feature. The AI work that lives in the engine runs on the simulation step every frame. The cloud-LLM work that lives in the engine integrates into the voice pipeline at runtime. Neither is a panel in an authoring tool.
- OpenXR is the standard where the standard fits. Vendor-specific code sits behind feature flags and provider patterns. Adopting a new OpenXR-conformant device target is a vendor-specific glue layer, not a runtime rewrite.
- The dev process is multi-vendor by design. The model that writes a piece of code cannot be the model that reviews it. The lab whose model is currently best at a given role gets that role until another lab is better.

What I do still expect to revisit:

- The exact division of labor between on-device inference and cloud LLM intent. This will get sharper as the TFLite work matures and as the cloud LLM interface gets exercised by real partners. The current line is provisional.
- The shape of the experience-definition file format. The bones are there. The schema will evolve. I expect at least one major-version bump before the format is stable.
- The placement of state synchronization for multiplayer AR. We have a low-latency delta channel today. Whether the right long-term answer is a peer-to-peer mesh, a hosted authoritative server, or some hybrid is not yet settled. The two-player demos that ship in December will inform the call.

## The road to December production-readiness

I have been quietly aiming at a December milestone where the engine is "production-ready for partners to build serious demos on top of." That is not a public launch. It is the internal bar at which I am willing to invite a partner team to start building against the runtime without warning them about half a dozen rough edges.

What still has to happen to clear that bar:

- The AI subsystems for the runtime (behavior trees, navigation mesh, crowd sim, sensory systems, decision trees). Currently scaffolded in design docs; implementation lands in December and the first week of January.
- Windows MSVC build cleanliness. I have not actually built the runtime under Visual Studio 2026 since October. I am pretty sure that is going to be a fight. I will write about it when I do it.
- A canonical samples package that demonstrates a non-trivial AR experience end to end through both Unity and Unreal bindings, with the voice pipeline and the cloud LLM hooked up.
- A federated-sync path for distributing model updates to devices in the field. The crypto piece needs to be production-grade, not stub-grade.
- The runtime updater. We need to be able to ship a new build to a partner's dev kit and have it install cleanly.

That is the list. Six weeks to clear it. December's commit volume is going to be high.

## What I want builders and partners to take from this

If you have been reading this blog for two months, you have seen the engine come together in real time. The pace is high; the discipline is real; the architectural decisions are documented. That is the engineering culture this engine is built with. It is the engineering culture you will be working with if you build on top of it.

If you are a partner thinking about whether to start a serious conversation: the conversation is sharper than the demos right now, and that is on purpose. I would rather hear what your product actually needs and let that shape what gets built than build a demo and then try to fit it to your needs after the fact. The window for shaping what December delivers is open through the end of November.

If you are a developer waiting for stability: stability is December's deliverable. The engine is in active enough evolution today that I would not recommend building serious dependent code on it yet. Two months from today the recommendation will be different.

Quiet Saturday. Two months in. Back to building next weekend.
