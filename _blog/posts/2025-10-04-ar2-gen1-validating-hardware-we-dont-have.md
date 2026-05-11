---
title: "Validating Hardware Before the Silicon Shows Up"
date: 2025-10-04
author: Kevin Griffin
tags: [ar-glasses, hardware, thermal, ci, ar2-gen1, weekend-build]
description: "Woke up this Saturday with a decision queued: pivot the product target from AR1+ to AR2 Gen1, and start shipping the thermal-validation, Wi-Fi 7 stability tests, and sensor-integration bring-up harness for hardware that does not exist on my desk. Two days later it is all wired up and waiting for silicon."
series: learning-to-code-with-ai
slug: ar2-gen1-validating-hardware-we-dont-have
---

Woke up this Saturday with a decision I had been chewing on through the work week and could now finally act on. Pivot the product target from AR1+ to AR2 Gen1. Build everything downstream of the new spec before the silicon arrives, so that when the silicon does arrive, validation begins on day one instead of day ninety.

There is a stage every hardware product goes through where the spec exists, the validation plan exists, the test harness exists, and the actual silicon does not. The traditional answer is to sit and wait. The modern answer is to build everything that is downstream of the hardware first, and to have it all green before the parts ship.

This weekend was that. The target platform officially shifted from AR1+ to AR2 Gen1, and the engineering response was to immediately build the validation infrastructure the new platform will need, before any of us touch the new platform.

## What landed

Five things, all landed this weekendend:

- The AR2 Gen1 device bring-up and sensor integration infrastructure
- A Wi-Fi 7 connectivity and tracking-stability test suite
- A thermal and power validation framework
- CI smoke tests with metric analysis and reporting
- The AR2 Gen1 hardware validation documentation and production standards spec

All of it gated by feature flags so that the AR1+ code path still works and nothing in the existing runtime regresses. The agents that landed these PRs did the boring discipline correctly: every new file is hidden behind a build flag, every API addition is non-breaking, every test runs in CI even though there is no AR2 device for it to run against. The tests simulate. The simulation is good enough to catch interface drift, missing exports, and broken sensor flows.

This was a 77-commit weekend. Most of those commits are in service of a device I cannot hold.

## Why this is sensible

A few reasons.

**Hardware validation that ships with the hardware is hardware validation that lands six months late.** The thermal-and-power framework written this weekendend will be used the day the first AR2 dev kit reaches my desk, not three months after. The platform's first thermal regression will be caught by an existing test, not by a human noticing the device is hot.

**A test harness without a device is still a test harness.** It runs against simulated sensor traces. Those traces come from the AR1+ era and from the spec. They are not perfect. They catch interface bugs, integration bugs, and metric-collection bugs. They do not catch the bugs that will only show up under real silicon. That is fine. The bugs they do catch are the bugs we would have spent the first week of real-hardware time hunting, and we now do not have to.

**The act of writing the harness clarifies the spec.** Half of the production-standards doc that landed at the end of the weekend existed only as fuzzy intent at the start of it. Writing the validation tests forced the spec into specific numbers. Frame budgets. Thermal envelopes. Wi-Fi 7 stability thresholds. The harness made the doc sharp. That is the actual deliverable.

## How the agent handled the pivot

The pivot from AR1+ to AR2 Gen1 was not handled cleanly the first time. Mid-weekend, the agent landed a PR that referenced "AR1+" in places where the new code path should have said "AR2." That landed because the issue framing did not flag the rename. The fix was a separate PR titled "Fix AR1+ vs AR2 device discrepancy in documentation and copilot instructions" that swept through 121 separate references and brought them into line.

This is the kind of thing that does not happen when a single human writes all the code, because the single human just renames as they go. It happens in an agent-driven workflow when the agent picks up an issue that pre-dates a rename and faithfully writes the old name. The remedy is to keep the docs that the agent reads as input fully in sync with the current reality, and to write rename PRs as their own pieces of work.

I am building a system where the agent's docs are also the team's docs. When the docs lie, the agent lies in the same direction. That is a feature of the workflow I am trying to get right, not a bug.

## The Wi-Fi 7 test suite, specifically

This is the one I am proudest of from this weekendend.

The AR2 Gen1 spec assumes Wi-Fi 7 connectivity for offloaded rendering and tethered compute. Wi-Fi 7 in practice is not as stable as Wi-Fi 6E, and the failure modes are different. The test suite written this weekendend characterizes the suite of failure modes (degraded throughput, intermittent loss, reauth storms) and bounds the runtime's behavior under each. The runtime cannot tolerate every failure. The job of the test suite is to be specific about which failures the runtime gracefully degrades through and which fail loud.

This matters because the AR experience the user is having cannot stutter when the connection blips. The runtime has to fall back to local rendering for a frame, or two, or twenty, depending on the duration of the blip, and re-converge when connectivity returns. That logic existed in fuzzy intent in the spec. After this weekendend, it exists as test cases.

## What I want partners to take from this

Two things.

If you are a hardware partner thinking about AR glasses, the validation framework this engine ships with is going to be one of the reasons it ships on your hardware faster than its competitors. The framework is portable. Adding a new device target is a few hundred lines of code plus the device-specific test vectors. The expensive part is already paid.

If you are an AI lab thinking about latency-sensitive on-device inference, the latency budget the AR2 Gen1 spec assumes is published. The end-to-end traces from sensor to render are being instrumented now, so when your model has to fit inside that budget, you can see what budget actually remains for inference. That is the conversation I want to be having with you in November.

77 commits over the weekend. Ended on documentation, which is the right kind of weekend to end with.
