---
title: "Claude Writes, Gemini Reviews, ChatGPT Rubber-Ducks"
date: 2025-12-06
author: Kevin Griffin
tags: [dev-workflow, multi-vendor, ai-tools, code-review, weekend-build]
description: "Three months into the public log, the dev workflow has settled into a multi-vendor rhythm. Different models do different parts of the loop. Spent this Saturday morning writing down how I divide the work and why the multi-vendor pattern is the one I keep coming back to."
series: learning-to-code-with-ai
slug: claude-writes-gemini-reviews-chatgpt-rubber-ducks
---

Saturday morning, coffee, and the workflow before it changes again. When I tell people I am building an engine alongside autonomous coding agents, the first question is "which agent." The honest answer is "several, in different roles, and the divisions of labor matter." This post is the longer answer.

Right now the dev workflow involves at least three distinct AI vendors playing distinct parts of the loop. The reason is not loyalty or pickiness. It is that each model is genuinely better at a different shape of work, and trying to make one model do everything produces measurably worse code.

## The roles, today

**Claude writes most of the runtime code.** Long-context reasoning across a large codebase, planning before editing, holding a lot of state in one head. This is the model I run on the issue queue for substantive subsystem work. When an issue says "implement an OpenXR composition layer manager and action spaces," Claude is the one that lands the PR.

**Gemini reviews most of the PRs.** Different training, different blind spots. When Claude lands a PR, Gemini reads the diff and pushes back. The kinds of comments Gemini surfaces are different from the kinds I would surface manually. Some are noise. Some are useful. The signal-to-noise is good enough that I trust Gemini as the first reviewer pass on every diff.

**ChatGPT is where I rubber-duck.** When I am stuck on an architectural decision and I do not yet know which way it should go, I think out loud at ChatGPT. The model does not write code in this role. It pushes me on assumptions, suggests three alternative framings, and lets me argue with it. It is the role a senior peer would play if I had one. I do not currently have one. ChatGPT is the simulation.

**Copilot is in the editor.** This is the autocomplete role. When I am writing code by hand (which is less often than people think, but it happens), Copilot is the model whose suggestions I see in the IDE. It is good at the local-context, next-four-lines work.

That is the workflow. Four models, four roles. Each one is better at its role than the others would be.

## Why multi-vendor matters

Three reasons.

**The capability ceiling is different per vendor.** If I were running one model for every role, every weakness of that model would show up as a weakness in the dev process. Claude is excellent at writing. Less excellent at finding bugs in its own writing. Gemini is excellent at finding bugs but it is not the model I would let plan a refactor unsupervised. ChatGPT thinks well about open-ended architectural questions but its code in real subsystems is not what I want shipping. Each one is the best tool for one slot.

**Independence in review is structural.** The single most important rule I have landed on is that the model that writes a PR cannot be the model that reviews it. Self-review is not review. Having a different vendor's model do the first review pass produces independence of architecture, of training data, of failure modes. The bugs Gemini catches in Claude's code are real bugs that would have landed otherwise.

**No single vendor lock-in.** The engine is being built to take direction from any cloud LLM (covered last month in the XRAssistantService work). The dev workflow that builds the engine should match that posture. I do not want the engineering of this runtime to depend on one vendor staying competitive for the next five years. None of them will. The ones that are good now will be good in different ways later. Running a multi-vendor workflow at the dev layer keeps the engineering portable.

## The honest costs

A few.

**Coordination overhead is real.** Switching between vendors mid-task carries cognitive overhead. The fix is to keep each task within one vendor's lane and let the handoff happen between tasks, not within them.

**Bills add up.** Running four model subscriptions is not free. The cost is meaningful, and I am paying it personally for now. The return on it is measurable in shipped subsystems, so the math works at this stage. It will not always.

**Quality drift between vendors is a real issue.** When Gemini gets better at a kind of task that Claude has been doing, the right answer is to move that task to Gemini. The wrong answer is to keep doing it the old way because the old way is what the workflow doc says. The workflow doc has to be revised every few weeks because the model landscape moves under the workflow.

**The vendors do not know about each other.** When Claude writes a piece of code that is going to be reviewed by Gemini, Claude does not know that. When ChatGPT argues an architectural call with me, the eventual implementation by Claude does not see that argument. The integration between the vendors is in my head. That is a fragile place for integration to live, and it is one of the things I would want to fix if I were building infrastructure to help others run this workflow.

## What about the runtime side?

This is the part where the dev-workflow story and the engine story converge.

The XRAssistantService that landed two weeks ago in the runtime is model-agnostic by design. The reason is exactly the same as the reason this dev workflow is multi-vendor. The interface is built so that any of these labs' models can drive an AR experience through the runtime. The lab whose model is the best at any given task gets to provide that task's intent in any given experience.

This is the broader bet: the era of "this product is built on this model from this vendor" is short. The era we are entering is "this product is built around model-shaped capabilities, and which specific model fills which capability slot at any given moment is a configuration choice." The engine has to be ready for that. The dev workflow that builds the engine should reflect it.

## What I want builders and labs to take from this

If you are a coding-agent vendor and you are reading this, the metric I would optimize for is "how often does this agent's PR survive review by an agent from a competing vendor." Self-consistency is not the bar. Cross-vendor review survival is the bar. The agents that do well on that metric will be the ones that get used for serious work.

If you are a developer thinking about adopting an AI-assisted workflow for a serious codebase, do not pick one model and stop. Pick one to write. Pick a different one to review. Use a third to rubber-duck the open architectural calls. The cost premium is real and the quality difference is bigger.

If you are an enterprise leader thinking about AI in your dev org, the multi-vendor pattern is the one that will scale. Single-vendor adoption looks easier on paper. In practice it produces brittleness, both technical and strategic.

Quiet Saturday. The engine got a thirty-five-commit weekend. Most of those commits will be invisible six months from now. The workflow that produced them will not be.
