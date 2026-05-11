---
title: "Eight Security Findings on a Saturday Morning"
date: 2026-03-21
author: Kevin Griffin
tags: [security, audit, due-diligence, enterprise, weekend-build]
description: "A security audit report landed in the inbox late this past week. Enterprise due-diligence pass on the API surface had surfaced eight critical and high findings. Spent Saturday triaging and fixing each one. Here is what the categories were, what got fixed, and what an agent-driven codebase has to be especially careful about."
series: learning-to-code-with-ai
slug: eight-security-findings
---

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
