---
title: "AI as Nervous System, Not AI as Factory"
date: 2026-01-10
author: Kevin Griffin
tags: [architecture, positioning, ai-native, spatial-computing]
description: "Most engines that say 'AI-native' in 2026 mean they bolted on a chat panel. RakuAI is built differently. AI is a runtime primitive, not a feature next to the engine."
series: learning-to-code-with-ai
slug: ai-as-nervous-system-not-ai-as-factory
---

Most game engines and spatial-computing runtimes that call themselves "AI-native" in 2026 mean roughly the same thing. There is a chat panel somewhere in the editor. There is a button that asks a remote model to generate an asset. The model produces a thing. The thing gets dropped into a project. The runtime, which existed before AI showed up, runs the thing.

That is the factory pattern. A request goes out. An artifact comes back. The engine is the consumer.

RakuAI is not built that way. AI is not a station on the assembly line. It is a primitive in the runtime. Closer in spirit to a nervous system than to a factory. Continuously present, in the loop on every frame, observing, deciding, reacting. Removing it does not remove a feature. It removes the thing that makes the rest of the engine make sense.

This post is the orientation for everything else in this series. If you read one piece on what "AI-native" means at the architecture layer, this is it.

## Two patterns, drawn out

Here is the factory pattern, condensed to its honest minimum:

```python
# Factory: AI produces artifacts. The runtime consumes them.
def author_session(prompt: str) -> Asset:
    response = remote_model.generate(prompt)
    asset = parse(response)
    save_to_project(asset)
    return asset
```

The lifecycle is straightforward. Human types. Model produces. File lands on disk. Runtime loads the file later. The model is a content vendor. The runtime never talks to it after the artifact is delivered. If the model goes offline, you still have a working engine. You just have one fewer place to buy assets.

Now here is the nervous-system pattern:

```python
# Nervous system: AI is wired into the simulation step itself.
def step(world, agents, dt):
    for agent in agents:
        observation = agent.senses.gather(world)        # what is around me
        intent      = agent.brain.observe(observation)  # AI is in the loop
        action      = agent.policy.choose(intent, dt)   # constrained by deterministic rules
        world.apply(action)
    return world
```

Different lifecycle. Every frame, every agent, the model contributes to the next state of the world. The model is not a vendor. It is a participant. Remove it and the simulation stops being interesting in a way no asset library can patch over.

These are two completely different architectures. The choice you make at this layer constrains everything above it.

## What the factory pattern buys you

Honesty first. The factory pattern is real, useful, and shipping today. It buys you four things.

It buys you **velocity** on content. Generating a tree, a building, a level layout, a piece of dialogue. Real productivity wins, and the artifact-on-disk pattern is the simplest way to get them.

It buys you **provider independence**. Because the artifact lives on disk, you can swap which model authored it without changing your runtime. That is a hedge worth having.

It buys you **deterministic playback**. The artifact is fixed once written. Two players in the same level see the same level.

It buys you **a clean failure mode**. If the model is unavailable, the engine still runs. You just author less.

These are real wins. If your product is "tools that help humans make games," the factory pattern is probably the right call. The cost is hidden. It only shows up when you try to do something the factory pattern cannot do.

## What the factory pattern cannot do

The factory pattern cannot make a world that reacts to the player in ways the author did not foresee. By construction, every artifact in a factory-pattern engine was authored before the player arrived. The space of behaviors is the cartesian product of the artifact library and the engine's scripted logic. Big space, but bounded. The boundaries are visible in play within an hour.

The factory pattern cannot give you NPCs that meaningfully reason about a world they have not been pre-scripted in. Plug in an LLM-driven dialogue system and you get a flavor of conversation that is locally compelling and globally inert. The NPC will say new things. The world does not change in response. The dialogue system and the simulation are two trains on parallel tracks. They never meet.

The factory pattern cannot adapt the experience to the actual GPS coordinates of the actual user standing in an actual physical place. That last point is the one I care about most. If you are building real-world-anchored XR, where the experience happens at a specific spot on Earth, you cannot pre-author every possible interaction. The world is too big. The contexts too varied. The player's path too unpredictable. You either react in the loop, or you ship a tour brochure.

This is the structural reason RakuAI is not a factory.

## What "nervous system" buys you, concretely

Three things, in order of how interesting they get.

**One: NPCs that observe before they speak.** When an agent's brain runs every frame, sees the world the player is actually in, and decides what to do based on what it sees, the result is qualitatively different from a dialogue tree with an LLM bolted on. The agent can react to the rain. To the time of day. To the fact that the player has been standing in front of it for ninety seconds without doing anything. None of that is in the dialogue. All of it is in the simulation, and the model is reading the simulation directly.

**Two: experiences that re-form around the place they are happening in.** The engine itself queries the model. Given this terrain, this weather, this time of day, this set of nearby points of interest, what should the next encounter look like. The experience is no longer a recording. It is a function of the player's actual context. Two players in different cities playing the same .raku experience get different play sessions, and both are coherent.

**Three: behaviors that emerge from the architecture.** This is the one that surprised me when it started showing up. When AI is a primitive, when every system in the engine can call out to it and have its decisions shaped by it, the systems start interacting in ways no single subsystem author designed. An agent that observes terrain influences the pathing system. Pathing influences crowd behavior. Crowd behavior becomes input to the next agent's observation. Loops form. Some of them are interesting. The interesting ones are why anyone bothered with this architecture in the first place.

## The cost, paid up front

The architecture has a price, and it is not small.

You pay for **on-device inference**. AI that runs on the simulation's critical path cannot make a network round-trip every frame. That means model weights live on the device. It means quantization, batching, careful memory budgeting, and a deployment story that contemplates the player's hardware. RakuAI is built around this constraint. Small models, on device, near the hot loop. The constraint is real and architectural.

You pay for **reliability discipline**. A model that hallucinates inside a content factory produces a weird tree. A model that hallucinates inside the simulation step produces a weird *world*. The contracts between the model layer and the deterministic layer have to be designed, validated, and audited. This is not an afterthought. It is the work.

You pay for **observability you do not get for free with traditional engines**. When AI is a participant in every frame, you need to see what it is doing, when, with what inputs, producing what outputs. Logging. Tracing. Replay. All the things you would build for any distributed system, except now they live in the simulation loop.

These costs are why most engines pick the factory pattern. The factory pattern is genuinely cheaper to build. It is also genuinely less interesting, in a way that becomes visible only after you have spent time inside an engine that made the other choice.

## Where this series goes from here

This is post one in *Learning to Code with AI*. The series is about building production software side by side with AI agents, written from the inside of a project that took the nervous-system bet. Future posts will go into:

- How the runtime exposes the AI primitive to subsystems without coupling them to a specific model.
- The .raku file format. Structured experience definitions that validate, version, and ship like code, with explicit hooks for runtime AI.
- What changes in the dev loop when the architecture itself depends on AI being present.
- The honest failure modes. Where the nervous-system pattern does not help, and where the factory pattern is the right answer for a given problem.

If you are building a game, an XR experience, or any other interactive system in 2026, and you are wondering whether the AI question is "which model do I integrate" or something deeper, this series is written for you.

The short version of the answer: it is something deeper. You can feel it the first time you try to make the factory pattern do something it was not built to do.

The long version is the rest of this series.
