---
title: "Starting the Weekly Cadence"
date: 2025-09-06
author: Kevin Griffin
tags: [foundation, ar-glasses, patents, history, ai-native]
description: "Day zero of the public log: repos live, agents working, and a smart-glasses spec on the desk as the forcing function for every decision downstream. The bet is simple - the most interesting AI experiences are spatial ones, anchored in the real places you stand in. This is the engine being built explicitly to take direction from your model, every frame."
series: learning-to-code-with-ai
slug: day-zero-readme-spec-and-bet-on-ar-glasses
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="The spec as a forcing function feeding the runtime and SDK repos, with AI direction on every simulation step" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="dayZero-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="dayZero-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#dayZero-bg)"/>
  <text x="600" y="58" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Day Zero: README and Spec</text>
  <text x="600" y="92" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">The spec is the forcing function. The repos go live underneath it.</text>
  <g font-family="system-ui,sans-serif">
    <rect x="450" y="130" width="300" height="64" rx="14" fill="#1a1a33" stroke="#a388ff" stroke-width="2"/>
    <text x="600" y="160" text-anchor="middle" fill="#a388ff" font-size="18" font-weight="700">AR1+ Smart-Glasses Spec</text>
    <text x="600" y="182" text-anchor="middle" fill="#9090b0" font-size="13">latency budget - AI surface - sensors</text>
    <path d="M600 194 L600 220 M350 220 L850 220 M350 220 L350 250 M850 220 L850 250" stroke="url(#dayZero-accent)" stroke-width="3" fill="none"/>
    <rect x="220" y="250" width="260" height="60" rx="12" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="350" y="278" text-anchor="middle" fill="#00cec9" font-size="17" font-weight="700">Runtime repo</text>
    <text x="350" y="298" text-anchor="middle" fill="#9090b0" font-size="12">main loop, latency tracker, CI</text>
    <rect x="720" y="250" width="260" height="60" rx="12" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="850" y="278" text-anchor="middle" fill="#00cec9" font-size="17" font-weight="700">SDK repo</text>
    <text x="850" y="298" text-anchor="middle" fill="#9090b0" font-size="12">Unity + Unreal HelloAR</text>
  </g>
  <g font-family="system-ui,sans-serif">
    <rect x="370" y="360" width="460" height="56" rx="14" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="600" y="386" text-anchor="middle" fill="#e84393" font-size="16" font-weight="700">Your model directs the simulation step</text>
    <text x="600" y="406" text-anchor="middle" fill="#9090b0" font-size="13">in the runtime, every frame - not bolted on in an editor panel</text>
  </g>
</svg>
<figcaption>Not a marketing document - a forcing function that every architectural decision downstream points back at.</figcaption>
</figure>

<p class="post-hook">Generative content in a browser is fine. Generative content anchored to the wall of your actual kitchen is the product. This is the engine being built to take direction from your model on every simulation step - day zero, in public.</p>

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

<div class="post-cta">
<h3>Put your model in the real world, every frame</h3>
<p>RakuAI is the spatial runtime built to take direction from your model on the simulation step - not bolted on, but inhabited. See where the AI layer plugs in.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/llm-makers.html">For AI Labs</a>
<a class="cta-btn cta-secondary" href="/smart-glasses.html">For Smart-Glasses Makers</a>
</div>
</div>
