---
title: "282 Commits in One Weekend"
date: 2025-09-13
author: Kevin Griffin
tags: [foundation, dev-workflow, agent-queue, ar-glasses, weekend-build]
description: "Woke up Saturday morning with a stack of issues queued for the agents and a runtime that needed bones. By the time I sat down this morning, 282 commits had landed across the repos. Most of them not mine. Here is what shipped, and what the workflow looks like when it finally clicks."
series: learning-to-code-with-ai
slug: week-one-282-commits
---

Woke up last Saturday with a stack of issues already filed and an autonomous coding agent ready to grind. By the time I sat down at the kitchen table this Saturday morning to take stock, 282 commits had landed across the runtime repo. I was the author on a small fraction of them. An autonomous coding agent was the author on most of the rest.

The reason the count looks like a sprint week of work is that the work has been happening continuously while I'm not at the keyboard. I am at the keyboard on Saturdays. The agents do not have a day job. The output is what falls out of that arrangement.

## How the queue works

Saturday morning is filing-day. I sit down with coffee and write GitHub issues. Each one is a sharply scoped piece of work the engine needs next. The shape is roughly:

- One subsystem or one feature per issue
- A clear acceptance criterion the agent can self-check
- Pointers to the relevant docs, the spec, and any existing files the work should touch
- An explicit "agent-queue" label

There is also a nightly workflow (issue #37 in the runtime repo this weekendend) that ensures the queue never drops below fifteen open agent issues. If it does, the workflow drafts placeholder tasks from the roadmap. The agent reads the queue, picks the next one it can do, opens a draft PR, iterates, and eventually marks itself ready for review.

I review and merge through the weekend. Where the agent got something wrong, I close the PR, sharpen the issue, and re-file. Where the agent did it right, the PR lands and the issue closes. Repeat for two days straight. Then I close the laptop and go back to the day job, during which the agent grinds on whatever is left in the queue.

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

**Queue refill is the bottleneck.** When the agent ships fifteen PRs in a day and the queue is empty by evening, throughput stops being about how fast the agent works. It starts being about how fast I can articulate the next set of tasks. That has reshaped my Saturday mornings. The first hour is filing.

## What broke

Two things, neither fatal.

The CMake build broke twice when the agent landed code that compiled in isolation but did not link against the rest of the runtime. Both times the fix was the same: the agent does not yet have full visibility into the link-time graph of the project. The fix is in the issue framing. From now on, every issue that touches a library says explicitly which other libraries link against it.

The test harness was added late in the run and immediately surfaced four bugs in earlier PRs that had passed manual smoke tests but failed the new harness. The lesson there is the unsexy one: write the tests as part of the feature, not as a follow-up. The agent does this when the issue says to. It does not when the issue does not. Make it always say to.

## What I want partners and builders to know

The shape of this engine is being built right now. By the end of next month most of the foundational decisions will be set. If you are at a model lab and you have opinions about how the AI layer should plug in, this is the window where opinions are cheap to incorporate. If you are a developer thinking about Unity or Unreal integration, the SDK is being shaped this weekendend and the bindings reflect what the runtime can do. I would rather hear from you in week six than week sixty.

The runtime repo is open. The SDK repo is open. The queue of open issues is open. Watching this happen in real time is the whole point.

282 commits, first weekend on the public log. Back to building before the day job kicks back in.
