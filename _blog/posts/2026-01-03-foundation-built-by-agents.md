---
title: "Foundation Built BY Agents, Not Foundation Built FOR Agents"
date: 2026-01-03
author: Kevin Griffin
tags: [foundation, dev-workflow, ai-native, history]
description: "The week before AI subsystems landed in the runtime, an autonomous agent shipped ten foundational engine subsystems in a single Saturday. The foundation that made AI-as-runtime-primitive possible was already being built BY agents, before AI was a primitive at all."
series: learning-to-code-with-ai
slug: foundation-built-by-agents-not-for-agents
---

When people read Series #1 and ask how the engine got into a state where AI could land as a runtime primitive instead of a bolt-on, the assumption underneath the question is usually that the foundation was built one way, and then AI was added on top of it.

That is not what happened.

The foundation was built BY agents, before there were any AI subsystems in the runtime to call. The dev workflow forged in late 2025 and early 2026 was already parallel-agent shaped. The architectural decisions, the modularity, the code-review-as-design discipline, the boring infrastructure that makes the rest of the engine possible. All of it was being shipped by AI agents working alongside one human, in a workflow that looked like every parallel-agent pattern Series #4 described, except without any of the runtime AI Series #1 talked about.

This is the prequel.

## A Saturday before the AI subsystems landed

Saturday, January 3, 2026. The runtime repo took 139 commits that day. 110 of them were authored by an autonomous agent. 20 were under the founding-era BladeWireless account. 10 were mine.

Two days later, the AI subsystems integration commit landed in the runtime. The post that became Series #1 of this series is about that moment. But Series #1 starts mid-story. The interesting question is what was happening 48 hours before.

Ten subsystem pull requests merged on that Saturday. The boring, load-bearing subsystems an engine needs before AI has anything interesting to do.

- Skeletal animation system
- Runtime scene editing API
- Scene serialization
- Occlusion culling
- Level streaming
- Prefab system
- GPU particle systems
- Advanced rendering
- Terrain and environment systems
- Post-processing pipeline

None of those subsystems are AI. None of them mention models or behaviors. They are the foundation a 3D runtime needs to be a 3D runtime. And they shipped on a single Saturday, in parallel branches, mostly authored by an agent running autonomously.

## What that meant for the AI work that followed

Here is the thing most engine teams misjudge. They imagine a sequence: build the engine, then add AI. The AI is a feature you tack on.

When you build the foundation that way, AI lands as a feature. It bolts on. It lives outside the engine because the engine was not designed to host it. That is the factory pattern Series #1 was about.

When you build the foundation with parallel AI agents already on the team, the engine's shape comes out different. Three things change.

**One. Every subsystem ships through code review.** Because agents have to participate in the review loop, the loop has to accept agent-authored diffs. Every PR. Every diff. Every merge. That discipline does not just enable agents. It also turns out to be exactly the discipline you need when AI is a runtime primitive and `.raku` files get reviewed the same way code does.

**Two. Every subsystem has clean public interfaces.** Because multiple agents work on multiple subsystems in parallel, the boundaries between subsystems have to be sharp. Two agents stepping on each other across a fuzzy boundary produces unmergeable conflict every time. The remedy is to draw the boundaries hard before anyone writes code. Those same hard boundaries are what let the AI primitive plug into the engine later without coupling.

**Three. Every subsystem is independently testable.** Because an agent merging a 200-PR Saturday cannot manually QA each one, the tests have to ship with the diff. Tests are how the human in the loop trusts the diff at all. That same test surface is what lets the AI subsystems land two days later without breaking the rest of the runtime.

The foundation was not built FOR agents. It was built BY agents. The difference is in every architectural decision.

## What the actual workflow looked like

The pattern on that January 3 Saturday is the same one I am running now, with refinements. The shape:

- I framed which subsystems the engine needed next.
- An autonomous agent was running in parallel across ten branches, each implementing one subsystem.
- Every branch produced a PR with implementation, tests, and docs.
- I reviewed and merged. Where the agent got something wrong, I closed the PR or asked for changes.

What is striking, reading the history back, is how much was working already. The dev loop was the dev loop. The agent was doing the work I would have hired ten people to do five years ago. I was doing the architectural judgment and the merge decisions.

The autonomous agent on that particular Saturday was not a multi-vendor stack of four assistants the way the workflow looks today. It was a single agent (Copilot's SWE agent) running across many parallel tasks. The four-assistant rotation came later. The pattern was already there.

## Why this matters for the rest of the series

Series #1 said AI is a runtime primitive. That depends on the engine being shaped to receive it.

Series #2 said `.raku` experiences ship as code. That depends on the dev loop already accepting AI-authored code.

Series #3 said the AI primitive does not couple to a specific model. That depends on clean subsystem boundaries that were already enforced by the workflow.

Series #4 said the dev loop runs on parallel agents. That depends on having lived inside a parallel-agent dev loop long enough to know what works.

None of those decisions would have been right if the foundation had been built the old way. The architecture and the workflow co-evolved. You cannot bolt one onto the other after the fact.

## What was hard

Honest about it.

**Agents are not free.** A 139-commit Saturday has a 139-commit review cost. I have been honest in earlier posts about review fatigue. The version of that fatigue at the foundation stage was the worst, because the subsystems were unfamiliar and I could not skim the diffs. Every PR needed real attention.

**Trusting an autonomous agent on novel work is a skill.** The Copilot SWE agent that shipped most of these subsystems is good. It is not infallible. The skill is knowing when to merge fast, when to slow down, and when to throw a draft out. Early on I merged things I should have rerolled. I learned by paying the cost.

**The architecture has to be sketched before the agents run.** Hand an agent the prompt "build me a renderer" and you will get a renderer that does not fit the rest of your engine. Hand it "implement an occlusion culling subsystem that exports this C API and integrates with the scene graph through these handles" and you get something that lands cleanly. The framing work is the work. The agent does the typing.

## What I would do differently

Two things.

**Start the test discipline earlier.** Not every subsystem in those first months shipped with the test coverage it should have. We paid for the gap in regressions later. The remedy is to make the test requirement non-negotiable in the agent prompt from day one.

**Pair agents on the hardest subsystems sooner.** The single-agent pattern works for well-defined subsystems. It struggles on subsystems that touch a lot of the engine at once. The fix is two agents on the same problem with different prompts, plus a third reviewing. That pattern is now standard. It was not standard in early January.

## Where the series goes from here

This is the prequel post. Series #1 through #4 told the forward story. This one tells the foundation it sits on. There is still one more post promised, and it is the inverse of all of this: the honest failure modes. Where the nervous-system pattern does not help, where the interface boundary breaks, where parallel agents make things worse, and where the right answer is the old factory pattern after all.

Coming up next.

Back to building.
