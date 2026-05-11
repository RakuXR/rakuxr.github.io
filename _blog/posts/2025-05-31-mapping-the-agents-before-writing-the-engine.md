---
title: "Mapping the Agents Before Writing the Engine"
date: 2025-05-31
author: Kevin Griffin
tags: [design, agents, governance, pre-build, weekend-build]
description: "Three months before the first line of runtime code, this Saturday went into mapping the agents that would build it. Product, SDK, Studio, Marketing, Operations, AI strategy, plus a governance layer over the whole thing. The agents come before the architecture because the agents shape the architecture."
series: learning-to-code-with-ai
slug: mapping-the-agents-before-writing-the-engine
---

This Saturday went into a whiteboard exercise that anyone watching would think was premature. The product is a long way from shipping. The engine is not a repo yet. There is no code. There is no demo. There is a hardware roadmap, a patent estate that goes back over a decade, and a clear thesis about what the next generation of AR glasses should be. And here I am, sitting at the kitchen table, mapping out the agents that will build this thing.

That is on purpose.

## Why the agents come first

The conventional move at this stage of a project is to start writing code. Open the repo. Build the proof-of-concept. Hire engineers when the PoC starts asking for help. Ship the MVP. Iterate.

I have built three companies along the conventional path. I have decided this one is going to be different. The team that builds this engine is going to be one human and a fleet of AI agents working in defined roles. The architecture of the engine, the shape of the SDK, the discipline of the code review, the cadence of the dev loop, all of those are downstream of the team shape. If I do not figure out the team shape first, I will end up with an engine that was built for a different team than the one that actually has to build it.

So today is team-shape day.

## The roster

The agent roster I am settling on, with the role each one is supposed to own.

**Product Agent.** Owns the spec. Tracks hardware updates, vendor roadmaps, SDK dependencies, the public release calendar. The Product Agent is the canonical source of truth for what the engine is supposed to do. Other agents check their work against the Product Agent's read of the spec.

**SDK Agent.** Owns the SDK itself. Documentation, onboarding flows, compatibility tests, package publishing. The SDK Agent is the agent that developers will interact with most often, in the form of generated docs, sample apps, and onboarding error messages. Its output has to feel like a real developer-relations function.

**Studio Agent.** Owns outreach to game studios and indie developers. Demo prep. Co-marketing collateral. Onboarding docs targeted at studios specifically. The Studio Agent's metric is conversion: a studio that talked to us and then shipped something on the engine. That metric is far in the future and the Studio Agent's day-to-day is the slow accumulation of relationships that produce it.

**Marketing Agent.** Owns the public-facing surface. Press kits. Kickstarter assets if that path makes sense. Influencer tracking. Hardware event collateral. A/B testing on landing pages. This agent's output is the thing the world sees first. It has to be good.

**Operations Agent.** Owns the cadence. Stand-ups (with me). Notion / Gantt management. Bottleneck alerts. Executive summaries. The Operations Agent is the agent I check in with at the start of every Saturday to find out what the rest of the agents did during the work week while I was elsewhere.

**AI and Data Strategy Agent.** Owns the data flywheel. Captures telemetry from the SDK and from the glasses. Builds the small language models that will eventually live on-device. Refines the AI moat. This is the agent whose work compounds the most over time, because the data and the models it produces become the differentiator no one can replicate.

**Codex Dev Sub-Agent.** Writes the code. Integrates the runtime APIs. Builds Unity and Unreal demos. Supports the SDK Agent on technical onboarding. This is the autonomous coding agent. It works under direction. It does not set its own priorities.

That is the capstone roster: seven agents in defined roles, with explicit interactions between them.

## The three I am adding

The capstone gets us most of the way there. There are three roles I think are needed but were not on the original draft. Adding them this Saturday.

**Developer Relations Agent.** GitHub issues. Discord. Reddit. The agent that responds when a developer asks a question and the SDK Agent does not have a doc for it yet. This is concierge work. It is also evangelism work. The right person in this role (or the right agent) builds trust with studios and indie devs in a way that no amount of marketing collateral can replicate.

**Strategic Partnerships Agent.** B2B outreach. Licensing conversations. Co-marketing deals with gaming cafes, e-sports venues, anywhere the product could be experienced first by someone other than a studio. This is the agent that goes after revenue channels that are not consumer.

**Agent Governance Agent.** The agent that monitors the other agents. Proposes upgrades. Manages versioning. Handles rollback when an agent makes a bad call. This is the recursion that I think is the actual unlock for this kind of workflow. Without it, the agents drift. With it, they get better over time because someone is watching the watchers.

## What the interaction map looks like

The whiteboard version, simplified:

- Executive oversight (me) sits at the top.
- The Agent Governance Agent sits below me and monitors everything below it.
- Product, SDK, and Codex Dev form one triangle of technical work.
- Studio and Developer Relations form the developer-facing surface.
- Marketing and Strategic Partnerships form the outside-facing surface.
- Operations and AI/Data sit underneath as cross-cutting concerns.

Each agent has explicit interactions with the others. SDK talks to Codex Dev. Studio talks to Marketing. Operations talks to everyone. The Governance Agent watches the whole thing and intervenes when an agent's outputs start to drift from its role.

This is not the org chart of a traditional company. It is the org chart of a workflow where most of the boxes are AI agents and most of the connections between them are automated handoffs. The one human in the chart is at the top, doing the framing and the judgment work. Everyone else is an agent.

## Why this is the right time to do this

Three reasons.

**The engine architecture will be shaped by the team.** Cross-cutting concerns like documentation, testing, and code review have to be designed into the codebase from day one if agents are going to participate in them. If I write the codebase first and then try to fit agents into it later, I will have to do most of the work twice.

**The patent estate gives me the runway to plan carefully.** The patents that anchor this product are decade-old prior art. The competitive timing is not "ship in three months or someone else does." It is "ship the right thing at the right moment, which is closer than it has been at any point in the last ten years but still allows for a planning quarter." I am using the quarter.

**The agents themselves need to be designed.** Each one needs a system prompt, a set of tools, a set of guardrails. Writing the engine before writing the agents means hiring the team after the work has started. That is how engine projects end up with agents shoehorned into roles the codebase was not designed to support.

## What is next

Next Saturday goes into the SDK design. Folder structure, module surface, what the developer interaction looks like with each piece. The Saturday after that goes into the demo suite: what the canonical sample apps are, what they prove, what they teach. By the end of summer the design phase should be done and the actual repo can open.

This is a slow build by traditional venture-pace standards. It will not look slow once it is done.
