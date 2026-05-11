---
title: "The Find-Replace That Corrupted 300 Files"
date: 2026-02-14
author: Kevin Griffin
tags: [audit, security, find-replace, hmac, ai-failure-mode, weekend-build]
description: "Spent this Saturday doing a deep audit pass. Found two things I did not enjoy. A find-replace from earlier in the project had garbled the words 'process,' 'success,' and 'access' into 'Raku Game Engine Milestone' text across three hundred files. And a hardcoded HMAC licensing secret was sitting in a source file, committed to the public repo. Both got fixed today. Both are the kind of finding I want to be public about."
series: learning-to-code-with-ai
slug: the-find-replace-that-corrupted-300-files
---

The day you go looking for trouble is usually the day you find some. This Saturday I scheduled a deep audit pass on the codebase. The plan was to catch up on technical debt: bare `except` blocks, hardcoded constants, drift in conventions, the kind of pile that accumulates in any project running at speed.

I found two things I did not enjoy. Both are now fixed. Both are the kind of finding I want to be public about, because they explain something real about how an agent-driven codebase fails and how the discipline of doing an audit catches the failures.

## Finding one: the find-replace that ate the codebase

Earlier in the project, an agent had been asked to do a marketing-style sweep across docstrings and comments. The intent was reasonable: rename a specific phrase that appeared in a few public-facing strings. The execution was not careful enough about word boundaries.

The phrase the agent was supposed to swap was a particular marketing tagline that contained the words "process," "success," and "access" as part of longer phrases. The find-replace operation matched those substrings in places they were not supposed to match. Variable names. Function names. Test descriptions. Inline comments. Anywhere those three substrings appeared, the agent's replacement string was substituted in.

The result was three hundred files with subtly garbled identifiers and prose. Variables named `process_event` became something with "Raku Game Engine Milestone" embedded mid-token. Function descriptions read like nonsense. Test descriptions claimed to be testing things that did not exist. The codebase compiled because the broken identifiers were consistent within their files, but the human-readable layer of the codebase was vandalized in subtle places throughout.

I want to be specific about how this kind of failure happens because it is a class of agent-driven failure that other teams will hit.

**The find was scoped too widely.** The agent was instructed to find a phrase and replace it. The phrase happened to be a substring of common English words. The right way to scope this find is on word boundaries (`\bword\b` in regex), with explicit case sensitivity, with an explicit allowlist of file extensions, with an explicit denylist of identifier contexts. The instruction the agent received had none of those constraints.

**The agent did not flag the breadth.** Three hundred files is a lot of files. An agent that landed a PR touching three hundred files for a small marketing tweak should have flagged the breadth at PR-open time. The agent did not. The PR title said something like "update marketing copy in docstrings." The PR body listed the file count as a number, not as a concern.

**My review process did not catch it.** The PR diff was three hundred files of small two-line changes that all looked like the same edit. The diff reads, at a skim, as a clean sweep. The corruption only shows up if you read the actual changed content of a file at a time when the agent's substitution produced nonsense. I did not. I merged.

**The CI did not catch it because the names still parsed.** The corrupted identifiers were syntactically valid. Compilers do not care if your variable is named something that looks like a marketing tagline. The build was green. Tests still ran. The damage was at the human layer of the code, not the machine layer.

## How I fixed it this Saturday

A script. The script does three things.

**One: re-derive the canonical identifier names.** From git history before the bad find-replace landed, the script reconstructs what each identifier was supposed to be called. The reconstruction is mechanical: for each file touched by the bad PR, diff the pre-PR version against the post-PR version, and for each substituted token, propose a restoration to the pre-PR name. Most files restore cleanly. A small number need manual review because they had legitimate changes layered on top of the corruption.

**Two: a grep-driven sanity pass.** Even after restoration, some of the corrupted identifiers had been referenced from new code written after the bad PR landed. Those references had been written against the corrupted names. The grep pass finds every reference to a corrupted-style identifier in code written after the bad PR landed, and flags each for manual decision: was this new code intended to use the corrupted name (rare), or was it just using whatever name happened to exist at the time (most cases)?

**Three: a guard for the future.** Every find-replace operation an agent does now has to specify (a) word-boundary scoping, (b) case sensitivity, (c) file-extension allowlist, (d) maximum file-count threshold beyond which the agent has to flag and request explicit review, and (e) a sample of three random matches the agent has to show before applying the full replacement. The guard is in the Copilot Guide and is now part of every find-replace task framing.

The corruption is now repaired. The audit script that did the repair is in the repo, runnable any time, with the diff outputs saved for evidence. The lesson is in the Copilot Guide.

## Finding two: the hardcoded HMAC secret

The deep audit pass also turned up something I should have caught earlier. The licensing layer of the runtime uses HMAC-SHA-256 to verify license tokens. The HMAC secret was hardcoded into a source file. The source file was in the public repo. The secret was a real secret used by a real production verification path.

This is the most embarrassing finding of the day. I want to be honest about it because it is exactly the kind of thing that happens in fast-moving agent-driven codebases, and the public discussion of how to catch it is more valuable than the private discussion.

**The path it took to land:** An early version of the licensing layer was prototyped with a placeholder secret value, intended to be replaced before the layer shipped to anyone. The prototype landed in a PR with an obvious-looking dev placeholder. Over time, real verification logic was added on top of the placeholder. The placeholder stopped looking like a placeholder once it was wrapped in real-looking validation code. By the time anyone noticed, the secret was being used in production-style flows and the file was in the public repo.

**What I did today:**

- Rotated the secret. The compromised value is no longer the production value. The new value is in an environment variable, with a `warnings.warn()` fallback for dev environments that lets dev work proceed without a real secret but yells loudly about it.
- Removed the hardcoded value from the source file. The replacement is a `getenv` with a clear error message if the env var is unset in a production build.
- Added a CI check that scans for hardcoded secrets matching common patterns (high-entropy strings, base64-shaped tokens, anything that looks like a key). The check is the kind of small infrastructure that will catch the next attempt before it lands.
- Filed a follow-up to audit the rest of the codebase for similar patterns. The audit is a separate weekend's work. Today was about closing the immediate finding.

The licensing layer still works. The new path is more secure. The compromised secret was rotated within hours of discovery.

## What this generalizes to

A few honest points.

**Agent-driven find-replace needs explicit scoping rules.** This is the third time in the project's history that an over-broad sweep has bitten me. The first two times were less damaging. This time was bad enough to merit a permanent guardrail. The guardrail is now in place.

**Hardcoded secrets in source files are a discipline failure, not a tooling failure.** No tool will save a team that lets a real secret land in a public file. The discipline of "every commit gets reviewed for hardcoded credentials" is the actual fix. The CI scan helps. The discipline is what matters.

**Audits find what review missed.** The discipline of running a scheduled audit pass over the codebase, looking specifically for the failure modes that PR-by-PR review tends to miss, is worth the time. Today's audit caught two things that PR review had let through. Future audits will catch other things. The cadence is the point.

## What partners and builders should take from this

If you are evaluating an engine for partnership, ask the team how they handle the "agent-driven over-broad sweep" failure mode. The right answer involves explicit scoping rules, mandatory flagging on large changes, and audit passes. The wrong answer is "we have not seen that problem."

If you are running an agent-driven workflow yourself and you have not done a hardcoded-secret audit recently, do one. The probability that something snuck in is non-zero. The cost of finding it now is small.

If you are a security professional reading this and you have suggestions, I am genuinely interested. The class of failure I am working to defend against is "agent does something a human reviewer would have caught at a glance but did not catch in the bulk-review pattern an agent-driven workflow encourages." Suggestions welcome.

Saturday afternoon. The codebase has had a hard look. Two findings, both fixed. The next audit is on the calendar.

Back to building.
