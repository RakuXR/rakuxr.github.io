---
title: "Eight Security Findings on a Saturday Morning"
date: 2026-03-21
author: RakuAI Team
tags: [security, audit, due-diligence, enterprise, weekend-build]
description: "An enterprise partner's security team ran due diligence on our API surface and came back with eight critical and high findings. Every one had a fix landing by Saturday night. Here are the categories, the new permanent guardrails, and the failure modes an agent-driven runtime has to defend against on purpose."
series: learning-to-code-with-ai
slug: eight-security-findings
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Eight categories of security finding triaged and fixed across a Saturday" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sec8-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#sec8-bg)"/>
  <text x="600" y="62" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Eight Findings, One Saturday</text>
  <text x="600" y="98" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Enterprise due diligence, every one closed</text>
  <g font-family="system-ui,sans-serif" font-size="14" fill="#c8c8e0">
    <rect x="120" y="150" width="240" height="60" rx="10" fill="#1a1a33" stroke="#e84393"/><text x="240" y="186" text-anchor="middle">Input validation</text>
    <rect x="380" y="150" width="240" height="60" rx="10" fill="#1a1a33" stroke="#e84393"/><text x="500" y="186" text-anchor="middle">Hardcoded credential</text>
    <rect x="640" y="150" width="240" height="60" rx="10" fill="#1a1a33" stroke="#6c5ce7"/><text x="760" y="186" text-anchor="middle">Cipher-suite policy</text>
    <rect x="900" y="150" width="180" height="60" rx="10" fill="#1a1a33" stroke="#6c5ce7"/><text x="990" y="186" text-anchor="middle">Use-after-free</text>
    <rect x="120" y="230" width="240" height="60" rx="10" fill="#1a1a33" stroke="#6c5ce7"/><text x="240" y="266" text-anchor="middle">Thread-safety</text>
    <rect x="380" y="230" width="240" height="60" rx="10" fill="#1a1a33" stroke="#e84393"/><text x="500" y="266" text-anchor="middle">Authz bypass</text>
    <rect x="640" y="230" width="240" height="60" rx="10" fill="#1a1a33" stroke="#6c5ce7"/><text x="760" y="266" text-anchor="middle">Auth-failure logging</text>
    <rect x="900" y="230" width="180" height="60" rx="10" fill="#1a1a33" stroke="#6c5ce7"/><text x="990" y="266" text-anchor="middle">Dependency lag</text>
  </g>
  <g font-family="system-ui,sans-serif">
    <rect x="380" y="340" width="440" height="70" rx="14" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="600" y="372" text-anchor="middle" fill="#00cec9" font-size="20" font-weight="800">8 / 8 closed</text>
    <text x="600" y="396" text-anchor="middle" fill="#9090b0" font-size="13">+ 6 new permanent guardrails</text>
  </g>
</svg>
<figcaption>The team that welcomes the audit is the team whose codebase gets better.</figcaption>
</figure>

<p class="post-hook">Audits surface things. The honest move is to welcome them, fix everything, and ship permanent guardrails — which is exactly how a runtime earns enterprise trust.</p>

The audit landed in the inbox late last week. By Saturday morning I had the report open on one screen and the codebase open on the other. Eight critical or high findings. The kind of inbox content that defines a weekend.

This was enterprise due diligence. A potential partner had asked their security team to run a pass on the public API surface before they would let their lawyers move forward. The findings were specific, well-explained, and entirely fair. They were also the kind of things that an agent-driven workflow makes you especially vulnerable to if you are not deliberate about defending against them.

By the end of Saturday, every finding had a PR landing it. This is the post about what each one was.

## What the categories were

I am going to talk about categories rather than specific exploit details because the specifics are now fixed and not interesting to a competitor; the categories are what other teams will want to defend against.

**One: input validation on the public REST surface.** Several endpoints were trusting their inputs more than they should have. Specifically, length bounds on string inputs, range bounds on numeric inputs, and structural validation on JSON payloads. None of the missing validation was catastrophic on its own. The combination of "no length bound here plus no rate limit there plus no auth check on this admin endpoint" is the kind of stack that becomes catastrophic once an attacker has discovered the surface.

**Two: a hardcoded credential in a configuration file.** Different from the HMAC finding a few weekends ago. This was a configuration template that had a real credential committed in the example version. The intent had been to ship an example credential that was a placeholder; what got shipped was an example credential that was a real value from a developer's local environment. Rotation, removal from the example, addition to the secrets-scanning CI pass.

**Three: insecure cipher suite negotiation.** A subsystem that negotiates TLS with an external service was accepting cipher suites that should not be acceptable in 2026. Specifically, several pre-TLS-1.3 suites with known weaknesses. The fix was to constrain the cipher-suite list to a TLS-1.3-only set, with a documented escape hatch (an explicit flag) for testing against legacy partner systems.

**Four: a use-after-free in the C API boundary.** The C API of one of the runtime DLLs had a function that returned a pointer to internal state, which the caller could continue to use after the internal state had been freed by a subsequent call on the same handle. Classic C-API foot-gun. The fix was to switch from "caller-held pointer" semantics to "caller-held opaque-handle with a get-by-handle accessor" semantics. The accessor returns a fresh pointer-copy for the duration of the call and the underlying memory is not exposed.

**Five: a thread-safety hole in the licensing layer.** Two threads could race on the same licensing-state object during concurrent verification calls. Under load, one thread could see a partially-updated state and reach incorrect conclusions about license validity. The fix was a proper read-write lock around the state, with the verification path optimized for the common case (license valid, no state change needed).

**Six: an authorization bypass on an admin endpoint.** One of the admin endpoints had an authentication check but not an authorization check. Any authenticated user could call it, including users without the admin role. The fix was to add the role check, write a unit test that exercises both "authenticated-as-admin allowed" and "authenticated-but-not-admin denied" paths, and audit every other admin endpoint for the same pattern. Three other endpoints had the same issue. All four are now correct.

**Seven: insufficient logging on auth failures.** When a user tried to authenticate and failed, the runtime logged the attempt but did not log enough context to investigate a brute-force or credential-stuffing pattern. The fix was to add structured logging on every auth failure with the IP address, the rate-limited counter for that IP, and the auth-method attempted. Privacy-preserving (no password content is logged), but enough context to investigate when an investigation becomes necessary.

**Eight: dependency-update lag.** Several of the third-party dependencies the runtime pulls in had known-vulnerable versions pinned in the manifest. The fix was to update each one to the latest patched version, run the test suite against the updates, and resolve the small number of API-shape changes that the updates required. Two of the eight updates required adapter changes in our code; the other six were drop-in. Dependabot is now configured to flag this automatically.

## What I learned from a weekend of security work

Three things. Not surprising. Worth saying.

**Security findings cluster.** Eight findings is a lot to surface at once. The pattern, looking back, is that they all share a common root: the runtime had been growing fast in an agent-driven workflow, with the agents implementing things correctly-in-isolation. Cross-cutting concerns like security are exactly the kind of thing that escapes per-PR review. The audit catches what review missed. Schedule the audits.

**Some findings are agent-driven failure modes.** The use-after-free in the C API is the kind of thing an agent writes when the prompt says "expose this internal state to the caller" without specifying ownership semantics. The thread-safety hole in the licensing layer is similar. Both are catching the same pattern: agents that are not asked about ownership and concurrency will produce code that ignores both.

**Some findings are pace-driven failure modes.** The dependency-update lag is not an agent problem. It is a "shipping fast and not having a person whose job is to keep dependencies fresh" problem. The fix is process (Dependabot) and discipline (act on Dependabot's alerts). The fix is not "be smarter."

## The new defenses

Permanent guardrails landed this weekend.

**A security-scanner pass in CI.** Static analysis for input validation, secret scanning, and cipher-suite policy. Every PR runs the scan. PRs that introduce new findings are flagged for review.

**An admin-endpoint test pattern.** Every admin endpoint in the API now has a paired test that exercises both the admin-allowed path and the non-admin-denied path. The pattern is enforced by a CI check that scans for `@admin_required` decorators and fails the build if the decorator is present without a corresponding paired test.

**A thread-safety annotation on shared state.** Every shared-state object in the runtime now has an explicit annotation about its concurrency model: immutable, lock-protected, lock-free with explicit happens-before, or single-threaded. The annotation is part of the type. Code that touches the state has to satisfy the annotation. The compiler enforces it for the lock-protected and immutable cases; the rest is on review.

**A monthly security audit on the calendar.** Not waiting for a partner to ask. The audit is a standing item the second Saturday of every month. The first one runs in April.

## What partners and builders should take from this

If you are evaluating an engine for partnership and you are about to ask for an audit, this team will welcome it. Audits surface things. Things get fixed. The codebase gets better. The partner relationship gets better. The discipline of welcoming the audit is more important than any specific finding.

If you are an enterprise security professional reading this, I am open to suggestions on the audit cadence and on the specific things you wish more engine teams audited. The findings this weekend were the obvious ones. The non-obvious ones are the next ones I want to find.

If you are running an agent-driven workflow and you have not done a security audit recently, do one. The pattern of "agent writes correct-in-isolation code that misses cross-cutting concerns" is universal in this workflow shape. The audit is how you catch the cross-cutting concerns. There is no other way I have found.

End-of-weekend check. Eight findings closed. Six new defenses landed. The next audit is on the calendar. The partner relationship moves forward.

Back to building.

<div class="post-cta">
<h3>A spatial runtime that passes due diligence</h3>
<p>RakuAI is built for enterprise partners and smart-glasses manufacturers — audited, hardened, and honest about it. See how we engineer for the security bar your team has to clear.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/enterprise.html">For Enterprise</a>
<a class="cta-btn cta-secondary" href="/smart-glasses.html">For Smart Glasses</a>
</div>
</div>
