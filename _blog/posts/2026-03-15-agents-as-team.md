---
title: "The Bottleneck Was Never Typing"
date: 2026-03-15
author: RakuAI Team
tags: [dev-workflow, ai-native, parallel-agents, worktrees, weekend-build]
description: "Five agents, five branches, one codebase, one weekend: 112 commits. The bottleneck is no longer typing — it is deciding which four problems are worth four parallel attempts, and which two results are good enough to keep. The job stopped being senior IC and became tech lead of a team that never sleeps."
series: learning-to-code-with-ai
slug: agents-as-team-not-agents-as-tool
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="One human directing five parallel AI agents on five branches landing 112 commits in a weekend" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="team-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#team-bg)"/>
  <text x="600" y="62" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">The Bottleneck Was Never Typing</text>
  <text x="600" y="98" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">One human, five parallel agents, 112 commits</text>
  <g font-family="system-ui,sans-serif">
    <circle cx="600" cy="200" r="56" fill="#1a1a33" stroke="#a388ff" stroke-width="3"/>
    <text x="600" y="195" text-anchor="middle" fill="#a388ff" font-size="16" font-weight="800">You</text>
    <text x="600" y="216" text-anchor="middle" fill="#9090b0" font-size="12">framing &amp; selection</text>
    <g stroke="#6c5ce7" stroke-width="3">
      <line x1="560" y1="240" x2="280" y2="340"/>
      <line x1="580" y1="252" x2="460" y2="350"/>
      <line x1="600" y1="256" x2="600" y2="350"/>
      <line x1="620" y1="252" x2="740" y2="350"/>
      <line x1="640" y1="240" x2="920" y2="340"/>
    </g>
    <g font-size="13" fill="#c8c8e0">
      <rect x="200" y="350" width="160" height="58" rx="10" fill="#16213a" stroke="#00cec9"/><text x="280" y="376" text-anchor="middle">WASM ports</text><text x="280" y="396" text-anchor="middle" fill="#9090b0" font-size="11">branch 1</text>
      <rect x="380" y="350" width="160" height="58" rx="10" fill="#16213a" stroke="#00cec9"/><text x="460" y="376" text-anchor="middle">iOS Metal</text><text x="460" y="396" text-anchor="middle" fill="#9090b0" font-size="11">branch 2</text>
      <rect x="520" y="350" width="160" height="58" rx="10" fill="#16213a" stroke="#00cec9"/><text x="600" y="376" text-anchor="middle">Content packs</text><text x="600" y="396" text-anchor="middle" fill="#9090b0" font-size="11">branch 3</text>
      <rect x="660" y="350" width="160" height="58" rx="10" fill="#16213a" stroke="#00cec9"/><text x="740" y="376" text-anchor="middle">Card battle</text><text x="740" y="396" text-anchor="middle" fill="#9090b0" font-size="11">branch 4</text>
      <rect x="840" y="350" width="160" height="58" rx="10" fill="#16213a" stroke="#00cec9"/><text x="920" y="376" text-anchor="middle">Web perf</text><text x="920" y="396" text-anchor="middle" fill="#9090b0" font-size="11">branch 5</text>
    </g>
  </g>
</svg>
<figcaption>Less typing. More triage. The senior role moves from production to selection.</figcaption>
</figure>

<p class="post-hook">AI did not just make typing faster — it moved the bottleneck entirely. The teams that learn to run agents in parallel will look unrecognizable to the ones still waiting on one diff at a time.</p>

The first version of my dev loop with AI was simple. Ask the assistant to do thing A. Wait. Review the diff. Move to thing B. The assistant was a faster pair-programming partner. Still a pair. Still one thing at a time.

That model lasted about three months. It is not how I work now.

What I do now is run multiple AI coding assistants in parallel against the same codebase, each in its own git worktree, each on its own branch, each working on a different problem at the same time. At any given moment there are five to ten active branches across the repos. Different agents pushing on different parts of the engine simultaneously. I review and merge instead of writing and waiting.

The shift in my job is the post.

## What a real weekend looks like

A weekend in mid-March. Across the five repos, 112 commits landed between Saturday breakfast and Sunday dinner. 66 had an AI as the author of record. 47 had me. The rest were merges and review-driven cleanups.

The work was not one project. It was five. WASM ports for nine genres. iOS Metal renderer integration. A content-pack runner with twenty-one assets through a seven-stage pipeline. Card-battle genre stages five through seven. Performance optimizations for the web build. All of it happened across the same two days in parallel branches that landed throughout each afternoon and evening.

No single human types 112 commits in a weekend at a kitchen-table desk. No single human can hold five parallel workstreams in one head and write the code for each of them. The model I had three months earlier could not have produced this weekend.

The model I have now does.

## The bottleneck moves

When work is sequential, the bottleneck is typing. The next line of code does not exist until somebody writes it. AI made that line faster. It did not change which step was slow.

When work is parallel, the bottleneck is selection. Four agents come back with four diffs. Two of them are good. One is in the right direction but needs work. One should not have been written. The slow step is deciding which is which and merging the two that survive.

That is a completely different job from the one I trained for. Less typing. More triage. Less synthesis. More selection.

The shape of the weekend:

- **Saturday morning**: framing. What four problems are worth four parallel attempts. What is the success criterion for each. What is the rough shape of an acceptable answer.
- **Throughout both days**: spot-check. Are the agents on track? Did one of them confidently produce something wrong in the first thirty minutes? Is anyone stuck?
- **Late afternoon, both days**: review and merge. Diffs come in. Read each one with the success criterion in mind. Merge the ones that hit. Reroll or close the ones that did not. Capture what the failed attempts taught me about the problem.
- **End of Sunday**: write down what the weekend shipped and what the next four problems are.

It is more like being a tech lead with a team of four than being a senior IC with a copilot. It uses different muscles. The ones it uses are unusually fungible across domains.

## Where this combines with .raku files

The experience files our engine runs are `.raku` files: JSON, schema-versioned, validatable, reviewable as code. The format was designed with this parallel-agent workflow in mind.

When an agent edits a `.raku` file, the diff shows up the same way a code diff does. A second agent can review the first agent's work. I can run a third agent to spot-check both. The merge call is mine. The whole thing fits inside the same pull-request discipline I use for the runtime.

If `.raku` had been a binary asset, none of this would work. The format choice and the workflow choice are downstream of the same architectural call: experiences are code, dev work is code review, agents participate in the loop because the loop accepts code.

The file format is load-bearing. It is what lets the team scale through agents instead of headcount.

## What works in practice

Three patterns I have settled into.

**One: pair agents on a problem.** When something is non-trivial, two assistants with different training tend to disagree productively. I run them on separate branches with the same prompt, then diff their answers. The disagreements are where the real review attention goes.

**Two: dedicate one agent to review.** I keep one of the four assistants in a review-only role on any given day. It never writes the first draft. It only critiques diffs the others produce. The cost of running a dedicated reviewer is small. The bug-catch rate is significant.

**Three: keep agent context narrow.** A single agent on a single branch on a single problem is fast. A single agent on a sprawling problem with five hours of context drifts and produces lower-quality work. The fix is to break problems into smaller pieces and rotate context frequently.

## What breaks

Honest about what does not work.

**Coordination overhead is real.** Two agents on the same file at the same time produce merge conflicts that I have to resolve. The cost is small per conflict but adds up. Mitigation: keep agents on different files when possible, and accept that the convergence step is part of the workflow.

**Review fatigue is real.** Reviewing four diffs at the end of each day is harder than reviewing four sequential diffs across four days. The decisions are denser. I cut the workday earlier on parallel-agent days than I did when work was sequential.

**The temptation to keep everything is real.** When two agents both produce something reasonable, the lazy move is to merge both. The disciplined move is to pick one. Merging both pollutes the codebase with two ways to do the same thing, which costs more than just rerolling the loser would have.

**Context drift across long-running parallel sessions is real.** A branch that has been open for a day accumulates assumptions the agent made about the codebase at the moment it started. By evening, those assumptions can be stale. The fix is short-lived branches, ruthlessly.

**Not everything parallelizes.** Cross-cutting refactors with subtle invariants want a single careful pass, not four parallel attempts. The skill is knowing which problems split cleanly and which do not. Some days are still sequential days.

## What this means for engineering leaders

If your team is running the sequential model with AI bolted on, the next step up is not "use a better model." It is "use multiple agents at once." The capability ceiling is higher. The skill ceiling is also higher, and it moves the senior role from production to framing, validation, and selection. That is the same direction-of-travel I see in every other discipline running AI well right now.

The teams that figure out parallel-agent workflows over the next two years will look unrecognizable to teams still running the sequential model. The shape of the work is what changes. Not the tooling.

112 commits across two days. Closing the laptop on Sunday with most of them green.

<div class="post-cta">
<h3>Build at the speed of a team of agents</h3>
<p>RakuAI is the AI-native spatial runtime designed for the parallel-agent workflow — experiences as code, review as the loop. See what your team can ship when typing stops being the bottleneck.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/developers/">For Developers</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
