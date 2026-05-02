#!/usr/bin/env python3
"""Static blog builder for rakuai.com.

Reads Markdown posts from _blog/posts/ and renders to blog/.
Build-time syntax highlighting via Pygments (no runtime JS).
Series metadata loaded from _blog/series/<slug>.yml.

Usage: python scripts/build_blog.py
"""
from __future__ import annotations

import html
import json
import re
import shutil
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import markdown
from pygments.formatters import HtmlFormatter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_blog"
POSTS_DIR = SRC / "posts"
SERIES_DIR = SRC / "series"
TEMPLATES_DIR = SRC / "templates"
STATIC_DIR = SRC / "static"
OUT = ROOT / "blog"

SITE_URL = "https://rakuai.com"
BLOG_URL = f"{SITE_URL}/blog"
DEFAULT_OG = "/blog/img/default-og.png"


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^\w\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value)
    return value.strip("-")


def parse_simple_yaml(text: str) -> dict:
    """Tiny YAML subset for frontmatter — keys, strings, dates, lists."""
    data: dict = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, raw = line.partition(":")
        key = key.strip()
        raw = raw.strip()
        if not raw:
            data[key] = ""
            continue
        if raw.startswith("[") and raw.endswith("]"):
            inner = raw[1:-1].strip()
            if not inner:
                data[key] = []
            else:
                data[key] = [item.strip().strip('"').strip("'") for item in inner.split(",")]
            continue
        if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
            data[key] = raw[1:-1]
            continue
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            data[key] = date.fromisoformat(raw)
            continue
        if raw.lower() in ("true", "false"):
            data[key] = raw.lower() == "true"
            continue
        try:
            data[key] = int(raw)
            continue
        except ValueError:
            pass
        data[key] = raw
    return data


def split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    fm_text = text[4:end]
    body_start = end + 4
    if body_start < len(text) and text[body_start] in ("\n", "\r"):
        body_start += 1
        if body_start < len(text) and text[body_start] == "\n":
            body_start += 1
    return parse_simple_yaml(fm_text), text[body_start:]


def load_series() -> dict:
    series: dict = {}
    if not SERIES_DIR.exists():
        return series
    for path in SERIES_DIR.glob("*.yml"):
        slug = path.stem
        text = path.read_text(encoding="utf-8")
        meta: dict = {"slug": slug, "posts": []}
        in_posts = False
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped == "posts:":
                in_posts = True
                continue
            if in_posts and stripped.startswith("-"):
                meta["posts"].append(stripped[1:].strip())
                continue
            if ":" in stripped and not in_posts:
                key, _, raw = stripped.partition(":")
                raw = raw.strip()
                if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
                    raw = raw[1:-1]
                meta[key.strip()] = raw
        series[slug] = meta
    return series


def render_markdown(text: str) -> str:
    md = markdown.Markdown(
        extensions=["fenced_code", "codehilite", "tables", "toc", "smarty"],
        extension_configs={
            "codehilite": {
                "css_class": "highlight",
                "guess_lang": False,
                "noclasses": False,
            }
        },
        output_format="html5",
    )
    return md.convert(text)


def load_template(name: str) -> str:
    return (TEMPLATES_DIR / name).read_text(encoding="utf-8")


def render_template(template: str, **ctx) -> str:
    out = template
    for key, value in ctx.items():
        out = out.replace("{{" + key + "}}", "" if value is None else str(value))
    return out


def format_date(d) -> str:
    if isinstance(d, datetime):
        d = d.date()
    if isinstance(d, date):
        return d.strftime("%B %-d, %Y") if sys.platform != "win32" else d.strftime("%B %#d, %Y")
    return str(d)


def iso_date(d) -> str:
    if isinstance(d, datetime):
        return d.replace(tzinfo=timezone.utc).isoformat()
    if isinstance(d, date):
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc).isoformat()
    return str(d)


def rfc822(d) -> str:
    if isinstance(d, datetime):
        dt = d
    elif isinstance(d, date):
        dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    else:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%a, %d %b %Y %H:%M:%S +0000")


def build_post(post: dict, all_posts: list, series: dict, post_template: str) -> None:
    series_slug = post.get("series")
    series_nav = ""
    breadcrumb = ""
    if series_slug and series_slug in series:
        s = series[series_slug]
        ordered = [p for p in all_posts if p.get("series") == series_slug]
        ordered.sort(key=lambda p: p["date"])
        idx = next((i for i, p in enumerate(ordered) if p["slug"] == post["slug"]), None)
        if idx is not None:
            prev_link = ""
            next_link = ""
            if idx > 0:
                p = ordered[idx - 1]
                prev_link = f'<a class="nav-prev" href="/blog/{p["slug"]}/" rel="prev">&larr; {html.escape(p["title"])}</a>'
            if idx < len(ordered) - 1:
                p = ordered[idx + 1]
                next_link = f'<a class="nav-next" href="/blog/{p["slug"]}/" rel="next">{html.escape(p["title"])} &rarr;</a>'
            series_nav = f'<nav class="post-series-nav">{prev_link}{next_link}</nav>'
        breadcrumb = (
            f'<p class="series-breadcrumb"><a href="/blog/series/{series_slug}/">'
            f"Series: {html.escape(s.get('title', series_slug))}</a></p>"
        )

    body_html = render_markdown(post["body"])
    tags = post.get("tags") or []
    tags_html = ""
    if tags:
        tags_html = (
            '<ul class="post-tags">'
            + "".join(f'<li>{html.escape(t)}</li>' for t in tags)
            + "</ul>"
        )

    canonical = f"{BLOG_URL}/{post['slug']}/"
    og_image = post.get("og_image") or DEFAULT_OG
    if og_image.startswith("/"):
        og_image_abs = SITE_URL + og_image
    else:
        og_image_abs = og_image

    html_out = render_template(
        post_template,
        TITLE=html.escape(post["title"]),
        DESCRIPTION=html.escape(post.get("description", "")),
        CANONICAL=canonical,
        OG_IMAGE=og_image_abs,
        DATE_DISPLAY=format_date(post["date"]),
        DATE_ISO=iso_date(post["date"]),
        AUTHOR=html.escape(post.get("author", "RakuAI")),
        BREADCRUMB=breadcrumb,
        BODY=body_html,
        TAGS=tags_html,
        SERIES_NAV=series_nav,
    )

    out_dir = OUT / post["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(html_out, encoding="utf-8")


def build_index(all_posts: list, index_template: str) -> None:
    items = sorted(all_posts, key=lambda p: p["date"], reverse=True)
    rows = []
    for p in items:
        rows.append(
            '<article class="post-card">'
            f'<h2><a href="/blog/{p["slug"]}/">{html.escape(p["title"])}</a></h2>'
            f'<p class="post-meta"><time datetime="{iso_date(p["date"])}">{format_date(p["date"])}</time>'
            + (f' &middot; <span class="post-author">{html.escape(p.get("author", ""))}</span>' if p.get("author") else "")
            + "</p>"
            f'<p class="post-excerpt">{html.escape(p.get("description", ""))}</p>'
            "</article>"
        )
    html_out = render_template(
        index_template,
        TITLE="Blog &mdash; RakuAI",
        DESCRIPTION="Engineering notes, architecture decisions, and behind-the-scenes from the RakuAI team.",
        CANONICAL=f"{BLOG_URL}/",
        OG_IMAGE=SITE_URL + DEFAULT_OG,
        POSTS="\n".join(rows) or '<p class="post-empty">No posts yet.</p>',
    )
    (OUT / "index.html").write_text(html_out, encoding="utf-8")


def build_series_pages(all_posts: list, series: dict, series_template: str) -> None:
    series_root = OUT / "series"
    series_root.mkdir(parents=True, exist_ok=True)
    for slug, s in series.items():
        ordered = [p for p in all_posts if p.get("series") == slug]
        ordered.sort(key=lambda p: p["date"])
        rows = []
        for i, p in enumerate(ordered, 1):
            rows.append(
                '<article class="post-card">'
                f'<h2><span class="series-num">{i}.</span> '
                f'<a href="/blog/{p["slug"]}/">{html.escape(p["title"])}</a></h2>'
                f'<p class="post-meta"><time datetime="{iso_date(p["date"])}">{format_date(p["date"])}</time></p>'
                f'<p class="post-excerpt">{html.escape(p.get("description", ""))}</p>'
                "</article>"
            )
        title = s.get("title", slug)
        desc = s.get("description", "")
        html_out = render_template(
            series_template,
            TITLE=html.escape(title) + " &mdash; RakuAI Blog",
            DESCRIPTION=html.escape(desc),
            CANONICAL=f"{BLOG_URL}/series/{slug}/",
            OG_IMAGE=SITE_URL + DEFAULT_OG,
            SERIES_TITLE=html.escape(title),
            SERIES_DESCRIPTION=html.escape(desc),
            POSTS="\n".join(rows) or '<p class="post-empty">No posts in this series yet.</p>',
        )
        out_dir = series_root / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(html_out, encoding="utf-8")


def build_feed(all_posts: list) -> None:
    items = sorted(all_posts, key=lambda p: p["date"], reverse=True)[:20]
    item_xml = []
    latest = items[0]["date"] if items else date.today()
    for p in items:
        link = f"{BLOG_URL}/{p['slug']}/"
        item_xml.append(
            "<item>"
            f"<title>{html.escape(p['title'])}</title>"
            f"<link>{link}</link>"
            f"<guid isPermaLink=\"true\">{link}</guid>"
            f"<pubDate>{rfc822(p['date'])}</pubDate>"
            f"<description>{html.escape(p.get('description', ''))}</description>"
            "</item>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "<channel>\n"
        "<title>RakuAI Blog</title>\n"
        f"<link>{BLOG_URL}/</link>\n"
        f'<atom:link href="{BLOG_URL}/feed.xml" rel="self" type="application/rss+xml" />\n'
        "<description>Engineering notes from the RakuAI team.</description>\n"
        "<language>en-us</language>\n"
        f"<lastBuildDate>{rfc822(latest)}</lastBuildDate>\n"
        + "\n".join(item_xml)
        + "\n</channel>\n</rss>\n"
    )
    (OUT / "feed.xml").write_text(xml, encoding="utf-8")


def write_pygments_css() -> None:
    formatter = HtmlFormatter(style="monokai")
    css = formatter.get_style_defs(".highlight")
    (OUT / "syntax.css").write_text(css, encoding="utf-8")


def copy_static() -> None:
    if STATIC_DIR.exists():
        for src_path in STATIC_DIR.iterdir():
            dst = OUT / src_path.name
            if src_path.is_dir():
                if dst.exists():
                    shutil.rmtree(dst)
                shutil.copytree(src_path, dst)
            else:
                shutil.copy2(src_path, dst)


def load_posts() -> list:
    posts = []
    for path in sorted(POSTS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        fm, body = split_frontmatter(text)
        slug = fm.get("slug")
        if not slug:
            stem = path.stem
            stem = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", stem)
            slug = slugify(stem)
        post = {
            "slug": slug,
            "title": fm.get("title", slug),
            "date": fm.get("date") or date.today(),
            "author": fm.get("author", ""),
            "description": fm.get("description", ""),
            "tags": fm.get("tags", []),
            "series": fm.get("series"),
            "og_image": fm.get("og_image"),
            "body": body,
            "source": str(path.relative_to(ROOT)),
        }
        posts.append(post)
    return posts


def clean_output() -> None:
    if OUT.exists():
        for child in OUT.iterdir():
            if child.name == "img":
                continue
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    else:
        OUT.mkdir(parents=True)


def main() -> int:
    if not POSTS_DIR.exists():
        print(f"No posts directory: {POSTS_DIR}", file=sys.stderr)
        return 1
    clean_output()
    posts = load_posts()
    series = load_series()

    post_template = load_template("post.html")
    index_template = load_template("index.html")
    series_template = load_template("series.html")

    for post in posts:
        build_post(post, posts, series, post_template)
    build_index(posts, index_template)
    build_series_pages(posts, series, series_template)
    build_feed(posts)
    write_pygments_css()
    copy_static()

    print(f"Built {len(posts)} post(s), {len(series)} series, RSS feed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
