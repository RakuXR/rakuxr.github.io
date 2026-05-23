---
title: "Blade to Raku: A Saturday Rename Across the Codebase"
date: 2025-11-08
author: Kevin Griffin
tags: [rebrand, naming, ar-glasses, history, weekend-build]
description: "The placeholder name finally came off. In a weekend, agents swept every reference across every repo from Blade and ar1-runtime to Raku — no build break, no compatibility break. The name means ease, comfort, and the human touch. The engineering finally caught up to the brand that was waiting for it."
series: learning-to-code-with-ai
slug: blade-to-raku-renaming-a-runtime
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Codebase renamed from Blade and ar1-runtime to Raku across every repo" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="b2r-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="b2r-arrow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#00cec9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#b2r-bg)"/>
  <text x="600" y="62" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Blade → Raku</text>
  <text x="600" y="98" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">~110 files, two PRs, no build break</text>
  <g font-family="system-ui,sans-serif">
    <rect x="140" y="200" width="300" height="120" rx="16" fill="#1a1a33" stroke="#9090b0" stroke-width="2"/>
    <text x="290" y="252" text-anchor="middle" fill="#9090b0" font-size="30" font-weight="800">ar1-runtime</text>
    <text x="290" y="288" text-anchor="middle" fill="#9090b0" font-size="18">"Blade" (placeholder)</text>
    <path d="M460 260 L740 260" stroke="url(#b2r-arrow)" stroke-width="4"/>
    <polygon points="740,260 722,251 722,269" fill="#00cec9"/>
    <text x="600" y="244" text-anchor="middle" fill="#a388ff" font-size="15" font-weight="600">rename sweep</text>
    <rect x="760" y="200" width="300" height="120" rx="16" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="910" y="256" text-anchor="middle" fill="#00cec9" font-size="40" font-weight="800">Raku 楽</text>
    <text x="910" y="290" text-anchor="middle" fill="#9090b0" font-size="16">ease · comfort · human touch</text>
  </g>
  <text x="600" y="400" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="14">A label change, not a redirection — the C API never moved.</text>
</svg>
<figcaption>The last step of a rebrand, not the first.</figcaption>
</figure>

<p class="post-hook">A name is a promise. Raku — ease, comfort, the human touch — is the promise behind a runtime built so AI experiences feel human, not mechanical. This is the weekend it became real.</p>

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

**The brand has to be ready before the rename ships.** Half of the work this weekend was not in the codebase. It was choosing the new name, registering domains, securing handles, getting the kanji set right, designing the logo. The rename of the codebase is the last step, not the first. If you do the codebase rename and then realize the brand is not done, you are stuck with another rename round.

## What did not change

The architecture did not change. The C API did not change. The roadmap did not change. The product target did not change. Anyone reading the codebase the weekend before the rename and the weekend after would see the same engine doing the same things.

This was the right kind of rename. It was a label change, not a redirection.

## What partners and builders take from this

If you are an integrator looking at the runtime now: anywhere you see "raku-runtime" in our repos and packaging, that is the same engine that was called something else last weekend. There is no compatibility break. The C API is unchanged. The SDK bindings are unchanged. The sample apps still work.

If you are looking to partner on a product that ships on this engine, the name is now stable. The conversation does not have to start with "we are calling it this for now, but." It can start with "here is what Raku is and what it is built for."

If you are inside an AR2 device team thinking about which runtime to target on your platform, the name change is also a statement about where the engine is positioned in the market. Raku is not "the AR1+ runtime grown up." It is its own thing, with its own thesis, willing to ship on whichever hardware partner is the best fit. The rename is part of that statement.

Quiet weekend, in the sense that nothing functional changed. The right kind of quiet.

<div class="post-cta">
<h3>The name is stable. The conversation can start.</h3>
<p>Raku is a cross-platform AR runtime willing to ship on whichever hardware fits best. If you're a glasses maker deciding which runtime to target, here's what Raku is and what it's built for.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/smart-glasses.html">For Glasses Makers</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
