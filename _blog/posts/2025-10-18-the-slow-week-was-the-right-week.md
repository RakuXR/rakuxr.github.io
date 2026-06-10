---
title: "Slowing the Agents Down on Purpose"
date: 2025-10-18
author: RakuAI Team
tags: [reflection, dev-workflow, multi-repo, documentation, weekend-build]
description: "Thirty-seven commits instead of eighty — on purpose. I cut the agent queue and slowed the pace so I could actually read what was landing, and the codebase came out cleaner for it. Here is the discipline that keeps an agent-built runtime coherent instead of a pile of clean-in-isolation PRs."
series: learning-to-code-with-ai
slug: the-slow-week-was-the-right-week
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Commit throughput throttled down on purpose while codebase coherence rises" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="slow-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#slow-bg)"/>
  <text x="600" y="62" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Slowing the Agents Down on Purpose</text>
  <text x="600" y="98" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Fewer commits, more coherence — the bottleneck is human review</text>
  <g font-family="system-ui,sans-serif">
    <line x1="160" y1="400" x2="1040" y2="400" stroke="#9090b0" stroke-width="1.5"/>
    <polyline points="200,180 320,210 440,200 560,300 680,290 800,360 920,355" fill="none" stroke="#e84393" stroke-width="3" opacity="0.85"/>
    <text x="200" y="168" fill="#e84393" font-size="13">commit volume ↓ on purpose</text>
    <polyline points="200,360 320,350 440,330 560,300 680,250 800,210 920,180" fill="none" stroke="#00cec9" stroke-width="3"/>
    <text x="760" y="172" fill="#00cec9" font-size="13">codebase coherence ↑</text>
    <rect x="430" y="420" width="340" height="34" rx="8" fill="#1a1a33" stroke="#6c5ce7"/>
    <text x="600" y="443" text-anchor="middle" fill="#a388ff" font-size="15" font-weight="600">queue depth 15 → 6, review moved earlier</text>
  </g>
</svg>
<figcaption>Thirty-seven well-reviewed PRs beat eighty that drift apart.</figcaption>
</figure>

<p class="post-hook">Faster agents do not build better software — disciplined ones do. The throttle that keeps RakuAI coherent is the same discipline we think every serious agent-driven team needs.</p>

Different plan this Saturday than the last few weekends. The last few have been throughput weekends. Eighty commits, seventy commits, two hundred eighty-two before that. The trend was up. I was riding the agent queue wide open and watching the lines of code pile up.

This weekend I throttled it back to thirty-seven commits on purpose. The trend on this graph is now down, and it is down on purpose, and I want to write about why because I do not think this is the trend most people building with AI agents would expect.

## What is true about the workflow

The agents do not get tired. Throughput from the implementation layer is bounded by token cost and by how many issues are open on the queue. If I file a hundred issues at six in the morning, the queue empties and refills all day and I get a hundred PRs back. That is what the workflow does when it is allowed to run wide open.

What it does not do, when run wide open, is produce a coherent codebase. Each PR lands clean in isolation. The intersection of forty PRs landing in one day starts to drift. Naming conventions diverge. Subsystem boundaries get fuzzy. The agent that worked one issue assumed something about the runtime layer that the agent on a parallel issue did not. by Saturday evening the two assumptions have collided in a third PR that has to reconcile them, and the reconciliation is slop.

The bottleneck in this workflow is not the agent. It is the human reading what the agents produce and keeping the architecture coherent.

## What I changed

Two things, both visible in the commit pattern this weekend.

**I cut the queue depth.** Instead of fifteen open agent-queue issues at all times, I dropped it to six. The agents are no longer running wide open. They are running at a pace that lets me actually read their output before the next batch lands.

**I moved review earlier.** Instead of letting agent PRs sit until I had a batch to work through, I switched to reviewing each one when it opened. This sounds slower, and it is. It also catches drift before it propagates. A bad assumption corrected early Saturday does not need to be unwound by Saturday evening across six PRs.

The combined effect of these two changes is the thirty-seven-commit weekend instead of an eighty-commit weekend. The combined effect is also a codebase that is in better shape than it was last Saturday, which is the point.

## What still landed

A multi-repo discipline got firmer this weekend. The runtime, the SDK, and the docs repo all moved together. The runtime got the documentation-directory overview in the README. The SDK got the corresponding cross-references. The docs grew. None of the three repos got ahead of the others.

This matters because in an agent-driven workflow, the docs are not just docs. The docs are the input the agent reads when it picks up the next issue. If the docs lie about what the runtime supports, the agent will faithfully write code for the lying version of the runtime, and that code will not compile against reality. The remedy is to keep all three repos honest, all the time, even when one of them is the one you would naturally work on.

The other quietly important thing this weekend was the API surface clean-up. A few APIs that had been added in the September rush turned out not to belong on the public surface. They were demoted to internal. The agents handled the demotion across the SDK in one PR. That is the kind of refactor that, done by a single human, takes a full day. Done in this workflow, it takes one issue and one PR and a careful review.

## What "best practices" mean in this workflow

A short list, sharpened this weekend by the experience of cutting the pace.

**Documentation is dev input, not dev output.** If the docs are bad, the work is bad. Maintain them like you maintain code. Review them like you review code. Refuse to merge a feature whose docs got skipped.

**Boundaries between subsystems are sacred.** The agent will not invent boundaries that the codebase did not already have. If you want a boundary, you have to draw it, label it, and refuse the PRs that violate it.

**Cross-repo synchronization is a first-class task.** When the runtime and the SDK have to move together, the PR description has to say so, and the merge of one is gated on the merge of the other. Two-repo state-divergence is one of the easier failure modes to avoid and one of the more painful to recover from.

**Slow down on purpose.** The agent does not. You have to. The weekend the agent ships a hundred PRs is not the same weekend the codebase improves by a hundred PRs worth of value. The weekend the agent ships thirty-seven well-reviewed PRs might be.

## What partners might find useful

If you are building anything with autonomous coding agents and you are running into the "the agents work fast and the codebase is a mess" version of this workflow, the answer is not better agents. The answer is a smaller queue, an earlier review pass, and documentation that the agents read as input.

If you are an AI lab tuning a coding agent for autonomous-PR workflows like this one, the metric I find most useful in practice is not lines-of-code-shipped per day. It is how often a PR landed early in a week has to be rewritten later the same weekend because the codebase moved underneath it. The lower that number, the better the agent is at the actual job.

Thirty-seven commits. A better codebase than I had last Saturday. Saturday afternoon and I am going to go for a walk.

<div class="post-cta">
<h3>Build with agents without building a mess</h3>
<p>RakuAI is built by autonomous coding agents under hard architectural discipline. If you're running agent-driven workflows on a serious codebase, see how we keep the runtime coherent.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/developers/">For Developers</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
