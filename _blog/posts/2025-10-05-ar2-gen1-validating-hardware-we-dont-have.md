---
title: "Validating Hardware Before the Silicon Shows Up"
date: 2025-10-05
author: Kevin Griffin
tags: [ar-glasses, hardware, thermal, ci, ar2-gen1, weekend-build]
description: "Pivot the product target from AR1+ to AR2 Gen1, then ship the thermal-validation, Wi-Fi 7 stability, and sensor bring-up harness for hardware that isn't on the desk yet. When the silicon arrives, validation begins on day one instead of day ninety. This is how RakuAI ships on your hardware faster than its competitors - the expensive part is already paid."
series: learning-to-code-with-ai
slug: ar2-gen1-validating-hardware-we-dont-have
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Validation harness running against simulated sensor traces while real AR2 Gen1 silicon is still pending" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ar2Gen1-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="ar2Gen1-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#ar2Gen1-bg)"/>
  <text x="600" y="56" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Validate the Hardware You Don't Have</text>
  <text x="600" y="90" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">AR1+ to AR2 Gen1 - harness green before the silicon ships</text>
  <g font-family="system-ui,sans-serif" font-size="14" fill="#c8c8e0" text-anchor="middle">
    <rect x="80" y="150" width="220" height="64" rx="14" fill="#1a1a33" stroke="#6c5ce7" stroke-width="2"/><text x="190" y="180" fill="#a388ff" font-weight="700">Simulated traces</text><text x="190" y="200" font-size="12" fill="#9090b0">AR1+ era + spec</text>
    <path d="M300 182 L380 182" stroke="url(#ar2Gen1-accent)" stroke-width="3"/>
    <rect x="380" y="130" width="440" height="220" rx="16" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="600" y="162" fill="#00cec9" font-size="17" font-weight="700">Validation harness (in CI)</text>
    <rect x="410" y="180" width="180" height="44" rx="8" fill="#1a1a33" stroke="#00cec9"/><text x="500" y="207" font-size="13">Thermal + power</text>
    <rect x="610" y="180" width="180" height="44" rx="8" fill="#1a1a33" stroke="#00cec9"/><text x="700" y="207" font-size="13">Wi-Fi 7 stability</text>
    <rect x="410" y="236" width="180" height="44" rx="8" fill="#1a1a33" stroke="#00cec9"/><text x="500" y="263" font-size="13">Sensor bring-up</text>
    <rect x="610" y="236" width="180" height="44" rx="8" fill="#1a1a33" stroke="#00cec9"/><text x="700" y="263" font-size="13">CI smoke + metrics</text>
    <text x="600" y="320" font-size="12" fill="#9090b0">behind feature flags - AR1+ path still green</text>
    <path d="M820 240 L900 240" stroke="url(#ar2Gen1-accent)" stroke-width="3" stroke-dasharray="6 5"/>
    <rect x="900" y="208" width="220" height="64" rx="14" fill="#1a1a33" stroke="#e84393" stroke-width="2"/><text x="1010" y="238" fill="#e84393" font-weight="700">AR2 Gen1 silicon</text><text x="1010" y="258" font-size="12" fill="#9090b0">not on the desk yet</text>
  </g>
  <text x="600" y="400" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="16">Catch interface drift, missing exports, broken sensor flows - before parts ship</text>
  <text x="600" y="430" text-anchor="middle" fill="#a388ff" font-family="system-ui,sans-serif" font-size="15" font-weight="600">77 commits in service of a device I cannot hold</text>
</svg>
<figcaption>A test harness without a device is still a test harness - and the act of writing it forces the spec into specific numbers.</figcaption>
</figure>

<p class="post-hook">The traditional answer to waiting on silicon is to sit and wait. The modern answer is to build everything downstream of the hardware first and have it all green before the parts arrive - so your hardware ships on RakuAI faster than its competitors.</p>

A decision I had been chewing on through the work week was waiting at the kitchen table when the weekend started. Pivot the product target from AR1+ to AR2 Gen1. Build everything downstream of the new spec before the silicon arrives, so that when the silicon does arrive, validation begins on day one instead of day ninety.

There is a stage every hardware product goes through where the spec exists, the validation plan exists, the test harness exists, and the actual silicon does not. The traditional answer is to sit and wait. The modern answer is to build everything that is downstream of the hardware first, and to have it all green before the parts ship.

This weekend was that. The target platform officially shifted from AR1+ to AR2 Gen1, and the engineering response was to immediately build the validation infrastructure the new platform will need, before any of us touch the new platform.

## What landed

Five things, all landed this weekend:

- The AR2 Gen1 device bring-up and sensor integration infrastructure
- A Wi-Fi 7 connectivity and tracking-stability test suite
- A thermal and power validation framework
- CI smoke tests with metric analysis and reporting
- The AR2 Gen1 hardware validation documentation and production standards spec

All of it gated by feature flags so that the AR1+ code path still works and nothing in the existing runtime regresses. The agents that landed these PRs did the boring discipline correctly: every new file is hidden behind a build flag, every API addition is non-breaking, every test runs in CI even though there is no AR2 device for it to run against. The tests simulate. The simulation is good enough to catch interface drift, missing exports, and broken sensor flows.

This was a 77-commit weekend. Most of those commits are in service of a device I cannot hold.

## Why this is sensible

A few reasons.

**Hardware validation that ships with the hardware is hardware validation that lands six months late.** The thermal-and-power framework written this weekend will be used the day the first AR2 dev kit reaches my desk, not three months after. The platform's first thermal regression will be caught by an existing test, not by a human noticing the device is hot.

**A test harness without a device is still a test harness.** It runs against simulated sensor traces. Those traces come from the AR1+ era and from the spec. They are not perfect. They catch interface bugs, integration bugs, and metric-collection bugs. They do not catch the bugs that will only show up under real silicon. That is fine. The bugs they do catch are the bugs we would have spent the first week of real-hardware time hunting, and we now do not have to.

**The act of writing the harness clarifies the spec.** Half of the production-standards doc that landed by Sunday evening existed only as fuzzy intent at the start of the weekend. Writing the validation tests forced the spec into specific numbers. Frame budgets. Thermal envelopes. Wi-Fi 7 stability thresholds. The harness made the doc sharp. That is the actual deliverable.

## How the agent handled the pivot

The pivot from AR1+ to AR2 Gen1 was not handled cleanly the first time. Mid-weekend, the agent landed a PR that referenced "AR1+" in places where the new code path should have said "AR2." That landed because the issue framing did not flag the rename. The fix was a separate PR titled "Fix AR1+ vs AR2 device discrepancy in documentation and copilot instructions" that swept through 121 separate references and brought them into line.

This is the kind of thing that does not happen when a single human writes all the code, because the single human just renames as they go. It happens in an agent-driven workflow when the agent picks up an issue that pre-dates a rename and faithfully writes the old name. The remedy is to keep the docs that the agent reads as input fully in sync with the current reality, and to write rename PRs as their own pieces of work.

I am building a system where the agent's docs are also the team's docs. When the docs lie, the agent lies in the same direction. That is a feature of the workflow I am trying to get right, not a bug.

## The Wi-Fi 7 test suite, specifically

This is the one I am proudest of from this weekend.

The AR2 Gen1 spec assumes Wi-Fi 7 connectivity for offloaded rendering and tethered compute. Wi-Fi 7 in practice is not as stable as Wi-Fi 6E, and the failure modes are different. The test suite written this weekend characterizes the suite of failure modes (degraded throughput, intermittent loss, reauth storms) and bounds the runtime's behavior under each. The runtime cannot tolerate every failure. The job of the test suite is to be specific about which failures the runtime gracefully degrades through and which fail loud.

This matters because the AR experience the user is having cannot stutter when the connection blips. The runtime has to fall back to local rendering for a frame, or two, or twenty, depending on the duration of the blip, and re-converge when connectivity returns. That logic existed in fuzzy intent in the spec. After this weekend, it exists as test cases.

## What I want partners to take from this

Two things.

If you are a hardware partner thinking about AR glasses, the validation framework this engine ships with is going to be one of the reasons it ships on your hardware faster than its competitors. The framework is portable. Adding a new device target is a few hundred lines of code plus the device-specific test vectors. The expensive part is already paid.

If you are an AI lab thinking about latency-sensitive on-device inference, the latency budget the AR2 Gen1 spec assumes is published. The end-to-end traces from sensor to render are being instrumented now, so when your model has to fit inside that budget, you can see what budget actually remains for inference. That is the conversation I want to be having with you in November.

77 commits over the weekend. Ended on documentation, which is the right kind of weekend to end with.

<div class="post-cta">
<h3>Ship on a runtime that's ready for your silicon</h3>
<p>A portable validation framework means a new device target is a few hundred lines plus test vectors - the expensive part is already paid. Bring your hardware.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/smart-glasses.html">For Smart-Glasses Makers</a>
<a class="cta-btn cta-secondary" href="/llm-makers.html">For AI Labs</a>
</div>
</div>
