---
title: "The Saturday the Build Stopped Arguing"
date: 2026-05-02
author: Kevin Griffin
tags: [build-system, linux, ci, null-safety, weekend-build]
description: "A run of cleanup commits that look unglamorous on the diff and feel transformative on the project. Eighteen DLLs green on Linux. Every LLM caller guarded against runaway prompt length. The /api/v2/ namespace renamed to /api/raku/ everywhere it appears. Null-pointer safety swept through the runtime. The build is finally something you can stop arguing with."
series: learning-to-code-with-ai
slug: the-week-the-build-stopped-arguing
---

There is a category of work that does not produce a screenshot. It produces a build that goes green on machines that used to make it red. It produces a CI run that stops timing out. It produces a stack trace that no longer materializes because the null pointer that caused it is now caught at the boundary. The week that ended this Saturday was that kind of week.

## Eighteen DLLs green on Linux

The runtime ships as eighteen native DLLs. Until two weeks ago, those DLLs built cleanly on Windows and built cleanly on macOS and broke on Linux on a symbol-visibility error. The fix landed in PR #1463 on April 11.

The story is the unglamorous kind. GCC defaults to making every symbol visible in shared libraries. MSVC defaults to making every symbol hidden unless it is exported. The runtime code was written assuming the MSVC default, with `__declspec(dllexport)` on the symbols that needed to cross the DLL boundary. On Linux those declarations are no-ops, which means every symbol was visible, which means the linker could not figure out the correct intra-DLL bindings, which means a number of the eighteen DLLs would not build.

The fix is `-fvisibility=hidden` as a compiler flag for the GCC builds, with explicit visibility attributes on the symbols that need to be exported. The diff is small. The blast radius is large. The Linux build is now a first-class target. The agent that ships a runtime change can now have it tested on Linux automatically by the CI matrix. Server deployments, container images, cloud build farms, all of it is now in reach.

This is the kind of fix that feels like a tax write-off. It does not move the product forward. It also does not block it anymore. That is enough.

## Prompt-length guards on every LLM caller

The other April commit worth writing down is the prompt-length-guard sweep. The runtime now invokes Claude in several places: the NPC behavior brain, the dialogue model, the world-event narrator, the procedural-content seeder. Each of those callers builds a prompt by concatenating context, instructions, and the current state. Each of those callers can produce a prompt that exceeds the model's input window if the context grows large enough.

The naive failure mode is that the LLM call returns an error. The dangerous failure mode is that the LLM call returns a truncated response, the caller does not detect the truncation, and the engine acts on a malformed answer. NPCs that stop mid-sentence. Dialogue trees that fork into nothing. World events that fire with the wrong parameters.

PR #1465 added a guard to every LLM caller: estimate the token count before the call, refuse to send if the count exceeds the budget, and emit a structured error the caller can react to. PR #1466 audited the entire codebase to verify the guard is in place at every call site. PR #1467 added documentation so the next caller knows the discipline.

The reason this matters is that AI calls inside a runtime are not occasional. They happen many times per frame at peak. A bug in the prompt construction that grows a prompt by a few tokens per call is invisible for a hundred frames and catastrophic at a thousand. The guard makes the failure loud and bounded instead of silent and unbounded.

## API namespace stabilization

The third commit is the quietest of the three and possibly the most consequential. The runtime exposes a REST API for external tools, dashboards, and the SDK to talk to. That API has lived under `/api/v2/` for the past six months because it succeeded an earlier `/api/v1/` that was internal-only.

`/api/v2/` is the wrong name. It implies that the v1 was public and superseded, which it was not. It also implies that a v3 is on the way, which it is not. PR #1464 walked through every reference in the codebase and every reference in the docs and renamed the namespace from `/api/v2/` to `/api/raku/`. The name is now stable. There is no version number to negotiate later. Backward compatibility within the namespace is the contract.

This is the kind of rename that has to happen exactly once and has to happen before any external developer writes code against the namespace. We caught it in time. The next time someone outside the team writes a script that hits the API, they will see `/api/raku/` and they will not have to re-do their work in six months.

## Null-pointer safety as a sweep

The most recent commit on the runtime, two days ago on April 30, is `58c3a806`: "fix(build): resolve all build errors, warnings, and null-pointer safety." The phrase "null-pointer safety" is doing a lot of work in that title. The change underneath it is a sweep through the codebase for every place a pointer could be null and was being dereferenced without a check.

The pattern that triggered the sweep was a crash report from one of the sample applications. A texture loader was passed a null pointer for the asset manifest, dereferenced it, and crashed. The fix was a check at the entry point. The audit was the question: how many other places in the codebase have the same pattern.

The answer was several dozen. Not all of them were exploitable. Many of them were code paths that had never been hit because the calling code happened to never pass a null. That is not a defense. The defense is the check at the boundary.

The sweep added the checks. It did not change behavior in the happy path. It did add a return value (`RAKU_ERR_INVALID_PARAM`) and a log line for the failure path. The runtime is now noisier in the cases that used to be silent crashes. Noisy is better than silent. Silent crashes in an AR runtime are the worst kind of bug.

## Why this kind of week is the right kind to have

The temptation, when you are running an engine project on a weekend cadence with a fleet of agents, is to keep shipping new features. Every Saturday morning the queue refills. Every Saturday evening the diff is bigger than it was the week before. The cadence rewards forward motion.

The cadence also tolerates technical debt. Every PR that merged through the past eight months made a small assumption about the build environment, the API surface, the LLM input window, or the null-safety contract. None of those assumptions were wrong on their own. Together they were a list of soft spots that would, eventually, crack.

A week of stopping forward motion to fix the soft spots is not lost time. It is the week after which the next eight months of forward motion can happen without arguing with the build, the API, the LLM input, or the null pointer. The argument is what wastes the time. The argument is what the cleanup ended.

## What is next

The agents are back at the queue this weekend. The next round of issues is the one I am filing this Saturday morning. They are not cleanup issues anymore. They are feature issues. The build will not argue with them.

That is what a clean build buys you. Not a screenshot. Permission to ship.
