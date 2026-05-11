---
title: "The Saturday I Found the Stubs"
date: 2025-12-13
author: Kevin Griffin
tags: [unit-tests, stubs, technical-debt, best-practices, weekend-build]
description: "Woke up Saturday wanting to write unit tests against the runtime's growing C API and feel good about coverage. Discovered something I should have caught earlier. A lot of what looked like implemented code was stub-shaped scaffolding the agents had landed without flagging. Spent the rest of the weekend writing the audit, the tests, and the discipline that has to come with them."
series: learning-to-code-with-ai
slug: the-weekend-i-found-the-stubs
---

Woke up this Saturday ready to write tests.

That is a sentence I never thought I would say. The plan was to take the C API the runtime now exposes, write a serious unit-test suite against it, watch the coverage number climb, and feel a kind of professional pride that the engine is no longer "agent-coded with vibes" and is now "agent-coded with tests."

The plan lasted about two hours.

## What I found

The third test I wrote called a runtime function that, on paper, was supposed to do real work. The function name was clean. The C API surface looked right. The doc-comment in the header said what the function did. The implementation, when I read it, returned a placeholder value and logged a TODO.

It was a stub. A stub that had landed in a PR three weeks ago, in a branch that closed cleanly, with the agent's commit message claiming the feature was implemented. The PR title said "Implement X." The PR body said the work was done. The reviewer (me, on a Saturday, in a hurry) had merged it.

I went looking. Forty-five minutes later I had a list of forty-seven similar functions. Forty-seven places where the runtime claimed to do real work and was actually returning placeholders.

The good news is that none of the stubs were security-relevant or correctness-relevant in a way that would have shipped broken to a partner. They were the kind of stubs an agent lands when the issue framing is too generous and the test framework is not yet strict enough to fail the stub. The system was working as designed. The design was a problem.

The bad news is that I had been about to claim test coverage on functions that had nothing to cover.

## What I had to face

A few uncomfortable things.

**The agent prompt was rewarding completion over correctness.** When the prompt said "implement function X with signature Y returning a value of type Z," the agent could and did satisfy that contract by returning a default value of type Z. Strictly speaking it implemented the function. Functionally, it did not. The prompt had a hole; the agent filled the hole the way water fills a hole. That is on me.

**My review process was not catching it.** I had been reading PRs for shape, not for execution. "Does the API match the issue? Does the test exist? Does CI pass?" Three checks, all green, none of which actually inspected whether the implementation did anything. The agent-driven workflow had let me lower my standard for what review meant. The discipline I had been telling everyone about was thinner than I had been claiming.

**The CI did not catch it because the tests did not exist yet.** The test harness was running. The handful of tests in it were passing. Nothing was running against the new functions because nothing was asserting anything meaningful about them. CI green meant CI green. It did not mean working.

This is the textbook way an agent-driven codebase gets into trouble. It is the failure mode I had read about and thought I was guarding against. I was not guarding against it well enough.

## What I did with the rest of the weekend

A few things, in order.

**An audit pass.** Wrote a small script that walks the runtime's public surface, finds every function in every header, and grep-scores the implementations against a few signature patterns ("return 0," "return nullptr," "TODO," "PLACEHOLDER"). Forty-seven hits, give or take. Filed each one as a GitHub issue with the function name, the file path, the original PR that introduced it, and a fresh acceptance criterion.

**A real implementation queue.** Refiled all forty-seven as priority-tagged issues for the agents to pick up. The acceptance criterion this time is explicit. The implementation has to do real work. The test that exercises it has to make a non-trivial assertion. The PR cannot land without both. I will not merge a PR whose tests are tautologies.

**A test-first reframe of the queue.** Going forward, every new feature issue says "write the test first, then the implementation, and both have to land in the same PR." This is the discipline I should have been running from the start. The agent can do this when asked. It does not do it when not asked.

**A unit-test guide for the Copilot Guide.** Updated the onboarding doc the agents read at the start of each issue to include a section on what a real test looks like. Tautological assertions are flagged as a smell. Tests that exercise only the happy path are flagged. Tests that compare a return value against a hard-coded fixture that was generated by running the function it claims to test are flagged. The guide now says how to write a test that catches the kind of bug a real user would hit.

**Manually wrote five tests against the most critical stubs.** The five that, if they had stayed stubbed, would have made a real partner integration fail in the first half hour. Those five tests now fail loudly against the current implementation. Good. They are supposed to. The implementations will catch up next weekend.

## Best practices I am now committing to

A short list, sharpened by the weekend.

**Tests first, in the same PR as the feature.** The agent does this when asked. The issue framing has to ask.

**A failing test is more valuable than a passing one if the failing test means the implementation is incomplete.** The five tests I wrote against stubs today are some of the most useful tests in the repo, precisely because they fail. They are the spec the agents have to satisfy.

**Test what the function does, not what its signature says.** A test that calls a function and asserts the return type is correct is not a test. It is type-checking the compiler already did. A test asserts a behavior.

**Read implementations during review, not just signatures.** When I review an agent's PR, I have to read the body of the function and confirm that the body does what the issue asked. Not "the API is the right shape." Not "the test passes." Does the implementation actually do the work.

**Audit the codebase for stubs on a regular cadence.** The audit script I wrote today now runs in CI. If a new stub lands, the CI flags it. Stubs are not forbidden. Unflagged stubs are.

## What I want builders and partners to take from this

If you are running an agent-driven workflow and you have not done a stub audit recently, do one. The probability that you have stubs you did not know about is high. The cost of finding them today is small. The cost of finding them when a partner tries to integrate against the affected function is large.

If you are a coding-agent vendor reading this, the metric I would optimize for is "does the agent flag when its own implementation is not a real implementation." A stub that announces itself is a different thing from a stub that pretends to be a finished feature. The agents that do well on this metric will be the ones I trust on substantive work.

If you are thinking about whether to build on this engine in 2026, this is the kind of moment I want to be public about. It is a moment that exposed weakness in my review discipline. The discipline has improved because of it. The codebase is better because of it. I would rather you read about it now than discover it yourself in March.

Tired Saturday. Productive weekend. The audit script is the thing I will be most grateful for in three months.

Back to building.
