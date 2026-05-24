---
title: "The Weekend an Autonomous Agent Shipped Ten Subsystems"
date: 2026-01-04
author: Kevin Griffin
tags: [foundation, dev-workflow, ai-native, history, weekend-build]
description: "Opened the laptop Saturday morning and the runtime repo had taken 139 commits overnight. By Sunday evening an autonomous coding agent had shipped ten foundational subsystems. The engine's foundation is being built BY agents, in a workflow that treats agent-authored diffs as a first-class part of the dev loop."
series: learning-to-code-with-ai
slug: foundation-built-by-agents-not-for-agents
---

Opened the laptop Saturday morning. The runtime repo had taken 139 commits overnight. Most of them landed by an autonomous coding agent that had been working against a queue of issues I filed last weekend. Ten subsystem-sized pull requests, all ready for review.

When people ask me what it actually looks like to build a 3D runtime with AI agents on the team, they usually assume one of two things. Either the agents are autocomplete dressed up with a chat panel, or they are a feature you add later, once the "real" engine has been built by humans.

Neither is the version I am sitting inside this weekend.

Across Saturday and Sunday the runtime repo took 139 commits. 110 of them were authored by an autonomous agent. 20 were under the founding-era BladeWireless account. 10 were mine. Across those 139 commits, ten subsystem pull requests landed:

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

None of those subsystems are AI. They are the boring, load-bearing pieces a 3D runtime needs to be a 3D runtime. And they shipped across one weekend, in parallel branches, mostly authored by an agent running autonomously while I framed, reviewed, and merged.

This is the post about what it means that the foundation is being built BY agents, not built FOR agents.

## The difference is in every architectural decision

There is a version of this story where you build a "normal" engine the way engines have always been built, and then you add AI on top. The AI lands as a feature. It bolts on. It lives outside the engine because the engine was not designed to host it. That is the dominant pattern in the industry right now, and it is not a wrong pattern. It is just the one you get when you decide what the engine should look like before AI is on the dev team.

When AI agents are on the team from day one, the engine's shape comes out different. Three things change.

**One. Every subsystem ships through code review.** Because agents have to participate in the review loop, the loop has to accept agent-authored diffs. Every PR. Every diff. Every merge. That discipline does not just enable agents. It also turns out to be exactly the discipline you want if AI is ever going to be a runtime primitive instead of an editor feature. The same review pipeline that catches an agent's typo in a culling header will catch the agent's typo in a behavior tree. The pipeline does not care which layer of the stack it lives in.

**Two. Every subsystem has clean public interfaces.** Multiple agents working on multiple subsystems in parallel produce unmergeable conflict every time the boundaries are fuzzy. The remedy is to draw the boundaries hard before anyone writes code. Once the boundaries are hard, the subsystems become addressable from anywhere, which is exactly what you need if you want the engine to host AI behaviors that can call into the rest of the runtime without coupling.

**Three. Every subsystem is independently testable.** A 139-commit Saturday cannot be QA'd by hand. The tests have to ship with the diff or the diff does not land. That is how the human in the loop trusts the diff at all. The side effect is a test surface that lets you swap implementations without rewriting callers, which is the discipline an engine needs to evolve at all.

None of these are AI features. They are dev-process consequences of having agents on the team. The dev process shapes the architecture.

## What the workflow actually looks like

The pattern that produced this weekend:

- I framed which subsystems the engine needed next.
- An autonomous agent ran in parallel across ten branches, each implementing one subsystem.
- Every branch produced a PR with implementation, tests, and docs.
- I reviewed and merged. Where the agent got something wrong, I closed the PR or asked for changes.

What strikes me, sitting here at the end of the weekend, is how much of it is already working. The dev loop is the dev loop. The agent is doing the work I would have hired ten people to do five years ago. I am doing the architectural judgment and the merge decisions. It is a different kind of long weekend than the long weekends I used to have.

The autonomous agent on this particular weekend is not a multi-vendor stack of four assistants. It is a single agent (Copilot's SWE agent) running across many parallel tasks. I expect the multi-assistant pattern to come, and to come fast. The pattern is already here in single-agent form.

## What is hard

Honest about it, because it is genuinely hard.

**Agents are not free.** A 139-commit weekend has a 139-commit review cost. Every PR needs real attention because the subsystems are unfamiliar and I cannot skim them. I am tired. The fatigue is real and worth budgeting for.

**Trusting an autonomous agent on novel work is a skill.** The Copilot SWE agent that shipped most of this weekend's subsystems is good. It is not infallible. The skill is knowing when to merge fast, when to slow down, and when to throw a draft out. I have already merged things I should have rerolled. I am learning by paying the cost.

**The architecture has to be sketched before the agents run.** Hand an agent the prompt "build me a renderer" and you will get a renderer that does not fit the rest of your engine. Hand it "implement an occlusion culling subsystem that exports this C API and integrates with the scene graph through these handles" and you get something that lands cleanly. The framing work is the work. The agent does the typing.

**Tests are non-negotiable.** I almost let one of this weekend's PRs land with thin test coverage. That is a future regression I am quietly committing to fight. The remedy is to make the test requirement part of the agent's prompt from the first line.

## What I am taking away from the weekend

Two observations.

The agents are obviously going to keep getting better. Faster, more accurate, capable of holding more of the engine in one head. That is the easy prediction.

The less easy prediction is what happens to the human role inside this workflow. It is already not the role I trained for as a senior engineer. Less typing, more framing. Less synthesis, more selection. Less "I am the bottleneck on this line of code" and more "I am the bottleneck on the architectural call that decides whether this branch was worth running at all."

That is a different job. It uses different muscles. I think the muscles it uses are unusually fungible across domains, and I think the people who develop them over the next two years are going to look at the rest of the industry the way the industry currently looks at people who still build with no version control.

That is more than enough thinking for one weekend.

Closing the laptop on Sunday night. Back to it next Saturday.
