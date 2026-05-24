---
title: "Every LLM Caller Got Prompt-Length Guards Today"
date: 2026-04-11
author: Kevin Griffin
tags: [llm, security, audit, guardrails, weekend-build]
description: "A 15x cost spike led to an audit of every place the runtime talks to an LLM — and five callers that could send unbounded prompts with no cap, no truncation, no defense. By Saturday afternoon every caller went through one shared guard, with per-call budgets, telemetry, and a CI check that blocks regressions. This is how a spatial runtime makes prompt-length discipline impossible to forget."
series: learning-to-code-with-ai
slug: prompt-length-guards-on-every-llm-caller
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Unbounded LLM prompts capped by a shared call guard with per-caller token budgets" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="plg-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="plg-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#plg-bg)"/>
  <text x="600" y="64" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Every LLM Caller, One Guard</text>
  <text x="600" y="100" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Per-caller token budgets, truncation hierarchy, telemetry, CI enforcement</text>
  <g font-family="system-ui,sans-serif">
    <rect x="110" y="160" width="300" height="130" rx="16" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="260" y="212" text-anchor="middle" fill="#ff7aa8" font-size="40" font-weight="800">UNBOUNDED</text>
    <text x="260" y="250" text-anchor="middle" fill="#9090b0" font-size="16">5 callers, no length cap</text>
    <rect x="790" y="160" width="300" height="130" rx="16" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="940" y="212" text-anchor="middle" fill="#00cec9" font-size="40" font-weight="800">CAPPED</text>
    <text x="940" y="250" text-anchor="middle" fill="#9090b0" font-size="16">budgeted, logged, bounded</text>
    <rect x="500" y="195" width="200" height="60" rx="12" fill="#1a1a33" stroke="url(#plg-accent)" stroke-width="3"/>
    <text x="600" y="232" text-anchor="middle" fill="#a388ff" font-size="18" font-weight="700">LLMCallGuard</text>
    <polygon points="500,225 478,214 478,236" fill="#a388ff"/>
    <polygon points="700,225 722,214 722,236" fill="#00cec9"/>
    <line x1="410" y1="225" x2="500" y2="225" stroke="#a388ff" stroke-width="3"/>
    <line x1="700" y1="225" x2="790" y2="225" stroke="#00cec9" stroke-width="3"/>
  </g>
  <g font-family="system-ui,sans-serif" font-size="13" fill="#c8c8e0">
    <rect x="150" y="360" width="180" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="240" y="385" text-anchor="middle">Truncate &amp; log</text>
    <rect x="350" y="360" width="200" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="450" y="385" text-anchor="middle">Coarse fallback</text>
    <rect x="570" y="360" width="180" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="660" y="385" text-anchor="middle">Fail loud</text>
    <rect x="770" y="360" width="200" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="870" y="385" text-anchor="middle">CI regression gate</text>
  </g>
</svg>
<figcaption>One shared guard turns silent cost-amplification into a loud, bounded failure.</figcaption>
</figure>

<p class="post-hook">An unbounded prompt is a cost-amplification attack waiting to happen. RakuAI treats prompt-length discipline as security infrastructure — enforced at the build, not left to memory.</p>

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

A small piece of infrastructure landed Saturday morning and got applied to every caller across the day.

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

<div class="post-cta">
<h3>Build on a runtime that guards every LLM call</h3>
<p>RakuAI is the AI-native spatial runtime your model drives in production — with prompt-length budgets, telemetry, and CI enforcement baked into the boundary. See what disciplined infrastructure unlocks for your stack.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/llm-makers.html">For AI Labs</a>
<a class="cta-btn cta-secondary" href="/developers/">For Developers</a>
</div>
</div>
