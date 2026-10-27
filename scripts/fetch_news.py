#!/usr/bin/env python3
"""Fetch Marvel Hero Rush news into data/news.json.

Sources
- intl: official site news API (server.marvelherorush.com/marvel/information/list, zh-CN only)
- hk:   Saka Saka Ltd. (HK distributor) venue page on Mato — schema.org Event JSON-LD.
        Each event page adds shop address, district, end time, and format
        (constructed / sealed). Rows that drop off the venue list are kept so
        the calendar can still show past events.

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


# Longest-first so 荔枝角 wins over a shorter prefix.
HK_AREAS = tuple(sorted({
    "尖沙咀", "荔枝角", "觀塘", "銅鑼灣", "旺角", "油麻地", "深水埗",
    "長沙灣", "美孚", "葵涌", "葵芳", "青衣", "荃灣", "屯門", "元朗",
    "天水圍", "上水", "粉嶺", "大埔", "沙田", "馬鞍山", "火炭", "大圍",
    "將軍澳", "九龍灣", "牛頭角", "藍田", "油塘", "黃大仙", "新蒲崗",
    "鑽石山", "彩虹", "九龍塘", "何文田", "紅磡", "土瓜灣", "佐敦",
    "太子", "中環", "金鐘", "上環", "西環", "灣仔", "天后", "炮台山",
    "北角", "鰂魚涌", "太古", "西灣河", "筲箕灣", "柴灣", "香港仔",
    "堅尼地城", "大角咀", "石硤尾", "慈雲山", "樂富", "東涌",
}, key=len, reverse=True))


def hk_district(address):
    """Area name at the start of a Hong Kong street address (觀塘, 尖沙咀, …)."""
    s = re.sub(r"\s+", "", address or "")
    for area in HK_AREAS:
        if s.startswith(area):
            return area
    return ""


def infer_format(name, description):
    """Return 'constructed', 'sealed', or '' from Mato copy.

    Monthly events say "constructed decks" and only ask players to buy packs.
    Sealed / 即開 copy says the deck is built from packs purchased on site.
    """
    blob = f"{name or ''}\n{description or ''}"
    low = blob.lower()
    sealed = (
        "即開" in blob or "開包" in blob or "sealed" in low
        or "purchased on-site" in low or "purchased on site" in low
    )
    constructed = ("構築" in blob) or ("constructed" in low)
    if sealed and not (
        constructed
        and "constructed deck" in low
        and "purchased on-site" not in low
        and "purchased on site" not in low
        and "即開" not in blob
        and "開包" not in blob
        and "sealed" not in low
    ):
        return "sealed"
    if constructed:
        return "constructed"
    return ""


def ld_events(html):
    found = []
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(block)
        except ValueError:
            continue
        if isinstance(d, dict) and d.get("@type") == "Event":
            found.append(d)
            continue
        nodes = d if isinstance(d, list) else d.get("@graph", [d])
        for it in nodes:
            if isinstance(it, dict) and it.get("@type") == "Event":
                found.append(it)
    return found


def event_record(node, fallback_url=""):
    """Map a schema.org Event to a news.json hk row."""
    if not isinstance(node, dict):
        return None
    name = node.get("name") or ""
    start = node.get("startDate") or ""
    end = node.get("endDate") or ""
    url = node.get("url") or fallback_url or ""
    loc = node.get("location") or {}
    venue = loc.get("name", "") if isinstance(loc, dict) else ""
    address = ""
    if isinstance(loc, dict):
        addr = loc.get("address") or {}
        if isinstance(addr, dict):
            address = (addr.get("streetAddress") or "").strip()
        elif isinstance(addr, str):
            address = addr.strip()
    slug = url.rstrip("/").rsplit("/", 1)[-1] if url else ""
    date = start[:10]
    if not slug or not re.match(r"20\d{2}-\d{2}-\d{2}$", date):
        return None
    rec = {
        "id": "mato-" + slug,
        "title": name,
        "date": date,
        "time": start[11:16] if len(start) >= 16 else "",
        "venue": venue,
        "category": "event",
        "url": url or MATO_VENUE,
        "source": "Saka Saka · Mato",
    }
    if len(end) >= 16:
        rec["end_time"] = end[11:16]
    if address:
        rec["address"] = address
        dist = hk_district(address)
        if dist:
            rec["district"] = dist
    fmt = infer_format(name, node.get("description") or "")
    if fmt:
        rec["format"] = fmt
    return rec


def fetch_event_node(url, fallback=None):
    """Event-page JSON-LD has the shop address; the venue list often repeats the organiser."""
    if not url:
        return fallback
    try:
        html = get(url)
    except Exception as e:
        print(f"[warn] event page {url}: {e}", file=sys.stderr)
        return fallback
    events = ld_events(html)
    if not events:
        return fallback
    for ev in events:
        if ev.get("url") == url or "hero rush" in (ev.get("name") or "").lower():
            return ev
    return events[0]


def fetch_hk():
    html = get(MATO_VENUE)
    items = []
    seen = set()
    for it in ld_events(html):
        name = it.get("name") or ""
        if "hero rush" not in name.lower():
            continue
        url = it.get("url") or ""
        node = fetch_event_node(url, it)
        rec = event_record(node, url)
        if not rec or rec["id"] in seen:
            continue
        seen.add(rec["id"])
        items.append(rec)
    items.sort(key=lambda i: (i["date"], i.get("time", ""), i["id"]))
    return items


def merge_hk_history(fresh, old_items, ovr):
    """Keep dated hk rows after they leave the Mato venue list, and backfill override ids.

    The calendar hides past events by default; dropping them here would make
    「顯示已結束賽事」 empty. Override copy is merged later by id.
    """
    by_id = {}
    for it in fresh:
        if it.get("id"):
            by_id[it["id"]] = it
    for prev in old_items or []:
        oid = prev.get("id")
        if oid and oid not in by_id and prev.get("date"):
            by_id[oid] = prev
    for oid, ov in (ovr or {}).items():
        if not str(oid).startswith("mato-") or oid in by_id:
            continue
        url = (ov.get("source_url") or ov.get("url") or "").strip()
        if "ma.to/event/" not in url:
            continue
        node = fetch_event_node(url, None)
        rec = event_record(node, url) if node else None
        if not rec:
            print(f"[warn] hk history missing {oid}", file=sys.stderr)
            continue
        rec["id"] = oid
        by_id[oid] = rec
    items = list(by_id.values())
    items.sort(key=lambda i: (i.get("date", ""), i.get("time", ""), i.get("id", "")))
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
    hk_only = "--hk-only" in sys.argv
    old = json.loads(OUT.read_text("utf-8")) if OUT.exists() else {}
    ovr = json.loads(OVR.read_text("utf-8")) if OVR.exists() else {}
    out = {"updated": old.get("updated", ""), "intl": old.get("intl", []), "hk": old.get("hk", [])}
    ok = False
    hk_fetched = False
    jobs = (("hk", fetch_hk),) if hk_only else (("intl", fetch_intl), ("hk", fetch_hk))
    for key, fn in jobs:
        try:
            items = fn()
            if items:
                out[key] = items
                ok = True
                if key == "hk":
                    hk_fetched = True
        except Exception as e:  # keep previous data for this source
            print(f"[warn] {key} fetch failed: {e}", file=sys.stderr)
    if hk_fetched:
        out["hk"] = merge_hk_history(out["hk"], old.get("hk") or [], ovr)
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
