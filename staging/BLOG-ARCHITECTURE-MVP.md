# Blog Architecture (MVP) — LI-BLOG-MVP

This doc records the stack choice and layout for the `/blog/` section added to
rakuai.com. It's a one-page reference so anyone editing the blog later can find
their bearings without spelunking through the build script.

## Stack

**Tiny custom Python build script** (`scripts/build_blog.py`) using:

- `markdown` (Python-Markdown 3.x) — Markdown → HTML
- `pygments` — build-time syntax highlighting (no runtime JS)

The script reads Markdown sources from `_blog/posts/`, applies HTML templates
from `_blog/templates/`, copies static assets from `_blog/static/`, and writes
the final site into `/blog/`. The generated `/blog/` tree is committed to the
repo so the existing GitHub Actions deploy (which uploads the repo root as-is)
keeps working without modification.

Build time on a single placeholder post: ~0.8 seconds. Budget was 60 seconds.

### Why not Eleventy

The original spec preferred Eleventy if no generator existed. We deviated because
**Node.js isn't installed** in the build environment used to assemble this MVP,
and the existing GitHub Actions workflow has no build step at all — it uploads
the repo root verbatim. Adopting Eleventy would have required either installing
Node locally or adding a build step to `deploy-production.yml`, which expands the
blast radius of this change beyond what the MVP needs.

The custom Python builder is ~280 lines, has zero JavaScript, no template
language to learn (string substitution only), and no `node_modules`. Python 3
plus two pip packages (`markdown`, `pygments`) is the only requirement — both
already present on the build host. If volume grows, swapping in Eleventy or
Hugo is a one-evening job because the source layout (`_blog/posts/*.md` + YAML
frontmatter) is the same convention they use.

### Why not pure hand-authored HTML

Spec required Markdown bodies with build-time syntax highlighting. That makes
a build step non-optional, so we picked the smallest one that meets the bar.

## Source layout

```
_blog/
  posts/
    2026-05-02-ai-as-nervous-system.md     # one Markdown file per post, YAML frontmatter
  series/
    learning-to-code-with-ai.yml            # series title + description
  templates/
    post.html                               # individual post page (680px reader column)
    index.html                              # /blog/ landing page (reverse-chrono list)
    series.html                             # /blog/series/<slug>/ page (ordered list)
  static/
    blog.css                                # blog-only styles, copied to /blog/blog.css
scripts/
  build_blog.py                             # the builder
  add_blog_nav.py                           # idempotent nav-link injector for top-level pages
```

## Output layout (deployed)

```
/blog/
  index.html                                # post list, reverse chronological
  feed.xml                                  # RSS 2.0 (last 20 posts)
  blog.css                                  # styles
  syntax.css                                # Pygments classes (Monokai dark)
  img/
    default-og.png                          # 1200x630 fallback OG image
  series/
    learning-to-code-with-ai/index.html
  <post-slug>/index.html                    # one directory per post for clean URLs
```

URLs are clean (`/blog/<slug>/`), trailing slashes everywhere, no `.html`
extensions on canonical post URLs.

## Post frontmatter

YAML at the top of each Markdown file. Supported keys:

| Key           | Required | Notes                                                       |
|---------------|:--------:|-------------------------------------------------------------|
| `title`       | yes      | String, used as `<h1>` and in `<title>`/OG tags             |
| `date`        | yes      | `YYYY-MM-DD`                                                |
| `author`      | no       | Display name                                                |
| `description` | yes      | Used as `<meta description>`, OG/Twitter description, RSS   |
| `tags`        | no       | YAML inline list `[a, b, c]`                                |
| `series`      | no       | Series slug (must match a file in `_blog/series/`)          |
| `slug`        | no       | URL slug; defaults to filename minus the `YYYY-MM-DD-` prefix |
| `og_image`    | no       | Absolute path or URL; defaults to `/blog/img/default-og.png` |

## Per-post page features

- 680px reader column, serif body (Charter / Iowan Old Style / Source Serif Pro / Georgia)
- 19px body type, 1.75 line-height (per spec ≥ 18px + generous leading)
- H1 title, date below, optional series breadcrumb
- Build-time syntax highlighting via Pygments (`.highlight` classes, Monokai)
- Prev/next links inside the same series, ordered by date
- Full OG/Twitter Card meta in `<head>`, including `article:published_time`
- Canonical link, `<link rel="alternate">` to the RSS feed
- Mobile breakpoint at 600px (single-column nav stack, slightly smaller type)

## How to add a post

1. Create `_blog/posts/YYYY-MM-DD-slug.md` with frontmatter and Markdown body.
2. (Optional) If the post belongs to a series, set `series: <existing-slug>` or
   add a new file `_blog/series/<slug>.yml`.
3. Run `python scripts/build_blog.py` from the repo root.
4. Commit the changed Markdown source **and** the regenerated `/blog/` output.
5. Push — GitHub Actions deploys the repo root to GitHub Pages on `main`.

## How to add the Blog nav link to a new top-level page

Run `python scripts/add_blog_nav.py`. The script is idempotent — it inserts
`<a href="blog/">Blog</a>` (or `/blog/` if the page uses absolute hrefs) right
after the existing Press link, only on pages that don't already have the link.

## Deviations from the original spec

| Spec                                    | Reality                                  | Rationale                                                                                       |
|-----------------------------------------|------------------------------------------|-------------------------------------------------------------------------------------------------|
| "Eleventy if no generator exists"       | Custom Python builder                    | Node not installed; existing deploy has no build step; Python builder is 280 lines, zero deps beyond `pip install markdown pygments` |
| "OG image: dark bg, RAKUAI wordmark"    | Reused existing `og-default.png`         | Existing site OG image already matches the brief (dark, RakuAI wordmark, 1200x630). A bespoke `/blog/` image can be added later by dropping a PNG at `blog/img/default-og.png`. |

## Constraints met

- [x] No JS framework, no React/Next/Astro/Gatsby
- [x] Static HTML only (pre-rendered)
- [x] No analytics (no cookie banner needed)
- [x] Mobile-responsive (600px breakpoint)
- [x] Build under 60 seconds (~0.8s observed)
- [x] Syntax highlighting at build time, no runtime JS
- [x] Full OG/Twitter Card meta on every blog page
- [x] RSS 2.0 feed at `/blog/feed.xml`
- [x] Dark theme matching the existing site palette
