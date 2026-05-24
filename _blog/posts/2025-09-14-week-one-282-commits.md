---
title: "282 Commits, First Weekend on the Public Log"
date: 2025-09-14
author: Kevin Griffin
tags: [foundation, dev-workflow, agent-queue, ar-glasses, weekend-build]
description: "Two days at the keyboard, autonomous agents grinding the issue queue underneath, and 282 commits in the runtime repo by Sunday night. The main loop, the latency tracker, the C API that lets the SDK link in - here is what shipped, what broke, and what the agent-driven loop looks like when it finally clicks. This is what it means to supercharge a one-human runtime team."
series: learning-to-code-with-ai
slug: week-one-282-commits
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="The agent dev loop: file issues, agent picks up queue, opens PR, human reviews and merges, 282 commits" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="weekOne-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="weekOne-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#weekOne-bg)"/>
  <text x="600" y="56" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">282 Commits, First Weekend</text>
  <text x="600" y="90" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">The loop: file, pick up, draft, review, merge - then refill</text>
  <g font-family="system-ui,sans-serif" font-size="14" fill="#c8c8e0" text-anchor="middle">
    <rect x="80" y="170" width="180" height="70" rx="14" fill="#1a1a33" stroke="#6c5ce7" stroke-width="2"/><text x="170" y="200" fill="#a388ff" font-weight="700">File issues</text><text x="170" y="222" font-size="12" fill="#9090b0">sharply scoped</text>
    <rect x="330" y="170" width="180" height="70" rx="14" fill="#1a1a33" stroke="#6c5ce7" stroke-width="2"/><text x="420" y="200" fill="#a388ff" font-weight="700">Agent picks up</text><text x="420" y="222" font-size="12" fill="#9090b0">opens draft PR</text>
    <rect x="580" y="170" width="180" height="70" rx="14" fill="#1a1a33" stroke="#00cec9" stroke-width="2"/><text x="670" y="200" fill="#00cec9" font-weight="700">Review</text><text x="670" y="222" font-size="12" fill="#9090b0">human, both days</text>
    <rect x="830" y="170" width="180" height="70" rx="14" fill="#1a1a33" stroke="#00cec9" stroke-width="2"/><text x="920" y="200" fill="#00cec9" font-weight="700">Merge / re-file</text><text x="920" y="222" font-size="12" fill="#9090b0">sharpen if wrong</text>
    <path d="M260 205 L330 205 M510 205 L580 205 M760 205 L830 205" stroke="url(#weekOne-accent)" stroke-width="3"/>
    <path d="M920 240 C920 300 170 300 170 240" stroke="#e84393" stroke-width="2" fill="none" stroke-dasharray="6 5"/>
    <text x="545" y="296" fill="#e84393" font-size="13" font-weight="600">queue refill = the bottleneck</text>
  </g>
  <g font-family="system-ui,sans-serif" font-size="13" fill="#c8c8e0" text-anchor="middle">
    <text x="600" y="360" fill="#e8e8f0" font-size="16" font-weight="600">What landed: main loop - latency tracker - C API - test harness - ABI verify</text>
    <text x="600" y="392" fill="#a388ff" font-size="20" font-weight="800">282 commits</text>
    <text x="600" y="416" font-size="13" fill="#9090b0">most authored by an autonomous coding agent</text>
  </g>
</svg>
<figcaption>The agents do not have a day job - the output is what falls out of a continuously running queue.</figcaption>
</figure>

<p class="post-hook">The C API was the commit that mattered: the moment the runtime had a stable public surface, two streams of agent-authored work stopped tripping over each other. This is what an AI-native runtime looks like when the loop clicks.</p>

Last Saturday I filed a stack of issues and pointed an autonomous coding agent at the queue. By Sunday evening, sitting at the kitchen table with the laptop open one last time before Monday, 282 commits had landed across the runtime repo. I was the author on a small fraction of them. An autonomous coding agent was the author on most of the rest.

The reason the count looks like a sprint week of work is that the work has been happening continuously while I am not at the keyboard. I am at the keyboard on weekends. The agents do not have a day job. The output is what falls out of that arrangement.

## How the queue works

Saturday morning is filing-day. I sit down with coffee and write GitHub issues. Each one is a sharply scoped piece of work the engine needs next. The shape is roughly:

- One subsystem or one feature per issue
- A clear acceptance criterion the agent can self-check
- Pointers to the relevant docs, the spec, and any existing files the work should touch
- An explicit "agent-queue" label

There is also a nightly workflow (issue #37 in the runtime repo this weekend) that ensures the queue never drops below fifteen open agent issues. If it does, the workflow drafts placeholder tasks from the roadmap. The agent reads the queue, picks the next one it can do, opens a draft PR, iterates, and eventually marks itself ready for review.

Saturday into Sunday I review and merge. Where the agent got something wrong, I close the PR, sharpen the issue, and re-file. Where the agent did it right, the PR lands and the issue closes. The rhythm is filing at the start of the weekend, reviewing through both days, and leaving a fresh queue behind when the laptop closes Sunday night. The agent grinds on the queue while I am back at the day job.

That is the workflow. It is not subtle. The reason it is worth writing down is that it works.

## What got built

The headlines from the 282 commits:

- A real runtime main loop, not just a skeleton
- A latency tracker that measures end-to-end timing from sensor input to render
- A memory-usage monitor with configurable thresholds and periodic reporting
- A logging subsystem with INFO / WARNING / ERROR levels, console and file outputs
- Error handling with signal handlers for graceful shutdown
- A C API exposing the runtime so the SDK can link against it
- A module / agent management system in the C API for SDK integration
- The runtime concurrency model: task queues and worker threads
- A comprehensive test harness
- ABI verification and SDK linkage validation
- AR1+ smart-glasses spec finalized as the product target

None of that is glamorous. All of it is what an AR runtime needs before any of the interesting stuff can be built on top.

The most important commit, in retrospect, is the C API exposure. The moment the runtime had a stable public surface the SDK could link to, the runtime work and the SDK work stopped tripping over each other. Before that commit, every change in one repo had to be carefully synchronized with the other. After it, they decoupled. Two streams of agent-authored work could run in parallel without producing merge conflict.

## What surprised me

Three things.

**The agent is faster at boring infrastructure than I would have been.** Telemetry, logging, error handling, test harnesses. These are the kinds of tasks where a human gets distracted because the work is unglamorous. The agent does not get distracted. It just lands the diff.

**The agent is conservative on architecture.** Hand it an issue that says "implement a latency tracker that measures sensor-to-render time," and it builds exactly that. It does not invent a metaphysics for what latency means or propose a different shape for the API. That is good. Architecture is my job. Implementation is the agent's job.

**Queue refill is the bottleneck.** When the agent ships fifteen PRs in a day and the queue is empty by evening, throughput stops being about how fast the agent works. It starts being about how fast I can articulate the next set of tasks. That has reshaped Saturday mornings. The first hour is filing.

## What broke

Two things, neither fatal.

The CMake build broke twice when the agent landed code that compiled in isolation but did not link against the rest of the runtime. Both times the fix was the same: the agent does not yet have full visibility into the link-time graph of the project. The fix is in the issue framing. From now on, every issue that touches a library says explicitly which other libraries link against it.

The test harness was added late in the run and immediately surfaced four bugs in earlier PRs that had passed manual smoke tests but failed the new harness. The lesson there is the unsexy one: write the tests as part of the feature, not as a follow-up. The agent does this when the issue says to. It does not when the issue does not. Make it always say to.

## What I want partners and builders to know

The shape of this engine is being built right now. By the end of next month most of the foundational decisions will be set. If you are at a model lab and you have opinions about how the AI layer should plug in, this is the window where opinions are cheap to incorporate. If you are a developer thinking about Unity or Unreal integration, the SDK is being shaped this weekend and the bindings reflect what the runtime can do. I would rather hear from you in week six than week sixty.

The runtime repo is open. The SDK repo is open. The queue of open issues is open. Watching this happen in real time is the whole point.

282 commits, first weekend on the public log. Sunday in the bank. Monday next.

<div class="post-cta">
<h3>Shape the runtime while opinions are cheap</h3>
<p>The foundational decisions are happening right now, in the open - if you build models or build glasses, this is the window to plug in.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/llm-makers.html">For AI Labs</a>
<a class="cta-btn cta-secondary" href="/developers/">For Developers</a>
</div>
</div>
