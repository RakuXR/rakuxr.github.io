---
title: "One Saturday Before the First Commit"
date: 2025-08-23
author: Kevin Griffin
tags: [design, pre-build, ar-glasses, patents, weekend-build]
description: "A reflection from the last Saturday before the repos open. Three months of design work behind me. The agent roster locked. The demo suite specified. The SDK folder structure drawn. The API surface drafted. The patent estate ready to be the foundation. One Saturday from now I open the runtime repo."
series: learning-to-code-with-ai
slug: one-saturday-before-the-first-commit
---

This is the last Saturday before the first commit goes in. Next weekend the runtime repo opens. The SDK repo opens. The docs repo opens. The agents start working through the issue queue. The actual code begins.

That sentence has been a year coming. The patent estate underneath this product has been a decade coming. The thing I want to write down before the work shifts from design to implementation is what I have learned from the last three months of pre-build work, because the lessons here are the ones the codebase will reflect for the next two years.

## What got done in three months of no code

A list, because writing it down forces honesty.

**The agent roster is settled.** Ten agents in defined roles. Product, SDK, Studio, Marketing, Operations, AI and Data Strategy, Codex Dev sub-agent, Developer Relations, Strategic Partnerships, Agent Governance over the whole thing. Each one has a system prompt, a tool set, and a set of interactions with the others. The roster is documented in a place that the agents will read at the start of every session.

**The demo suite is specified.** Eight canonical demos. Each one has a written description, a list of capabilities it has to demonstrate, an estimated complexity, and a place in the SDK folder where it will live. Studios that ask "what is this for" will get a working example that maps to their use case.

**The SDK folder structure is drawn.** Apps. Modules. Assets. Docs. Config. Each top-level folder has a defined purpose. Each sub-folder has a clear convention. Code that comes in over the next year will land in the right place because the right place exists.

**The module API surfaces are drafted.** HUD renderer. Gesture input. Gaze tracking. Multiplayer sync. Overlay animator. Voice control. Each module's public surface is sketched in pseudocode. The agents will replace the pseudocode with real implementations against a stable contract.

**The hardware target is locked.** The AR1+ smart-glasses spec is finalized as the engine's primary target. Latency budgets. Thermal envelopes. Sensor capabilities. The spec is a forcing function for every architectural decision downstream.

**The patent estate is documented and audited.** The decade-old eyeglasses-form-factor IP that anchors this product has been re-read, the continuations have been reviewed with counsel, and the public framing of which inventions are claimed is consistent. The IP is the foundation. The codebase is what gets built on it.

**The public engineering log is queued.** This blog goes live next Saturday with the first regular cadence post. The four entries above this one are the public version of the design work that happened over the summer. From here forward the cadence is weekly.

## What I have learned about the agent-driven workflow before doing any of it

Most of what I think I know is going to turn out to be wrong. That is the honest first observation. Three months of designing a workflow on paper is not the same as running a workflow in production. The first month of real code will surface things I did not anticipate.

That said, a few hunches that I am willing to commit to.

**The agents will be better at the boring parts than at the novel parts.** Telemetry plumbing, build configuration, test harnesses, documentation sweeps. These are tasks the agents will land cleanly because the patterns are well-defined. Novel architectural calls (a new subsystem boundary, a new threading model, a new API surface) are tasks the agents will struggle with because the patterns are less defined. The right division of labor is to keep the architectural work mine and to delegate the implementation work to the agents.

**The framing work is going to be the actual work.** An issue framed loosely produces a PR that is loosely correct. An issue framed precisely produces a PR that is precisely correct. The skill that will compound the most over the next year is being good at framing the issues that the agents pick up. Most of my Saturday mornings, I expect, will go into that framing.

**Review is going to be the bottleneck.** Five agents producing PRs in parallel will saturate any single human reviewer in about a Saturday. The defenses are smaller queue depth, agent-on-agent review for first-pass comments, and a discipline of refusing to merge what I have not actually read. I have written that discipline down. We will see how it survives contact with a hundred-PR Saturday.

**The agents will write stubs that pass tests.** The thing I am most worried about is the failure mode where an agent's implementation returns a placeholder value, the test happens to pass against the placeholder, and the codebase grows a lie about what it does. I have written the audit pattern for this and committed to running it on a cadence. Whether the cadence holds against the temptation to skip audits is the open question.

## Why the patents matter for what comes next

I want to write down something specific about the patent estate because it is the part of this project that is most often misunderstood.

The patents are not a defensive moat against a known competitor. There is no incumbent in the spatial-AR-glasses category yet. The patents are not a litigation strategy. We are not in the business of suing.

What the patents are is permission. The eyeglasses-form-factor work that I and my collaborators filed more than a decade ago covers the architectural patterns that make modern AR glasses possible. Those patterns are now table-stakes for anyone building in the category. Having filed first means we have the freedom to operate that latecomers do not, and the credibility with partners that latecomers cannot manufacture.

The codebase that opens next Saturday is built on that permission. Every architectural decision downstream gets to assume that the foundational IP question is settled. That is a quieter kind of advantage than a moat. It is also a more durable one.

## What I am taking into next Saturday

A short list. The kind of intentions you set the day before something serious starts.

- Open the runtime repo with a clean README and a clean spec link. The first commit should be the one I want the eventual archeology to find.
- File the first ten issues on the agent queue. Each one sharply scoped. Each one tagged. Each one with an acceptance criterion the agent can self-check.
- Start the public engineering log with the kind of post that signals the cadence: honest, specific, unsentimental.
- Do not write any code by hand that an agent could write. The agents are the team. Use them.
- Do not let the agents touch anything architectural without my framing it first. The architectural calls are mine.
- Close the laptop at a reasonable hour. This is a marathon, not a single sprint.

## A note to anyone reading the public log later

The blog goes live next weekend. The entries above this one are the design-doc retrospective. The entries from next weekend onward are the live engineering log. The cadence is weekly. The voice is honest. The discipline that the workflow runs on is the discipline that the codebase will reflect.

If you are at one of the AI labs and you are reading this in the future, the engine you are looking at was designed before any code was written, by someone who knew what he wanted the workflow to look like and built the codebase to fit the workflow. That is the difference between this engine and the dozen other engines that started in 2025.

If you are a hardware partner thinking about which engine your devices should ship on, the AR1+ spec the engine targets is real, the demo suite the engine ships with is specified, and the developer story the SDK provides is mapped. Other engines have to retrofit any of that. This one does not.

If you are a developer thinking about building on this eventually, the SDK is being designed with you in mind. Eight demos that map to eight categories of product. A folder structure that will not change underneath you. An API surface that locked before the implementation started.

If you are a competitor reading this, the design phase is over. The build phase starts next weekend. I would rather you knew that than be surprised by it.

One Saturday from now, the first commit. Today, the last Saturday of pure design work. The next time I write this blog, the code will have started.
