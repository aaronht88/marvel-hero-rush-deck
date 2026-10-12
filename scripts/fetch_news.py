#!/usr/bin/env python3
"""Fetch Marvel Hero Rush news into data/news.json.

Sources
- intl: official site news API (server.marvelherorush.com/marvel/information/list, zh-CN only)
- hk:   Saka Saka Ltd. (HK distributor) venue page on Mato — schema.org Event JSON-LD

Optional hand-written rewrites live in data/news_overrides.json, keyed by item id.
  Legacy: {"title_zh", "summary_zh"}
  Multi-locale articles: title_i18n / summary_i18n / body_i18n
    ({"zh-HK","zh-CN","en"}), plus source_name, source_url, related_deck_ids, related_decks,
    featured_cards (card ids for simulator-style mockups).
  Editorial stubs (id starts with editorial-) are preserved / injected on each fetch
  so hand-authored tournament roundups are not dropped when the official list refreshes.
  See docs/NEWS_ARTICLES.md. Existing entries are kept if a source fails.
"""
import json, re, sys, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "news.json"
OVR = ROOT / "data" / "news_overrides.json"
HKT = timezone(timedelta(hours=8))
UA = {"User-Agent": "Mozilla/5.0 (mhrdeckbuild news bot)"}
OFFICIAL_API = "https://server.marvelherorush.com/marvel/information/list?page=1&page_size=30&language=zh-CN"
OFFICIAL_SITE = "https://www.marvelherorush.com/zh-CN/news"
MATO_VENUE = "https://ma.to/venue/sakasaka_hk"


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def fetch_intl():
    data = json.loads(get(OFFICIAL_API))
    items = []
    for x in data.get("list") or []:
        link = x.get("redirect_link") or ""
        if not link.startswith("http"):
            link = OFFICIAL_SITE
        items.append({
            "id": "mhr-" + x["id"],
            "title": x.get("title", "").strip(),
            "date": datetime.fromtimestamp(x["start_time"] / 1000, HKT).strftime("%Y-%m-%d"),
            "category": x.get("category", ""),
            "url": link,
            "source": "官方",
        })
    return items


def fetch_hk():
    html = get(MATO_VENUE)
    items = []
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(block)
        except ValueError:
            continue
        nodes = d if isinstance(d, list) else d.get("@graph", [d])
        for it in nodes:
            if not isinstance(it, dict) or it.get("@type") != "Event":
                continue
            name = it.get("name", "")
            if "hero rush" not in name.lower():
                continue
            start = it.get("startDate", "")
            loc = it.get("location") or {}
            items.append({
                "id": "mato-" + it.get("url", name).rstrip("/").rsplit("/", 1)[-1],
                "title": name,
                "date": start[:10],
                "time": start[11:16],
                "venue": loc.get("name", "") if isinstance(loc, dict) else "",
                "category": "event",
                "url": it.get("url", MATO_VENUE),
                "source": "Saka Saka · Mato",
            })
    items.sort(key=lambda i: (i["date"], i.get("time", "")))
    return items


def editorial_stub_from_override(oid, ov, old_item=None):
    """Build a hand-authored international news item (id starts with editorial-)."""
    base = dict(old_item or {})
    title_i18n = ov.get("title_i18n") or {}
    title = (
        base.get("title")
        or title_i18n.get("zh-CN")
        or ov.get("title_zh")
        or title_i18n.get("zh-HK")
        or oid
    )
    date = base.get("date") or ov.get("date") or ""
    if not date:
        m = re.search(r"(20\d{2}-\d{2}-\d{2})$", oid)
        date = m.group(1) if m else datetime.now(HKT).strftime("%Y-%m-%d")
    stub = {
        "id": oid,
        "title": title,
        "date": date,
        "category": base.get("category") or ov.get("category") or "tournament",
        "url": base.get("url") or ov.get("source_url") or ov.get("url") or "",
        "source": base.get("source") or ov.get("source") or "編輯整理",
    }
    stub.update(ov)
    return stub


def merge_editorial(out, old, ovr):
    """Keep / inject editorial-* articles so fetch_news does not drop hand-authored stubs."""
    seen = {it["id"] for it in out.get("intl", [])}
    old_by_id = {
        it["id"]: it
        for it in (old.get("intl") or [])
        if str(it.get("id", "")).startswith("editorial-")
    }
    for oid, old_item in old_by_id.items():
        if oid in seen:
            continue
        out["intl"].append(editorial_stub_from_override(oid, ovr.get(oid, {}), old_item))
        seen.add(oid)
    for oid, ov in ovr.items():
        if not str(oid).startswith("editorial-") or oid in seen:
            continue
        out["intl"].append(editorial_stub_from_override(oid, ov, None))
        seen.add(oid)
    out["intl"].sort(key=lambda it: it.get("date", ""), reverse=True)


def main():
    old = json.loads(OUT.read_text("utf-8")) if OUT.exists() else {}
    ovr = json.loads(OVR.read_text("utf-8")) if OVR.exists() else {}
    out = {"updated": old.get("updated", ""), "intl": old.get("intl", []), "hk": old.get("hk", [])}
    ok = False
    for key, fn in (("intl", fetch_intl), ("hk", fetch_hk)):
        try:
            items = fn()
            if items:
                out[key] = items
                ok = True
        except Exception as e:  # keep previous data for this source
            print(f"[warn] {key} fetch failed: {e}", file=sys.stderr)
    for key in ("intl", "hk"):
        for it in out[key]:
            it.update(ovr.get(it["id"], {}))
    merge_editorial(out, old, ovr)
    if ok:
        out["updated"] = datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", "utf-8")
    print(f"intl={len(out['intl'])} hk={len(out['hk'])} updated={out['updated']}")


if __name__ == "__main__":
    main()
