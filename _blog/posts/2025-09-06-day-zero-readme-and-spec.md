---
title: "Day Zero: A README, a Spec, and a Bet on AR Glasses"
date: 2025-09-06
author: Kevin Griffin
tags: [foundation, ar-glasses, history, ai-native]
description: "The first commit was a README. Six days later we had a runtime skeleton, a smart-glasses spec, a CI pipeline, and a public commitment to building this thing with AI agents on the team from the start."
series: learning-to-code-with-ai
slug: day-zero-readme-spec-and-bet-on-ar-glasses
---

This is the first entry in what I think will become a public engineering log. So a little context before the technical content.

I am building an AR runtime. The thesis is that the next computing platform is glasses you wear all day, with AI that observes the world you are in and makes the experience react in real time. The engine that drives those experiences does not exist yet in a form I want to build on. So I am building it.

The other thing I am betting on is the workflow. From the first commit, AI agents are on the dev team. Not in the editor as autocomplete. On the team. Picking up issues, writing PRs, asking for review. The version of this engine that ships is the one built by a workflow where agents and a human author code side by side, all the way down to the foundation.

This week I committed to both of those bets in public.

## What landed in the first six days

The very first commit, six days ago: `Create README.md`. The repo was empty before that.

Sitting down to look this morning, the runtime repo has:

- A draft AR1+ smart-glasses spec (PDF, PowerPoint, and Markdown versions so an LLM can reason about it, a partner can read it, and a designer can review it)
- A `main.cpp` and a runtime main-loop skeleton
- A latency-tracker header and an implementation stub
- A CMake build workflow in CI
- A Copilot onboarding guide explaining how an agent should pick up and execute issues against this codebase

The SDK repo got its own version of the same scaffolding: an early Unity HelloAR sample, an early Unreal HelloAR sample, header skeletons for both bindings, a package-publish workflow.

None of that is shippable. All of it is what you need before anything shippable is possible.

## Why a smart-glasses spec on day zero

The spec is a deliberate thing. Most engines pick a runtime architecture and then go shopping for products that could plausibly ship on it. I am doing this in the other order. The product is AR glasses people wear in the world, and the engine has to be the right shape for that product. So the spec gets written first.

It is not a marketing document. It is a forcing function. It says what kind of hardware the engine has to run on, what the latency budget is, what the AI surface has to look like in practice. Every architectural decision downstream gets to point at that spec and ask "does this decision serve the spec, or does it serve some other engine I would like to build instead." That second category is where engine projects go to die, and I am trying to stay out of it.

## Why a Copilot Guide on day zero

The other deliberate thing is the Copilot onboarding guide. The first version is rough. It will get rewritten ten times. But the guide exists because the agents are part of the team, and the team needs to know how the team works.

The guide says:

- What the strategy is and which engine we are not building
- Where the roadmap lives
- How issues get filed, picked up, and closed
- What a good PR looks like
- What a reviewer is supposed to do (where the reviewer is sometimes me and sometimes another agent)

The "agents read documentation" framing is not a gimmick. It is the practical reality of running a workflow where the team is one human and several autonomous coding assistants. If the guide is bad, the work is bad. If the guide is good, the work is correct and the review cost drops.

## What I want partners and builders to take from this

If you are at one of the big AI labs and you read this, here is the pitch. The engine is being built from day one to take direction from your model. Not bolted on. Not in an editor panel. In the runtime, on the simulation step, every frame. The architectural decisions are being made right now, in public, with an explicit doc trail showing the why. If your model gets better at understanding a real physical space the user is standing in, this engine is where it gets to do something with that understanding.

If you are a developer thinking about building on top of this eventually, the SDK is starting at the same time as the runtime. Unity and Unreal samples are seeded in the SDK repo as of yesterday. They do not work yet. They will. The reason both bindings exist at this stage is so I never get to a moment six months from now where the runtime architecture is locked and the SDK has to deform itself to fit. The pull on both ends of the cable is what keeps the cable straight.

If you are watching for the early signal as a consumer, the signal is this: the engine is being built around the assumption that the most interesting experiences are AR experiences in real places, and the AI is what makes those experiences react. Generative content in a browser is fine. Generative content stuck on a wall in your kitchen is the actual product.

Today is a Saturday. The week landed clean. Back to building tomorrow.
