---
title: "Gemini Reviewed Claude's PR. Thirty-Six Comments Later, It Was Better."
date: 2026-03-07
author: Kevin Griffin
tags: [multi-vendor, code-review, gemini, claude, partnerships, weekend-build]
description: "Spent this Saturday working through thirty-six review comments Gemini left on a batch of Claude-authored endpoint expansions. The multi-vendor review pattern earning its keep across eight separate subsystem PRs. Different model, different blind spots, real bugs caught. The pattern that I am most curious about other people's opinions on."
series: learning-to-code-with-ai
slug: gemini-reviewed-claudes-pr
---

The pattern I keep coming back to is the one where Claude writes the code and Gemini reviews it. Different training. Different blind spots. Different opinions about what is a defensible pattern and what is a smell. This Saturday was the most concrete demonstration of why I think this pattern is the right one.

A batch of Phase-2 endpoint-expansion PRs had landed across the API surface over the prior week. Eight separate subsystems each got their public surface expanded. Claude had written most of the implementation. Before merging any of them I ran them through Gemini as a review pass. Gemini came back with thirty-six specific comments across the batch.

I worked through every one. This is the post about what Gemini caught and what it means that the catches were the kind of catches they were.

## What the eight subsystems were

The PRs covered the eight API router modules that needed Phase-2 expansion: animation, network, audio, AI perception, scene constructive-solid-geometry, input action and gamepad bindings, XR anchor pose types, and scripting Lua VM lifecycle. Each PR added between a dozen and forty endpoints, with full request/response schemas, helpers, and tests.

The PRs were not subtle. Each one was a substantial expansion of the public surface. Together they represented several weeks of design work that the agents implemented across roughly two weekends.

## What Gemini caught

I want to be specific because the categories matter.

**Animation and network: blend tree references and helpers.** Gemini noticed that the blend-tree helpers in the animation API and the topology helpers in the network API had subtly different conventions for how they handled missing references. Animation returned a `None`-equivalent and let the caller decide. Network raised an exception. Both are valid patterns. They were inconsistent across two PRs that landed within a day of each other. The fix was to align them; we picked the explicit-exception path because it surfaces the missing reference at the API boundary instead of letting it propagate as a silent null.

**Audio: response model defaults and helpers.** Gemini found that several audio response models had inconsistent default values for optional fields. Some defaulted to empty strings, some to None, some to an explicit `null`. The inconsistency would have produced confusing behavior at the client-binding layer (where different languages serialize each option differently). The fix was to pick a single convention (`None` in the Python types, `null` on the wire) and apply it consistently.

**AI perception: handle maps and bindings.** Gemini flagged a thread-safety concern in the perception subsystem's handle-map: the map was being mutated from a background thread while being read from the API request thread, without a lock. Under load, this would produce intermittent map-corruption bugs that would be very hard to diagnose. The fix was a reader-writer lock with the read path optimized for the common case (lookups vastly outnumber inserts).

**Scene: handle maps and CSG responses.** Same family of bug as the AI perception finding. Gemini caught the same thread-safety concern in the scene subsystem's CSG handle-map. The fix was the same shape: a reader-writer lock. This is the kind of bug that one set of trained eyes flags everywhere because it has seen the pattern; Claude had written the same pattern in two places and not noticed.

**Input: action and gamepad bindings.** Gemini found that the action-binding API was using a magic-number convention for invalid action IDs (`-1`), while the gamepad-binding API used a sentinel struct value. The inconsistency would produce subtle bugs when a developer working across both APIs accidentally used the wrong invalid-marker. The fix was to introduce a typed `ActionId::Invalid` constant in both APIs and migrate all the magic numbers to it.

**XR: anchor pose types and handler reuse.** Gemini caught that the XR API was exposing two subtly different pose types in different endpoints: one in world coordinates and one in anchor-local coordinates. The difference is real and matters to the consumer, but the endpoints did not document the difference clearly. Gemini suggested splitting the types so the type system enforces the distinction. The fix was to introduce `WorldPose` and `AnchorPose` as distinct types with no implicit conversion between them.

**Scripting: Lua VM lifecycle and leaks.** Gemini found that the Lua VM was being allocated per request without a clear teardown path. Under sustained load, this would leak VM state into the address space until the API server fell over. The fix was to introduce a per-server-thread VM pool with explicit acquire and release semantics, and to add a teardown path that runs at request completion regardless of success or failure.

## What I noticed about the catches as a category

Three observations.

**Most of the catches were consistency catches.** Two-thirds of Gemini's comments were "this convention differs from the convention used in another subsystem you just landed." This is exactly the kind of catch a single model is bad at, because each PR landed in isolation and the model writing it did not have the other PRs in context. A reviewer working across the batch sees the inconsistencies that the writer did not have in head.

**A few catches were genuine bugs.** The thread-safety findings on the handle maps were real bugs. They would have shipped. They would have been intermittent and hard to diagnose. Gemini caught both instances in the batch (one in AI perception, one in scene CSG) because it had the pattern recognition for "shared mutable map without a lock = thread-safety concern." Different model, different training, different things it has been calibrated to flag.

**A few were stylistic and got debated.** Not every Gemini comment was right. A handful were stylistic preferences that I either pushed back on or asked for human judgment on. The fact that some comments got rejected does not weaken the pattern; it strengthens it. A reviewer that always agrees with the writer is not a reviewer.

## What this does and does not do

What it does: catch a class of bugs that single-model review misses. Specifically the cross-PR consistency bugs and the pattern-matching catches where a reviewer trained on different data flags something the writer's training did not see.

What it does not do: replace human review. The Gemini comments were a first pass. I read every one. I rejected some. I accepted most. The final merge decision was mine. The pattern is "Claude writes, Gemini reviews, human decides." Not "Gemini decides."

What it suggests for AI labs: the metric to optimize for is not "does the model's own code pass its own review." It is "does the model's code pass review by a different vendor's model." The agents that do well on the cross-vendor metric are the ones I trust on serious work.

## What partners and builders should take from this

If you are running an agent-driven workflow and you are not yet running PR review through a different vendor's model, try it on the next batch. The setup cost is small. The bug-catch rate is non-trivial. Today's batch caught two real thread-safety bugs that would have shipped.

If you are an AI lab and you have not optimized your coding agent for "PR review against another vendor's model" as a target, consider it. The metric is honest. The signal is real. The agents that score well on it are the ones serious teams will adopt.

If you are evaluating an engine for partnership, the multi-vendor review pattern is one of the discipline signals I would ask about. A team that runs cross-vendor review on every meaningful PR is a different team from one that does not. The codebase reflects the difference.

Thirty-six comments, eight subsystems, one Saturday. The batch is better than it was this morning. The pattern earns its keep, again.

Back to building.
