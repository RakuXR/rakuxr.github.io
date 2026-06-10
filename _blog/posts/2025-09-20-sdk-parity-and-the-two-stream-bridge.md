---
title: "Catching the SDK Up Before It Could Drift"
date: 2025-09-20
author: RakuAI Team
tags: [sdk, unity, unreal, parity, multi-repo, dev-workflow, weekend-build]
description: "Every multi-repo project dies the same way - one repo races ahead, the other quietly rots. This Saturday wired Unity and Unreal HelloAR to behave identically and built the parity-testing gate that makes the gap impossible. This is the discipline that keeps a spatial runtime and its bindings coherent for years, so your binding choice never locks you out of a feature."
series: learning-to-code-with-ai
slug: sdk-parity-and-the-two-stream-bridge
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Runtime C API feeding Unity and Unreal bindings, gated by a parity test that confirms identical behavior" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sdkParity-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="sdkParity-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#sdkParity-bg)"/>
  <text x="600" y="56" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Two Streams, One Behavior</text>
  <text x="600" y="90" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Parity testing as a CI gate - the bindings never drift apart</text>
  <g font-family="system-ui,sans-serif">
    <rect x="470" y="120" width="260" height="56" rx="14" fill="#1a1a33" stroke="#a388ff" stroke-width="2"/>
    <text x="600" y="154" text-anchor="middle" fill="#a388ff" font-size="18" font-weight="700">Runtime C API</text>
    <path d="M540 176 L360 240 M660 176 L840 240" stroke="url(#sdkParity-accent)" stroke-width="3" fill="none"/>
    <rect x="200" y="240" width="320" height="64" rx="14" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="360" y="270" text-anchor="middle" fill="#00cec9" font-size="17" font-weight="700">Unity HelloAR</text>
    <text x="360" y="291" text-anchor="middle" fill="#9090b0" font-size="12">load - anchor - render - telemetry</text>
    <rect x="680" y="240" width="320" height="64" rx="14" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="840" y="270" text-anchor="middle" fill="#00cec9" font-size="17" font-weight="700">Unreal HelloAR</text>
    <text x="840" y="291" text-anchor="middle" fill="#9090b0" font-size="12">load - anchor - render - telemetry</text>
    <path d="M360 304 L360 360 M840 304 L840 360 M360 360 L840 360" stroke="url(#sdkParity-accent)" stroke-width="2" fill="none"/>
  </g>
  <g font-family="system-ui,sans-serif">
    <rect x="430" y="360" width="340" height="60" rx="14" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="600" y="388" text-anchor="middle" fill="#e84393" font-size="16" font-weight="700">Parity test (Epic #42)</text>
    <text x="600" y="408" text-anchor="middle" fill="#9090b0" font-size="13">telemetry within tolerance - or the PR is blocked</text>
  </g>
</svg>
<figcaption>When a feature is easy in Unity and hard in Unreal, the asymmetry is a signal - and the fix lands in the C API.</figcaption>
</figure>

<p class="post-hook">Parity built at the start of a project costs a thousand times less than parity retrofitted after it ships. RakuAI's bindings are co-developed with the runtime, gated on every PR - so your binding choice never locks you out of a feature later.</p>

Already nervous about a specific failure mode I have watched kill multi-repo projects before, and that was the Saturday-morning starting state. The runtime adds a feature one weekend and the SDK does not catch up until next month. The samples in one binding work and the samples in the other binding silently regress. The version numbers stop matching. The CI on each repo is green and the integration between them is broken.

That movie ends with a re-platform two years in. I am not building Raku that way. The plan for this weekend was to catch the SDK up to the runtime before the gap could form, and to leave behind enough infrastructure that the gap can never form again.

## What landed on the SDK side

The SDK had a big weekend. The runtime side was quieter (most of its big push happened the weekend before with PR #104 landing VIO/SLAM, QoS Scheduler, Performance Harness, and the telemetry pipeline). This was the catch-up weekend for the bindings.

Highlights:

- SDK v0.2.0 Unity + Unreal parity, with comprehensive validation
- HelloAR samples in both bindings, with explicit failover demonstrations
- Enhanced Unity sample interactions with multi-object support and interactive tutorials
- Enhanced Unreal API documentation with comprehensive usage examples
- Agent-Queue Seeder workflow ported to the SDK repo
- CI/CD pipeline for SDK v0.2 package publishing with semantic versioning and release automation
- SDK v0.2 documentation and quickstart with repository homepage and wiki integration
- Epic #42: SDK & Runtime Parity Testing Infrastructure complete

The Epic #42 work is the headline. It is a test suite that exercises both bindings against the same canonical scenarios and confirms they behave the same. Unity HelloAR and Unreal HelloAR each load a model, anchor it to a marker, render it, and report telemetry. The parity test confirms the telemetry the two bindings report is within tolerance, and that the same model loads correctly in both. If a runtime change ever breaks one binding without breaking the other, the parity test catches it.

## Why parity testing matters at this stage

The Raku SDK is not yet shipping. There is no public release. We are months away from anyone outside the team writing code against this. So why care about parity now?

Because parity testing built at the start of a project costs a thousand times less than parity testing retrofitted onto a project that already shipped. Every new C API the runtime adds gets exercised through both bindings on day one. Every PR that touches the public surface has to either show the parity test still passes or explain why it does not. The cost is a few minutes per PR. The savings is months of triage downstream when a partner reports an issue that only reproduces on Unreal and the team has to figure out why.

The other reason is that parity testing surfaces architectural problems. When a feature is easy to expose in Unity and hard in Unreal, the problem is usually not in the bindings. It is in the runtime's C API. The asymmetry is a signal. This weekend the parity tests surfaced two such asymmetries, and the fix in both cases was to change the runtime's API surface rather than work around the asymmetry in one of the bindings.

## How the two-stream workflow works

The pattern I have landed on for multi-repo development with agents:

**One agent queue per repo.** The runtime has its own issue queue, the SDK has its own issue queue, the docs have their own. Each agent works inside its repo. No single agent tries to span the seam between two repos in one PR.

**Cross-repo coordination at the issue level.** When a feature requires changes in both repos, two coupled issues get filed at the same time, with cross-references. The runtime PR lands first. The SDK PR is held until the runtime PR is merged. Then the SDK PR is updated against the new runtime build, re-tested, and merged within hours.

**A canonical samples set in each binding.** Unity HelloAR and Unreal HelloAR are the canonical test vehicles. Every C API change has to be exercised in both. The samples are not afterthoughts. They are part of the public surface.

**Parity tests as a CI gate.** The parity-testing infrastructure that landed this weekend as Epic #42 is now run on every PR that touches either repo. If a runtime change does not exercise both bindings, the PR is blocked from merging until the parity test demonstrates the change works on both sides.

## What this enables for builders

If you are a Unity developer thinking about building on Raku eventually, the binding is being co-developed with the runtime, not chased after it. The Unity API will not lag. The samples will work today and they will work in version 1.0.

If you are an Unreal developer, the same is true. The Unreal binding has identical priority to the Unity one. The parity tests prove it.

If you are deciding which binding to start with, the answer is whichever one fits your team's existing skills. The parity testing is what lets me promise that the binding choice will not lock you out of features later.

If you are a partner thinking about how this engine integrates into your stack, the surface is going to be C API plus Unity binding plus Unreal binding plus eventually a few more (Godot is on the roadmap, web-native is on the roadmap). Each new binding has to land its own parity tests against the canonical set before it ships. The discipline is baked in.

## Honest about what is still rough

The parity tests cover the basics. Marker-based anchoring works in both bindings. HelloAR loads and renders in both. Telemetry reports correctly in both. The harder parity questions, full hand tracking, voice pipeline, multiplayer pose sync, those are not parity-tested yet because the runtime side is not done. They will come under the same gate when they are.

The CI pipeline for SDK v0.2 publishing is up, but the actual published package is not yet stable enough to recommend integrating against. Treat the SDK as in-development through October. By November the parity tests will be deep enough that the recommendation will be different.

## What I want to remember from this weekend

Two things.

**Multi-repo parity is a discipline, not a feature.** The weekend the SDK caught up to the runtime is a weekend with no shiny new feature in the runtime. Nothing demo-able happened. The thing that happened was that the SDK no longer lags. That is the kind of work that, neglected, kills a multi-repo project. I want to write that down so I do not forget when the next big runtime feature lands.

**The agent queue scales by repo.** Running one queue across both repos in the same workflow produced an early version of the merge-conflict slop I described last weekend at the runtime level. Separating the queues by repo eliminated almost all of it. The agents stop tripping over each other when their problem spaces are properly carved.

Saturday evening, the SDK and the runtime are at parity. Big weekend. Right kind of weekend.

<div class="post-cta">
<h3>Pick the binding that fits your team</h3>
<p>Unity, Unreal, and more on the roadmap - parity testing means your binding choice never costs you features. Start where your team is strongest.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/developers/">For Developers</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
