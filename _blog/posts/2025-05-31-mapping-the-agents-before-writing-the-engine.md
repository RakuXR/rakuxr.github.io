---
title: "Mapping the Agents Before Writing the Engine"
date: 2025-05-31
author: RakuAI Team
tags: [design, agents, governance, pre-build, weekend-build]
description: "Before a single line of the spatial runtime existed, this Saturday mapped the agent fleet that would build it. Product, SDK, Studio, Marketing, Operations, AI strategy, plus a governance layer watching the watchers. This is how you supercharge a one-human team into a shipping engine company - the agents come before the architecture because the agents shape the architecture."
series: learning-to-code-with-ai
slug: mapping-the-agents-before-writing-the-engine
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Org chart of ten AI agents in defined roles with a human at the top and a governance layer over everything" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mapAgents-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="mapAgents-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#mapAgents-bg)"/>
  <text x="600" y="58" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Map the Team Before the Engine</text>
  <text x="600" y="92" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">One human, a fleet of agents, and a governance layer over the whole thing</text>
  <g font-family="system-ui,sans-serif">
    <rect x="510" y="120" width="180" height="50" rx="12" fill="#1a1a33" stroke="#a388ff" stroke-width="2"/>
    <text x="600" y="151" text-anchor="middle" fill="#a388ff" font-size="18" font-weight="700">Human (you)</text>
    <line x1="600" y1="170" x2="600" y2="200" stroke="url(#mapAgents-accent)" stroke-width="3"/>
    <rect x="460" y="200" width="280" height="46" rx="12" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="600" y="229" text-anchor="middle" fill="#00cec9" font-size="16" font-weight="700">Agent Governance</text>
  </g>
  <g font-family="system-ui,sans-serif" font-size="13" fill="#c8c8e0">
    <rect x="70" y="300" width="150" height="44" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="145" y="327" text-anchor="middle">Product</text>
    <rect x="240" y="300" width="150" height="44" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="315" y="327" text-anchor="middle">SDK</text>
    <rect x="410" y="300" width="150" height="44" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="485" y="327" text-anchor="middle">Codex Dev</text>
    <rect x="580" y="300" width="150" height="44" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="655" y="327" text-anchor="middle">Studio</text>
    <rect x="750" y="300" width="170" height="44" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="835" y="327" text-anchor="middle">Dev Relations</text>
    <rect x="940" y="300" width="190" height="44" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="1035" y="327" text-anchor="middle">Marketing</text>
    <rect x="160" y="368" width="200" height="44" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="260" y="395" text-anchor="middle">Strategic Partnerships</text>
    <rect x="500" y="368" width="180" height="44" rx="8" fill="#1a1a33" stroke="#e84393"/><text x="590" y="395" text-anchor="middle" fill="#e84393">Operations</text>
    <rect x="820" y="368" width="200" height="44" rx="8" fill="#1a1a33" stroke="#e84393"/><text x="920" y="395" text-anchor="middle" fill="#e84393">AI &amp; Data Strategy</text>
  </g>
  <text x="600" y="452" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="14">Ten roles, explicit handoffs, drift caught before it compounds</text>
</svg>
<figcaption>The org chart of a workflow where most of the boxes are agents and the connections are automated handoffs.</figcaption>
</figure>

<p class="post-hook">The team that builds your spatial runtime should be designed as deliberately as the runtime itself. RakuAI started with the team shape - one human, a fleet of agents - because the architecture is downstream of who builds it.</p>

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

<div class="post-cta">
<h3>Build the runtime your AI was meant to inhabit</h3>
<p>RakuAI is the AI-native spatial runtime engineered from the team up - see how a deliberate agent fleet builds an engine that LLM makers and glasses makers can trust.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/why-rakuai.html">Why RakuAI</a>
<a class="cta-btn cta-secondary" href="/llm-makers.html">For AI Labs</a>
</div>
</div>
