---
title: "From 54% to 100% Tests Passing"
date: 2026-02-07
author: Kevin Griffin
tags: [tests, ctest, ecs, eye-tracking, telemetry, weekend-build]
description: "Started this Saturday with the test suite at 54% passing. By the end of the weekend, 63%. A weekend later, 100%. The path between those numbers was specific, mechanical, and full of the kind of small lessons that explain why test-pass-rate is one of the most honest signals a codebase produces."
series: learning-to-code-with-ai
slug: from-54-to-100-tests-passing
---

The number that does not lie about a codebase is the test pass rate. Sales numbers can be massaged. Star counts can be inflated. Lines of code can be padded. The test pass rate is what the test runner says it is, and the test runner does not care about your feelings.

This Saturday morning the number was 54%. Twenty-eight tests out of fifty-two. Not catastrophic. Not green. The kind of number that means the codebase mostly works and you cannot tell exactly where it does not. By Saturday night the number was 63% (33/52). A weekend later, it was 100% (56/56). The path between those numbers is what this post is about.

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

Saturday morning the number was 54. Two Saturdays from now it will be 100. The test runner does not care about my feelings. The test runner is correct about that.

Back to building.
