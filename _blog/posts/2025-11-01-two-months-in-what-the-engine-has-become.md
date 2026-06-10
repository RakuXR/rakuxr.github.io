---
title: "Two Months Public, Years Under the Hood"
date: 2025-11-01
author: RakuAI Team
tags: [reflection, architecture, ar-glasses, multi-repo, agent-workflow, weekend-build]
description: "Two months of a public engineering log, years of work under the hood. A quiet Saturday to take stock: a cross-platform C++ AR runtime with AI baked into the simulation step, an architecture that has settled, and a December production-readiness milestone in sight. This is what an AI-native spatial runtime looks like when it stops being a mission statement and becomes a repo."
series: learning-to-code-with-ai
slug: two-months-in-what-the-engine-has-become
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="The settled architecture of the Raku runtime two months into the public log" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="2mo-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#2mo-bg)"/>
  <text x="600" y="60" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Two Months Public, Years Under the Hood</text>
  <text x="600" y="96" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">C++ core, stable C API, AI on the simulation step</text>
  <g font-family="system-ui,sans-serif" font-size="14">
    <rect x="380" y="140" width="440" height="52" rx="8" fill="#1a1a33" stroke="#6c5ce7" stroke-width="2"/>
    <text x="600" y="172" text-anchor="middle" fill="#a388ff" font-weight="700">Unity / Unreal / Web SDK bindings</text>
    <rect x="380" y="210" width="440" height="52" rx="8" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="600" y="242" text-anchor="middle" fill="#00cec9" font-weight="700">Stable C API</text>
    <rect x="240" y="290" width="220" height="120" rx="8" fill="#1a1a33" stroke="#6c5ce7"/>
    <text x="350" y="330" text-anchor="middle" fill="#e8e8f0">C++ Runtime Core</text>
    <text x="350" y="356" text-anchor="middle" fill="#9090b0" font-size="12">subsystem DLLs</text>
    <text x="350" y="378" text-anchor="middle" fill="#9090b0" font-size="12">OpenXR conformance</text>
    <rect x="740" y="290" width="220" height="120" rx="8" fill="#1a1a33" stroke="#e84393"/>
    <text x="850" y="330" text-anchor="middle" fill="#ff7aa8">AI as Runtime</text>
    <text x="850" y="356" text-anchor="middle" fill="#9090b0" font-size="12">every simulation step</text>
    <text x="850" y="378" text-anchor="middle" fill="#9090b0" font-size="12">cloud LLM intent + on-device</text>
    <line x1="600" y1="262" x2="600" y2="290" stroke="#9090b0" stroke-width="1.5"/>
  </g>
</svg>
<figcaption>The aspirational paragraph from day one is now a description of the repo.</figcaption>
</figure>

<p class="post-hook">Most "AI-native" engines bolt a chat panel into an editor. RakuAI treats the model as a control input on every frame — and two months in, that thesis is shipping code, not slideware.</p>

Plan for this Saturday was to slow down and think. Three commits the whole weekend, which is the lowest count since I started the public log. The agents are running cooler on purpose; my attention is on architecture rather than shipping new code. The codebase ends the weekend roughly where it started it, which is the right state for the kind of work I was doing.

Two months ago today the public runtime repo was an empty README. The engine and the patent estate behind it go back further than that. The kind of weekend worth writing about is the one where the writer takes stock. So that is what this is.

## What the engine actually is, today

If I had to describe Raku in one paragraph to someone who has not been reading along, the description would be:

A cross-platform AR runtime, written in C++ and exposed through a stable C API, with Unity and Unreal SDK bindings. It targets AR glasses primarily and runs on whatever hardware is available today (currently coming online for Meta Quest passthrough, with desktop and mobile preview builds). It is designed from the foundation up around the assumption that AI is a runtime concern, not an editor feature. Sub-millimeter anchoring is supported. OpenXR is the conformance target where standards exist. The codebase is built with autonomous coding agents on the dev team, working through a public issue queue.

That paragraph would have been an aspirational mission statement on day one. It is now a description of what is in the repo.

## What surprised me about the last two months

Three things.

**The agent-driven workflow scaled past where I expected it to.** I had a worry going in that the autonomous agents would produce a codebase that worked in isolated PRs and turned into mush across many merges. The mush has not happened. The codebase is more coherent at two months than codebases I have inherited from human teams at two years. The reason is the discipline I have been writing about every weekend (smaller queue, earlier review, multi-vendor pairing for review independence, documentation as input). Those disciplines work.

**The hardware pivot was less expensive than I feared.** Moving from AR1+ as the product target to AR2 Gen1 in early October was a decision I sat with for several days because the cost looked large. The actual cost was a couple of PRs (a thorough rename sweep, a documentation pass). The reason the cost was small is the modular architecture established early on. Subsystems that did not need to know about the device-class boundary did not have to change. The ones that did, changed cleanly through their well-defined surfaces. That is the dividend of drawing the architecture early.

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

- The AI subsystems for the runtime (behavior trees, navigation mesh, crowd sim, sensory systems, decision trees). Currently scaffolded in design docs; implementation lands in December and the first weekend of January.
- Windows MSVC build cleanliness. I have not actually built the runtime under Visual Studio 2026 since October. I am pretty sure that is going to be a fight. I will write about it when I do it.
- A canonical samples package that demonstrates a non-trivial AR experience end to end through both Unity and Unreal bindings, with the voice pipeline and the cloud LLM hooked up.
- A federated-sync path for distributing model updates to devices in the field. The crypto piece needs to be production-grade, not stub-grade.
- The runtime updater. We need to be able to ship a new build to a partner's dev kit and have it install cleanly.

That is the list. Six weeks to clear it. December's commit volume is going to be high.

## What I want builders and partners to take from this

If you have been reading the public log for two months, you have seen the engine come together in real time. The pace is high; the discipline is real; the architectural decisions are documented. That is the engineering culture this engine is built with. It is the engineering culture you will be working with if you build on top of it.

If you are a partner thinking about whether to start a serious conversation: the conversation is sharper than the demos right now, and that is on purpose. I would rather hear what your product actually needs and let that shape what gets built than build a demo and then try to fit it to your needs after the fact. The window for shaping what December delivers is open through the end of November.

If you are a developer waiting for stability: stability is December's deliverable. The engine is in active enough evolution today that I would not recommend building serious dependent code on it yet. Two months from today the recommendation will be different.

Quiet Saturday. Two months in. Back to building next weekend.

<div class="post-cta">
<h3>The window to shape what we ship is open</h3>
<p>RakuAI is an AI-native spatial runtime heading for a December production-readiness milestone. If you're a partner, the conversation that shapes what gets built next is happening now.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/why-rakuai.html">Why RakuAI</a>
<a class="cta-btn cta-secondary" href="/enterprise.html">For Partners</a>
</div>
</div>
