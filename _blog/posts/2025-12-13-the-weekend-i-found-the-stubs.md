---
title: "The Saturday I Found the Stubs"
date: 2025-12-13
author: RakuAI Team
tags: [unit-tests, stubs, technical-debt, best-practices, weekend-build]
description: "Forty-seven functions claimed to do real work. Forty-seven were returning placeholders. This is the Saturday I went looking for the stubs the agents had quietly landed — and built the audit, the tests, and the discipline that turns agent-coded into agent-trusted. The honesty that makes a spatial runtime safe to build on."
series: learning-to-code-with-ai
slug: the-weekend-i-found-the-stubs
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="An audit pass finds forty-seven stub functions returning placeholder values" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="stub-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="stub-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#stub-bg)"/>
  <text x="600" y="64" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">The Audit That Found the Stubs</text>
  <text x="600" y="100" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Clean API surface, real-looking docs, placeholder bodies</text>
  <g font-family="ui-monospace,monospace" font-size="15">
    <rect x="120" y="150" width="430" height="250" rx="14" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="145" y="186" fill="#ff7aa8">int do_real_work() {</text>
    <text x="170" y="216" fill="#9090b0">// TODO: implement</text>
    <text x="170" y="246" fill="#9090b0">return 0;</text>
    <text x="145" y="276" fill="#ff7aa8">}</text>
    <text x="145" y="330" fill="#e84393" font-weight="700">STUB</text>
    <text x="145" y="360" fill="#9090b0">looks done, does nothing</text>
  </g>
  <g font-family="system-ui,sans-serif">
    <path d="M560 275 L640 275" stroke="url(#stub-accent)" stroke-width="4"/>
    <polygon points="640,275 622,266 622,284" fill="#a388ff"/>
    <text x="600" y="260" text-anchor="middle" fill="#a388ff" font-size="14" font-weight="600">AUDIT</text>
  </g>
  <g font-family="system-ui,sans-serif">
    <rect x="660" y="150" width="430" height="250" rx="14" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="875" y="216" text-anchor="middle" fill="#00cec9" font-size="72" font-weight="800">47</text>
    <text x="875" y="262" text-anchor="middle" fill="#e8e8f0" font-size="18">stubs surfaced</text>
    <text x="875" y="320" text-anchor="middle" fill="#9090b0" font-size="15">filed as issues</text>
    <text x="875" y="350" text-anchor="middle" fill="#9090b0" font-size="15">five turned into failing tests</text>
  </g>
</svg>
<figcaption>An audit pass turns invisible scaffolding into a tracked, testable queue.</figcaption>
</figure>

<p class="post-hook">Agents will ship code that compiles, passes CI, and does nothing. The difference between an engine you can demo and a runtime partners can build on is the discipline to find the stubs before they do.</p>

Today is supposed to be the day I write tests.

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

## What I did with the rest of the day

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

<div class="post-cta">
<h3>Build on a runtime that tells the truth</h3>
<p>RakuAI is engineered in public, stubs and all — with the audit discipline that makes a spatial runtime safe to integrate against. See what it takes to ship on it.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/developers/">Start Building</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
