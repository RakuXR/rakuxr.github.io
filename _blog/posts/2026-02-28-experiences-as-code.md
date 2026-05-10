---
title: "Experiences as Code, Not Experiences as Assets"
date: 2026-02-28
author: Kevin Griffin
tags: [architecture, ai-native, raku-files, dev-workflow]
description: "The .raku file is a JSON document. That choice is load-bearing. Here is what a real one looks like, why we picked JSON over a custom DSL, and how the file format becomes the contract between the human author and the AI runtime."
series: learning-to-code-with-ai
slug: experiences-as-code-not-experiences-as-assets
---

AI is a runtime primitive in our engine, not a feature bolted on next to it. That is the architectural argument. This post is about the file format that makes it concrete.

If you build a game on most engines, the artifact you ship is a binary, a project bundle, an asset database, or some combination of all three. What you author lives inside a proprietary editor. What you ship is opaque to the tools your team already uses. Diffing two versions of an experience means firing up the same editor twice and hoping the change log is honest.

We took the other path. A RakuAI experience is a `.raku` file. The file is JSON. You can open it in any editor. You can diff two versions in any code-review tool. You can validate it against a schema. You can version it in git. You can review it in a PR. You can hot-reload it. You can write an experience by hand if you want to.

The file format is not glamorous. It is load-bearing.

## What a real .raku file looks like

The shape, illustrated (specific keys generalized, real schema is more detailed):

```json
{
  "schema_version": "...",
  "game":     { /* surface metadata: title, genre, mode, players, ... */ },
  "ai":       { /* runtime-AI knobs that drive the nervous system    */ },
  "entities": [ /* what's in the world and how each thing behaves    */ ]
}
```

A schema-versioned header. A game block with surface metadata. An `ai` block where the runtime AI is configured at the experience level. An `entities` array describing what is in the world and how each entity behaves.

A few things worth pointing at.

## The `ai` block is the runtime contract

The `ai` block at the file level is where the experience tells the runtime nervous system what kind of experience to be. Difficulty adjustment that adapts to the player in flight. Flow-state targeting. Profiling depth. Music and pacing that respond to what is actually happening. None of those are model invocations. They are knobs on a runtime that is already in the loop on every frame while the player is playing.

A factory-pattern engine could not have these knobs at the file level. There is no runtime AI for the file to address. In an engine where AI is a primitive, these knobs are the contract between the human author and the system that runs the experience.

You can review this block in a PR. You can A/B-test two values in CI. A producer who has never seen an editor can read it and have a conversation with engineering about what each knob means. The file format makes the design decision visible.

## Per-entity AI behavior is a string, not an integration

Each entity in the file can name a behavior the runtime knows how to execute. The shape is roughly `"ai_behavior": "<name>"`. The name is not a model invocation. It is a registered behavior the runtime resolves at load time. The same entity can wear different behaviors across the catalog the runtime ships, and the implementation behind each behavior can be a deterministic tree, a learned policy, or a hand-written heuristic. The file does not import a model. It addresses a capability.

This is how you decouple the file format from a specific model. The author writes intent. The runtime decides which model, which weights, which deterministic fallback to use to deliver that intent. Swap the model out next quarter and the .raku files do not change.

That separation matters more than it sounds. Every team I have talked to that bolted a specific LLM into an engine has had to redo the integration when the model vendor moved. We do not.

## Why JSON

This is the question I get the most when I show the file format. Why JSON and not a custom DSL with a nicer syntax for math expressions and inline scripting and reactive bindings?

Three reasons.

**One: every tool already speaks JSON.** Code review. Diff tools. Version control. Linters. Schema validators. CI pipelines. Static analysis. Every editor on every platform. We did not have to build any of that. We picked it up for free.

**Two: humans read JSON well enough.** The file above is not pretty, but a senior designer can read it without training. Compare that to a DSL that takes a week to learn before anyone can review a PR.

**Three: AI assistants read JSON extremely well.** This one matters more in 2026 than it did three years ago. When a designer asks an AI assistant to "tweak the boss to feel scarier," the assistant can read the file, propose a diff, and the human can accept or reject the diff. A custom DSL would require teaching every assistant a new grammar.

The cost is real. JSON is verbose. It does not have inline math, comments, or shorthand. We give up expressiveness in exchange for tooling ubiquity. So far the trade has paid for itself many times over.

## What this enables

A few things change once your experience is text.

**PR review for game design.** A designer tweaks the difficulty-target knob. The change shows up as a one-line diff in a pull request. Engineering and design review the change together. The conversation in the PR is a record of why the experience plays the way it does. Six months later, when someone asks why the difficulty curve feels the way it does, the answer is in the commit log.

**CI for experiences.** A `.raku` file fails schema validation. The build fails before the change ships. The same CI that runs your unit tests runs your experience definitions.

**Hot reload.** The file changes on disk. The runtime notices. The world updates without a restart. The dev loop tightens to seconds.

**Rollback.** A change broke the boss fight. Revert the commit. The experience reverts. No editor, no asset rebuild, no weeklong round-trip.

**Authoring by AI.** A team member describes what they want in natural language. An AI assistant writes the .raku diff. A human reviewer approves it. The diff is auditable, versionable, and falls under the same review discipline as any other code change.

These are not exotic capabilities. They are what every modern software team takes for granted for the rest of their codebase. We extended them to game design.

## What is hard

The honest costs.

JSON does not have comments. We compensate with sidecar `.md` files for design intent and with descriptive field names, but it is a real friction.

The schema has to evolve carefully. We bumped from `schema_version: 1.0` to `2.0` once when world generation outgrew the original shape. Every existing file in the wild needed a migration path. That work is part of the job, and it is not free.

There is a temptation to keep adding fields. We resist it harder than it sounds. Every field added is a contract the runtime must honor in perpetuity. The bias is to keep the file small and put complexity in the runtime, not in the file.

And finally: text-based experience definitions only matter if the runtime actually does something interesting with them. The file format is downstream of the architectural decision underneath it. If the engine treats AI as a content factory, the file is just a manifest. If the engine treats AI as a runtime primitive, the file is the score.

If you want to read the format end to end, the schema lives in the public docs and the sample files ship in the repo. Pull one open. Read it as code, because that is what it is.

Back to building.
