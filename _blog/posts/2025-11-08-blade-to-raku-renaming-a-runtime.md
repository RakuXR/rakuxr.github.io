---
title: "Blade to Raku: Renaming the Runtime in a Weekend"
date: 2025-11-08
author: Kevin Griffin
tags: [rebrand, naming, ar-glasses, history, weekend-build]
description: "Woke up Saturday with the placeholder name finally ready to come off. By Sunday evening every reference in every repo had been swept from Blade and ar1-runtime to Raku. The brand has been waiting in the wings for years; the engineering finally caught up."
series: learning-to-code-with-ai
slug: blade-to-raku-renaming-a-runtime
---

The runtime had a name when I started building it. The name was a placeholder, the kind of placeholder that lets you stop worrying about naming and start writing code. I knew it was a placeholder when I picked it. The real name was waiting on a few things to settle.

This weekend the placeholder came off. The runtime is now Raku.

## Why now

Three reasons.

**The product target stabilized.** When the runtime was AR1+ and then AR2 Gen1 and then maybe one of three different hardware paths, naming it after the device family did not make sense. Now that the AR pivot is settled, the engine can have its own name that does not depend on which device it ships on.

**Partnership conversations are getting serious.** A partnership conversation that gets serious cannot survive a placeholder name in the codebase. Vendors do not partner with code that calls itself "BladeRuntime" in some files and "AR1+Runtime" in others. The rename is a precondition for those conversations getting any further.

**The brand has to mean something.** Raku in Japanese means ease, comfort, enjoyment. It is also the name of a tradition of Japanese tea ceramics that values irregularity and human touch over machine precision. Both of those are signals about what the engine is for: experiences that are easy to author and that feel human, not mechanical. The kanji 楽 shows up in the logo. The naming choice is not arbitrary. It is the first piece of the company's identity.

## What the rebrand involved

A sweep across the codebase. Two PRs landed the bulk of it in back-to-back agent runs. The agents did the rote work, which is good because the rote work was enormous. Roughly:

- Every reference to "ar1-runtime" in code, docs, and CI changed to "raku-runtime"
- Every reference to "Blade" in branding and packaging changed to "Raku"
- The native runtime library renamed from `ar1plus` to `raku`
- All exported symbol prefixes updated
- All CMake target names updated
- All include-path references updated
- All doc cross-references updated
- All sample-app readmes updated
- Logo and brand assets switched out

Two PRs. Roughly a hundred and ten files touched between them. Both landed without breaking the build, which was the metric that mattered.

## What I learned from doing it this way

Three things, each useful for anyone planning a sweep through an agent-built codebase.

**The agent does the rename faster than I do, but only if the issue is precise.** The issue that produced the bulk of the rename said exactly which symbols change, which paths change, which docs change, and which patterns to leave alone (changelog entries, historical decision logs, archived branches). The agent followed the instructions. The result was a clean rename. The version of the issue I tried two days earlier was less precise, and the rename came back with thirty places where the agent had renamed too aggressively, including references in old commit messages that should have stayed for archeological purposes.

**Rename PRs want to be small even when they touch everything.** The two PRs that did the rename were not subtle. They each touched dozens of files. They were small in the sense that they did only one thing. Each PR was renames-only, no functional changes mixed in. Mixing a rename with even one small functional change makes the PR un-reviewable, because the human reviewer has to read every line to make sure the functional change is just the functional change. Pure renames can be reviewed in fifteen minutes.

**The brand has to be ready before the rename ships.** Half of the work this weekendend was not in the codebase. It was choosing the new name, registering domains, securing handles, getting the kanji set right, designing the logo. The rename of the codebase is the last step, not the first. If you do the codebase rename and then realize the brand is not done, you are stuck with another rename round.

## What did not change

The architecture did not change. The C API did not change. The roadmap did not change. The product target did not change. Anyone reading the codebase the weekend before the rename and the weekend after would see the same engine doing the same things.

This was the right kind of rename. It was a label change, not a redirection.

## What partners and builders take from this

If you are an integrator looking at the runtime now: anywhere you see "raku-runtime" in our repos and packaging, that is the same engine that was called something else last weekend. There is no compatibility break. The C API is unchanged. The SDK bindings are unchanged. The sample apps still work.

If you are looking to partner on a product that ships on this engine, the name is now stable. The conversation does not have to start with "we are calling it this for now, but." It can start with "here is what Raku is and what it is built for."

If you are inside an AR2 device team thinking about which runtime to target on your platform, the name change is also a statement about where the engine is positioned in the market. Raku is not "the AR1+ runtime grown up." It is its own thing, with its own thesis, willing to ship on whichever hardware partner is the best fit. The rename is part of that statement.

Quiet weekend, in the sense that nothing functional changed. The right kind of quiet.
