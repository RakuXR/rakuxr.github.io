---
title: "Every LLM Caller Got Prompt-Length Guards Today"
date: 2026-04-11
author: Kevin Griffin
tags: [llm, security, audit, guardrails, weekend-build]
description: "Spent this Saturday auditing every place in the runtime that talks to an LLM. Found that many of them could send unbounded prompts, with no length check, no truncation, no defense against an upstream caller that decided to attach the entire scene state to a request. Added guards to all of them. The audit and the guards are the post."
series: learning-to-code-with-ai
slug: prompt-length-guards-on-every-llm-caller
---

The runtime calls LLMs in more places than I had been tracking. There is the obvious one (the XRAssistantService that drives voice-based AR experiences). There is the less obvious one (the NPC behavior layer, where the brain of an agent in the world is partially an LLM call). There is the least obvious one (development-time tools that have started to creep into the runtime build: schema validators, debug analyzers, an automatic playtest summarizer).

Each of those places has been written independently over the last six months. Each was reviewed at PR time. None of them, until this weekend, had a uniform discipline about prompt length.

This is the post about why that became a problem, what the audit found, and what the new guardrails look like.

## How the problem surfaced

The trigger was a routine cost-monitoring check. Looking at the daily LLM-API spend, one specific dev environment was spending fifteen times what the others were. Same agent count, same test workload, same model. Fifteen times the cost.

Tracing the spike led to the playtest-summarizer code path. The summarizer takes a finished playtest session, packs the relevant scene state into a prompt, sends it to a cloud LLM, and gets back a structured analysis of the session. The function had been written when scenes were small. The "relevant scene state" was a structured summary of what happened. Over time, the summary had grown. A specific dev environment had been running long playtests that produced enormous summaries. The summarizer was sending those summaries unchecked to the model. The model was charging by the token.

The fix for that single caller was obvious. Cap the summary length. Truncate if needed. Log when the truncation happens.

The deeper question was the one I asked next: how many other callers in the runtime have the same vulnerability? I went looking. The audit was the actual work.

## What the audit found

Eleven places in the runtime that call an LLM. Of those eleven:

- Two had explicit length checks and reasonable behavior on overflow (truncate, log, retry with smaller context). These were fine.
- Five had no length check at all. They sent whatever the caller handed them.
- Three had a length check but it was too generous to be useful (a hundred thousand tokens, well above any sane usage but well below catastrophic).
- One was a debug path that should not have been in the production binary at all; it had a length check but it was easily bypassed via a debug flag.

The five with no length check were the urgent ones. They covered: the playtest summarizer (already identified), the NPC behavior brain (potentially huge if an NPC could observe a complex scene), the schema validator (could be handed an arbitrary file), the world-state describer (could describe an arbitrarily large world chunk), and one of the developer-facing diagnostic tools.

Each of these had landed in a separate PR. Each PR had been reasonable in isolation. The aggregated discipline of "every LLM caller has a length cap" had been nobody's job. So nobody had done it.

## What the guards look like

A small piece of infrastructure landed Saturday morning and got applied to every caller during the rest of the weekend.

**A shared `LLMCallGuard` utility.** Every place that talks to an LLM now goes through this utility instead of constructing requests directly. The utility takes a prompt template, a context payload, and a target model. It enforces a length cap (configurable per model, with sensible defaults based on the model's documented context window). It logs the actual prompt length used at INFO level for the budgeted case, at WARNING level when it has to truncate, and at ERROR level when truncation fails to fit the cap.

**Per-caller budgets.** Each LLM caller in the runtime now has an explicit per-call token budget. The budget is below the model's context window because we want to leave headroom for the response and we want to fail loud before the model fails silently. Budgets range from a few thousand tokens (the schema validator) to twenty thousand tokens (the playtest summarizer, with a real cap that prevents the original incident).

**Telemetry.** Every LLM call now records the prompt size, the response size, the model, the budget consumed, and the latency. The telemetry is what lets me notice the next incident before the bill comes.

**A failure-mode hierarchy.** When a caller's payload exceeds the budget, the utility tries a sequence of fixes in order. First, it attempts to truncate intelligently (preserve the most recent context, drop the oldest, keep the system prompt intact). Second, if intelligent truncation still does not fit, it tries a coarser truncation (drop entire sections). Third, if no truncation fits, it fails loudly with a clear error rather than sending an oversized request that the model will reject. The hierarchy means most cases recover gracefully, edge cases fail in an observable way, and no caller ever sends an unbounded payload.

**A CI check that prevents regression.** New code that talks to an LLM has to go through `LLMCallGuard`. The CI scan finds any new direct LLM call that bypasses the utility and flags the PR. The pattern is the same one the security audit used a few weekends ago for admin endpoints: enforce the discipline at the build, not at review.

## What I learned

Three things.

**Discipline that is nobody's job is discipline that does not happen.** The eleven LLM callers had each been reasonable at PR time. The collective behavior had not been reviewed because nobody owned the cross-cutting concern. The fix was to make the cross-cutting concern a piece of infrastructure that every caller has to go through, which makes the discipline impossible to forget.

**Cost is a security concern.** I had been thinking of "unbounded prompts" as a correctness or robustness concern. The dev-environment cost spike taught me to think of it as a security concern. An attacker who can influence the contents of an LLM call from the runtime can run up arbitrary cost on the operator. The same defenses (length caps, budget enforcement, telemetry) protect against both robustness failures and cost-amplification attacks.

**Audit on a cadence.** Today's audit found five vulnerabilities that PR review had missed. The next audit will find others. The discipline of running a scheduled audit pass over a specific cross-cutting concern is the only reliable way I have found to surface the things review misses.

## What partners and builders should take from this

If you are running anything that calls an LLM from production code and you have not audited every caller for prompt-length discipline, do it. The audit is small. The findings are likely. The cost of doing it today is much smaller than the cost of doing it after an incident.

If you are an AI lab building agents that call other LLMs, the metric to optimize for is "does the agent flag when it is constructing an unbounded prompt." Most agents do not. The ones that do are the ones I trust on serious work.

If you are evaluating an engine for partnership and the engine integrates with cloud LLMs, ask about prompt-length discipline. The right answer is "every caller goes through a shared utility, with per-caller budgets, with telemetry, with a CI guard." The wrong answer is "we have not seen that problem yet."

Saturday afternoon. Every LLM caller in the runtime now goes through the same guard. The next audit cadence is on the calendar.

Back to building.
