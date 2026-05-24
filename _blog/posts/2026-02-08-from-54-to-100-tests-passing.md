---
title: "From 54% to 100% Tests Passing"
date: 2026-02-08
author: Kevin Griffin
tags: [tests, ctest, ecs, eye-tracking, telemetry, weekend-build]
description: "54% to 100% in three weekends. The test runner does not care about your feelings, your star count, or your roadmap — it tells you exactly how much of your spatial runtime actually works. Here is how we walked the gap, root-cause by root-cause, and why pass rate is the most honest signal a partner can ask for."
series: learning-to-code-with-ai
slug: from-54-to-100-tests-passing
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Test pass rate climbing from 54 percent to 100 percent over three weekends" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="t100-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="t100-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e84393"/><stop offset="0.5" stop-color="#6c5ce7"/><stop offset="1" stop-color="#00cec9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#t100-bg)"/>
  <text x="600" y="62" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">54% to 100% Green</text>
  <text x="600" y="98" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Three weekends, four root-cause fixes, one honest number</text>
  <g font-family="system-ui,sans-serif">
    <line x1="150" y1="400" x2="1080" y2="400" stroke="#2a2a4a" stroke-width="2"/>
    <line x1="150" y1="140" x2="150" y2="400" stroke="#2a2a4a" stroke-width="2"/>
    <polyline points="150,380 430,360 710,348 990,160" fill="none" stroke="url(#t100-line)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="150" cy="380" r="9" fill="#e84393"/><text x="150" y="365" text-anchor="middle" fill="#ff7aa8" font-size="16" font-weight="700">54%</text>
    <circle cx="430" cy="360" r="9" fill="#a388ff"/><text x="430" y="345" text-anchor="middle" fill="#a388ff" font-size="16" font-weight="700">63%</text>
    <circle cx="710" cy="348" r="9" fill="#6c5ce7"/><text x="710" y="333" text-anchor="middle" fill="#a388ff" font-size="15">63%</text>
    <circle cx="990" cy="160" r="11" fill="#00cec9"/><text x="990" y="143" text-anchor="middle" fill="#00cec9" font-size="18" font-weight="800">100%</text>
    <text x="150" y="430" text-anchor="middle" fill="#9090b0" font-size="14">Sat AM</text>
    <text x="430" y="430" text-anchor="middle" fill="#9090b0" font-size="14">Sat PM</text>
    <text x="710" y="430" text-anchor="middle" fill="#9090b0" font-size="14">Wk 2</text>
    <text x="990" y="430" text-anchor="middle" fill="#9090b0" font-size="14">Wk 3</text>
  </g>
</svg>
<figcaption>The only number that cannot be massaged: 56 of 56 tests passing.</figcaption>
</figure>

<p class="post-hook">When a partner evaluates a spatial runtime, the first number they should ask for is the integrated test pass rate. Here is how we took ours from barely-working to bulletproof — and why the trajectory matters more than the snapshot.</p>

The number that does not lie about a codebase is the test pass rate. Sales numbers can be massaged. Star counts can be inflated. Lines of code can be padded. The test pass rate is what the test runner says it is, and the test runner does not care about your feelings.

When I opened the laptop a week ago Saturday the number was 54%. Twenty-eight tests out of fifty-two. Not catastrophic. Not green. The kind of number that means the codebase mostly works and you cannot tell exactly where it does not. By that Saturday night the number was 63% (33/52). By the Sunday that just closed, it was 100% (56/56). The path between those numbers is what this post is about.

## Why the number was low to start with

A few overlapping reasons.

**Stubs were passing tests they should have failed.** A theme that comes up every few weekends. Some of the tests in the suite were comparing return values against zero, and the stub implementations happened to return zero, and the tests happened to call them success. The harness was not lying. The tests were tautological.

**Some assertions were mismatched to actual error codes.** A test was asserting `font_set_data` returned `-1` on bad input. The real implementation returned `-3` (which maps to `RAKU_ERROR_INVALID_PARAMETER`, a more specific code than the test was written for). Both behaviors are valid. The test had been written before the error codes were unified. The fix was to update the test to accept any negative error code, not to change the implementation.

**Telemetry tests had no state to track.** A class of test was exercising the telemetry event pipeline by asserting "after I fire event X, the telemetry system should remember it." The telemetry subsystem at the time had a stub event tracker that did not remember anything. Tests failed not because the pipeline was broken but because there was no pipeline yet.

**The eye-tracking module had inverted return-value conventions.** Some of the eye-tracking C API functions were returning `1` for success because they had been written by a Win32-flavored developer day. The rest of the engine returns `0` for success. Tests written against the rest of the engine were failing on the eye-tracking module not because of bad code but because of a convention drift.

**The MSVC build had a hard compilation error in an opaque-handle cast.** `XrInstance` is an OpenXR opaque handle type. Casting it to `uint64_t` for serialization needed `reinterpret_cast` rather than `static_cast`. MSVC C2440 errored loudly. The fix was a one-line change. The test failures it was hiding were larger.

## What the work looked like

I want to write down the specifics because the pattern of test-fixing is repeatable.

**Saturday morning (29/52 → 31/52):** Resolve the build errors that were preventing some tests from even compiling. The `reinterpret_cast` fix unblocked two tests immediately and surfaced a third that had been hidden behind a compile failure.

**Saturday midday (31/52 → 33/52):** Replace the telemetry stubs with stateful event-tracking implementations. The stubs were two-line functions that did nothing. The real implementations track events in a thread-safe vector, expose a query API, and produce the right behavior for the three telemetry tests in the harness. Wrote `telemetry_stubs.cpp` as a proper test double that mimics the production telemetry subsystem closely enough that the tests pass for real reasons.

**Saturday afternoon (33/52 → 33/52, no gain in count but a quality jump):** Fix the assertion in `test_edge_cases` that was checking against the wrong error code. The fix was to make the assertion accept any negative error code rather than the specific `-1` it had been written against. The test now exercises the actual error path of the real implementation.

**A weekend later (33/52 → 33/52 → 53/52 → 56/56):** The eye-tracking convention drift took the most time. The C API for eye tracking had a different return-value convention from the rest of the engine. Aligning the convention required updating both the implementations (return `0` for success) and updating callers to expect `0`. Once aligned, twenty more tests went green at once. Cascade effects are real.

The next weekend after that was the test_memory_leaks weekend. Nine tests were failing for memory-related reasons that surfaced only under the leak-detection harness. The fixes were the kind of careful work that does not turn into a one-liner: `InputQueue` had been a no-op stub that needed real add/get/predict/trim behavior; `RollbackSession::initialize` had to validate callbacks before accepting them; `NetworkQualityEstimator` had to actually track RTT and packet loss from send/ack pairs; and `ECS World::clear` had to drain the free-indices queue to prevent stale-index reuse on the next allocation cycle.

That last one (the ECS free-indices queue) is the kind of bug that does not produce a crash but produces extremely subtle bugs later. The free-indices queue is how the entity-component system reuses handles after entities are destroyed. If `clear` leaves stale indices in the queue, the next entity created will get a handle that overlaps with a previously-deleted entity's, and references to the deleted entity will silently start pointing at the new one. Hard to diagnose. Trivial to introduce. The memory-leak test caught it because the leak detector tracked which handles had been allocated.

By the end of that weekend, the test suite was at 56/56. 100%.

## What I learned

Three things.

**Convention drift is invisible until you measure it.** The eye-tracking module had been working in isolation. The fact that it returned `1` for success while the rest of the engine returned `0` had not bitten anyone yet because nobody had written cross-module tests against it. The test suite, once large enough to span modules, exposed the drift in twenty different ways at once. Test suites are how conventions get audited.

**Stubs that pass tests are worse than stubs that fail.** Both are stubs. Both eventually need real implementations. The stub that fails the test is honest about being a stub. The stub that happens to pass the test is a lie the codebase is telling itself. The audit pass that surfaces the lying stubs is the audit that improves the codebase the most.

**Cascade effects are the prize.** The eye-tracking convention fix unblocked twenty tests in one push. The memory-leak fix in ECS `World::clear` unblocked nine more. The big wins in test pass rate did not come from fixing twenty individual bugs. They came from fixing four root-cause issues that each had multiple downstream test failures.

## What partners and builders should take from this

If you are evaluating an engine for partnership and the test pass rate is below 90%, ask about the trajectory. A team that started at 54% and went to 100% in three weekends is a different team from one that has been at 80% for six months and stayed there.

If you are running an agent-driven workflow and your test pass rate is not where you want it, do not assume the agents need to be smarter. Look at the tests. The tautological tests, the convention drift, the stubs that happen to pass. The fix is usually in the test harness, not in the implementations.

If you are an AI lab building a coding agent for autonomous PRs, the metric I find most predictive is "after the agent's PR lands, does the test pass rate go up." A lot of agents land PRs that ship code and ship tests that pass against that code, with no actual improvement in coverage of the real product. Agents that move the integrated test pass rate are different agents. Worth optimizing for.

A week ago Saturday the number was 54. Tonight it is 100. The test runner does not care about my feelings. The test runner is correct about that.

Closing the laptop on Sunday with a green suite. Back to building next weekend.

<div class="post-cta">
<h3>Build on a runtime that proves its own quality</h3>
<p>RakuAI is the AI-native spatial runtime your assistant inhabits in the real world. Green tests, honest signals, engine-grade discipline — see what your team can ship on it.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/developers/">For Developers</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
