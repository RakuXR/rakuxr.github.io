# AWS brand assets — "Powered by AWS"

**Status:** staged for prep. **NOT yet displayed anywhere on the site.** Display is gated on
AWS Activate credits landing + our AWS account being "in good standing with a current and
valid account" (AWS Trademark Guidelines 3(a)). See
`raku-api/docs/partner-benefits/aws-activate/brand-readiness.md` for the full memo.

## Files
| File | Variant | Use on |
|---|---|---|
| `powered-by-aws.png` | "Squid Ink" (color) | light backgrounds |
| `powered-by-aws-white.png` | white | dark backgrounds (our footer) |

Both 200x72 PNG, transparent, fetched 2026-05-30 from the canonical AWS CDN:
`https://d0.awsstatic.com/logos/powered-by-aws.png` and `.../powered-by-aws-white.png`.

## Hard rules (AWS Trademark Guidelines 5-11) — READ BEFORE ENABLING
- Only "Powered by AWS" is permitted for us (we are NOT an AWS Partner; the APN badge is not
  ours). The "AWS Activate" logo has **no public download** and needs per-use email approval.
- Do NOT alter proportions, color, or font.
- Do NOT combine it with the RakuAI logo (7 "No Combination").
- Do NOT display it larger or more prominently than RakuAI's own branding (5).
- Clear space = the height/width of the lowercase "a" in the logo on every side.
- Do NOT put AWS marks in a domain/subdomain (a `/aws` URL path is fine).
- Not available in China.
- License auto-terminates if our AWS Customer Agreement ends or our content stops using AWS.

## To enable (after credits land + account in good standing)
Flip on the footer strip drafted in `scripts/inject-footer-recognition.py` (search
`powered-by-aws:start`), mirroring the NVIDIA Inception injection pattern. Press/announcements
mentioning AWS Activate also need Activate-team approval first.
