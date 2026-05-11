---
title: "SDK Parity and the Two-Stream Bridge"
date: 2025-09-20
author: Kevin Griffin
tags: [sdk, unity, unreal, parity, multi-repo, dev-workflow]
description: "This week the SDK caught up to the runtime. Unity and Unreal HelloAR samples both work. A parity-testing infrastructure proves the two bindings expose the same surface. The reason both repos moved in lockstep is the same reason agent-driven engineering produces a coherent codebase: discipline at the seams."
series: learning-to-code-with-ai
slug: sdk-parity-and-the-two-stream-bridge
---

There is a failure mode in multi-repo projects where the two repos drift. The runtime adds a feature one week and the SDK does not catch up until next month. The samples in one binding work and the samples in the other binding silently regress. The version numbers stop matching. The CI on each repo is green and the integration between them is broken.

I have watched that movie. I am not building Raku that way. This week the SDK and the runtime moved in lockstep, on purpose, and the discipline that made it work is worth writing down.

## What landed on the SDK side

The SDK had a big week. The runtime side was quieter (most of its big push happened the week before with PR #104 landing VIO/SLAM, QoS Scheduler, Performance Harness, and the telemetry pipeline). This was the catch-up week for the bindings.

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

The other reason is that parity testing surfaces architectural problems. When a feature is easy to expose in Unity and hard in Unreal, the problem is usually not in the bindings. It is in the runtime's C API. The asymmetry is a signal. This week the parity tests surfaced two such asymmetries, and the fix in both cases was to change the runtime's API surface rather than work around the asymmetry in one of the bindings.

## How the two-stream workflow works

The pattern I have landed on for multi-repo development with agents:

**One agent queue per repo.** The runtime has its own issue queue, the SDK has its own issue queue, the docs have their own. Each agent works inside its repo. No single agent tries to span the seam between two repos in one PR.

**Cross-repo coordination at the issue level.** When a feature requires changes in both repos, two coupled issues get filed at the same time, with cross-references. The runtime PR lands first. The SDK PR is held until the runtime PR is merged. Then the SDK PR is updated against the new runtime build, re-tested, and merged within hours.

**A canonical samples set in each binding.** Unity HelloAR and Unreal HelloAR are the canonical test vehicles. Every C API change has to be exercised in both. The samples are not afterthoughts. They are part of the public surface.

**Parity tests as a CI gate.** The parity-testing infrastructure that landed this week as Epic #42 is now run on every PR that touches either repo. If a runtime change does not exercise both bindings, the PR is blocked from merging until the parity test demonstrates the change works on both sides.

## What this enables for builders

If you are a Unity developer thinking about building on Raku eventually, the binding is being co-developed with the runtime, not chased after it. The Unity API will not lag. The samples will work today and they will work in version 1.0.

If you are an Unreal developer, the same is true. The Unreal binding has identical priority to the Unity one. The parity tests prove it.

If you are deciding which binding to start with, the answer is whichever one fits your team's existing skills. The parity testing is what lets me promise that the binding choice will not lock you out of features later.

If you are a partner thinking about how this engine integrates into your stack, the surface is going to be C API plus Unity binding plus Unreal binding plus eventually a few more (Godot is on the roadmap, web-native is on the roadmap). Each new binding has to land its own parity tests against the canonical set before it ships. The discipline is baked in.

## Honest about what is still rough

The parity tests cover the basics. Marker-based anchoring works in both bindings. HelloAR loads and renders in both. Telemetry reports correctly in both. The harder parity questions, full hand tracking, voice pipeline, multiplayer pose sync, those are not parity-tested yet because the runtime side is not done. They will come under the same gate when they are.

The CI pipeline for SDK v0.2 publishing is up, but the actual published package is not yet stable enough to recommend integrating against. Treat the SDK as in-development through October. By November the parity tests will be deep enough that the recommendation will be different.

## What I want to remember from this week

Two things.

**Multi-repo parity is a discipline, not a feature.** The week the SDK caught up to the runtime is a week with no shiny new feature in the runtime. Nothing demo-able happened. The thing that happened was that the SDK no longer lags. That is the kind of work that, neglected, kills a multi-repo project. I want to write that down so I do not forget when the next big runtime feature lands.

**The agent queue scales by repo.** Running one queue across both repos in the same workflow produced an early version of the merge-conflict slop I described last week at the runtime level. Separating the queues by repo eliminated almost all of it. The agents stop tripping over each other when their problem spaces are properly carved.

Saturday evening, the SDK and the runtime are at parity again. Quiet week. Right week.
