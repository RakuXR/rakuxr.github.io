---
title: "Starting the Weekly Cadence"
date: 2025-09-06
author: Kevin Griffin
tags: [foundation, ar-glasses, patents, history, ai-native]
description: "First entry in the weekly cadence. A few design-doc Saturdays predate this one, walking through how the agent roster, the demo suite, and the SDK structure got mapped before any code existed. From this Saturday on, the cadence is weekly, the repos are live, and the agents are working."
series: learning-to-code-with-ai
slug: day-zero-readme-spec-and-bet-on-ar-glasses
---

This Saturday starts the regular weekly cadence on this blog. The four entries below this one were the design-doc Saturdays from earlier in the summer: agent roster, demo suite, folder structure, the last reflection before the code began. The cadence from here forward is weekly. The thing the blog is about is not new.

I have been thinking about AR glasses, real-world-anchored spatial experiences, and the right shape for the runtime that drives them for more than a decade. Some of that thinking became patents in the early 2010s, the eyeglasses-form-factor estate that still anchors the IP behind what we're building now. Some of it became prototypes that never saw daylight. Most of it ran in the background while I did other work.

What changed this past year is that the rest of the world finally caught up. Compute is small enough. Optics are good enough. Cloud LLMs are real enough. On-device inference is fast enough. The product that was a decade-too-early idea is, finally, a product you can ship.

So I started shipping. The current run of code is several months in. The commits live in private repos that I am now bringing into the open as I clean them up and consolidate the codebase. This blog is the public record from here forward.

## What the next few months will look like

The shape of this Saturday's plan, as a flavor of what is coming:

- The runtime: a draft AR1+ smart-glasses spec is on the desk this morning. PDF, PowerPoint, and Markdown versions so an LLM can reason about it, a partner can read it, and a designer can review it. The point is the spec, not the format. The format is for the readers.
- A `main.cpp` and a runtime main-loop skeleton, freshly checked in.
- A latency-tracker header and an implementation stub. Latency is going to be the metric that defines this engine.
- A CMake build workflow in CI so every push gets a clean build from a clean machine.
- A Copilot onboarding guide so the agents on the team know how the team works.

The SDK repo got its own scaffolding this Saturday too. An early Unity HelloAR sample. An early Unreal HelloAR sample. Header skeletons for both bindings. A package-publish workflow.

None of that is shippable. All of it is what you need before anything shippable is possible. The pattern of getting both repos moving at the same time, with deliberate coupling at the seams, is going to be a theme.

## Why a smart-glasses spec on day one of going public

The spec is a deliberate thing. Most engines pick a runtime architecture and then go shopping for products that could plausibly ship on it. I am doing this in the other order. The product is AR glasses people wear in the world, and the engine has to be the right shape for that product. So the spec gets written first, even when it is rough.

It is not a marketing document. It is a forcing function. It says what kind of hardware the engine has to run on, what the latency budget is, what the AI surface has to look like in practice. Every architectural decision downstream gets to point at that spec and ask "does this decision serve the spec, or does it serve some other engine I would like to build instead." That second category is where engine projects go to die, and I have stayed out of it before and intend to stay out of it now.

## Why a Copilot Guide on day one

The other deliberate thing this weekend is the Copilot onboarding guide. The first version is rough. It will get rewritten ten times. But the guide exists because the agents are part of the team, and the team needs to know how the team works.

The guide says:

- What the strategy is and which engine we are not building
- Where the roadmap lives
- How issues get filed, picked up, and closed
- What a good PR looks like
- What a reviewer is supposed to do (where the reviewer is sometimes me and sometimes another agent)

The "agents read documentation" framing is not a gimmick. It is the practical reality of running a workflow where the team is one human on weekends and several autonomous coding assistants on continuous duty. If the guide is bad, the work is bad. If the guide is good, the work is correct and the review cost drops.

## Why the public log now

A few reasons.

**The patents are decade-old prior art that nobody talks about because we didn't talk about them.** The eyeglasses-form-factor work that the engine traces back to has been quietly granted and continued for years. I want the public engineering record to point at the actual lineage. Spatial AR is not a new thing somebody picked up last summer. The work goes back.

**Partnership conversations are starting.** Hardware partners, AI labs, studios. Those conversations get sharper when there is a public engineering record they can read instead of a deck. The deck is the cleaned-up version. The blog is the actual version.

**The dev workflow is genuinely new and worth showing.** AI agents on the team from day one of the public phase. Multiple vendors. Parallel branches. Public issue queue. None of that is invented for this project; what is unusual is doing it all at once on something this serious. I want to write it down as it happens, while the lessons are still fresh enough to be honest about.

## What I want partners and builders to take from this

If you are at one of the big AI labs and you read this, here is the pitch. The engine is being built explicitly to take direction from your model. Not bolted on. Not in an editor panel. In the runtime, on the simulation step, every frame. The architectural decisions are happening right now, in public, with an explicit doc trail. If your model gets better at understanding a real physical space the user is standing in, this engine is where it gets to do something with that understanding.

If you are a developer thinking about building on top of this eventually, the SDK is moving in lockstep with the runtime. Unity and Unreal samples are seeded in the SDK repo as of this weekend. They do not work yet. They will. The reason both bindings exist at this stage is so I never get to a moment six months from now where the runtime architecture is locked and the SDK has to deform itself to fit.

If you are watching for the early signal as a consumer, the signal is this: the engine is being built around the assumption that the most interesting experiences are AR experiences in real places, and the AI is what makes those experiences react. Generative content in a browser is fine. Generative content stuck on a wall in your kitchen is the actual product.

Today is a Saturday. The blog is live. Back to building tomorrow.
