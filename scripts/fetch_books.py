#!/usr/bin/env python3
"""Fetch the bundled public-domain Uzbek books from Wikisource.

The app ships these texts inside the APK so it stays fully offline. Only works
whose authors died long enough ago to be in the public domain are listed:
Uzbek copyright runs for the author's life plus 50 years, and both authors here
died in 1938. Wikisource is the source of record and is credited in the app.

Run from the repository root:  python3 scripts/fetch_books.py [--skip-novels]
Output: android/app/src/main/assets/books/<id>.json

Requests are paced and retried with backoff, because Wikisource rate-limits.
"""

import hashlib
import html
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from html.parser import HTMLParser

API = "https://wikisource.org/w/api.php"
USER_AGENT = "QoriqchiBot/1.0 (open-source offline focus app)"
OUT_DIR = os.path.join("android", "app", "src", "main", "assets", "books")
# Raw API answers, so re-running the cleanup never waits on Wikisource's rate limit.
CACHE_DIR = os.path.join("scripts", ".wikisource-cache")

BOOKS = [
    {
        "id": "otkan-kunlar",
        "title": "O‘tkan kunlar",
        "author": "Abdulla Qodiriy",
        "year": 1926,
        "prefix": "O'tkan kunlar/",
        "page": "O'tkan kunlar",
    },
    {
        "id": "kecha-va-kunduz",
        "title": "Kecha va kunduz",
        "author": "Cho‘lpon",
        "year": 1936,
        "prefix": "Kecha va kunduz/",
        "page": "Kecha va kunduz",
    },
]

LICENSE = "Public domain: the author died in 1938 (Uzbek copyright lasts life + 50 years)."

# A one-page work split into chapters at its upper-case headings ("AXLOQ", "XULQ").
SINGLE_BOOKS = [
    {
        "id": "turkiy-guliston",
        "title": "Turkiy Guliston yoxud axloq",
        "author": "Abdulla Avloniy",
        "year": 1913,
        "page": "Turkiy Guliston yoxud axloq",
        "license": "Public domain: the author died in 1934 (Uzbek copyright lasts life + 50 years).",
    },
]

# Poems from several pages, one chapter each, line breaks kept. Every poet here died
# by 1938, so the whole anthology is public domain under life + 50 years.
ANTHOLOGY = {
    "id": "jadid-sheriyati",
    "title": "Jadid she’riyati",
    "author": "Cho‘lpon, Fitrat, Avloniy, Hamza, Qodiriy",
    "year": 0,  # poems from 1913 to the 1930s; no single year is honest
    "license": "Public domain: every poet in it died by 1938 (Uzbek copyright lasts life + 50 years).",
    "poems": [
        ("Cho‘lpon", "Cho‘lpon", ["Binafsha", "Bahorni sog'indim...", "Buzilgan O'lkaga", "Boychechak", "Go'zal",
                      "Kishan", "Ko'ngil", "Xalq", "Yana oldim sozimni", "Kuz guliga", "Oydin kechalarda",
                      "Qalandar Ishqi", "Toshqun", "Tong", "Oʻzbegim", "Erkinlik istagi",
                      "Ko‘klam keladir", "Sharq nuri", "Daryo bo’yi", "Xayol"]),
        ("Fitrat", "Abdurauf Fitrat", ["Mirrix yulduziga", "Qor", "Yurt qayg‘usi (1917)", "Yurt qayg‘usi (1920)",
                             "Musulmon sevgisi", "Oʻgut", "Bir oz kul", "Goʻzalim, bevafo gulistonim...",
                             "Mening kecham", "Behbudiyning sagʻanasin izladim"]),
        ("Avloniy", "Abdulla Avloniy", ["Ilm", "Maktab haqinda", "Chin do'st", "Olam ichra ko‘rmadim", "Biz, millat",
                             "Istamas", "Hijron so'zi", "Sadoqat bizda yo‘qdur", "Falak kajrav, yo rab", "Afsus"]),
        ("Hamza", "Hamza Hakimzoda Niyoziy", ["O‘qi", "Kitob", "Ilm ista", "Maktab", "To‘g‘ri so‘zla",
                                     "Ona (Hamza Hakimzoda Niyoziy)", "Ey ko‘ngil", "Ayrilmasun", "Bu falak",
                                     "Dardiga darmon istamas", "Jonlarni jononi Vatan", "Yigitlar tovushi", "Sog‘inub"]),
        ("Qodiriy", "Abdulla Qodiriy", ["Ahvolimiz", "Fikr aylag‘il", "Taraqqiy (Abdulla Qodiriy)",
                             "Salomnoma (Abdulla Qodiriy)", "To‘y", "Millatimga bir qaror", "Tilak"]),
    ],
}

# Wikisource's licence box, in English, at the foot of every PD-Uzbekistan page.
LICENSE_FOOTER = re.compile(r"\n\nThis work is (first published|in the public domain).*", re.S)

# Containers that are navigation, credits or apparatus rather than the novel.
DROP_CLASSES = (
    "ws-header", "headertemplate", "ws-noexport", "noprint", "mw-editsection",
    "reference", "references", "navbox", "licenseContainer", "PDlicense",
    "mw-references-wrap", "toc",
)
DROP_TAGS = {"sup", "table", "style", "script", "figure"}
VOID_TAGS = {"br", "hr", "img", "meta", "link", "input", "wbr"}
BLOCK_TAGS = {"p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "dd"}


def api(**params):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    cached = os.path.join(CACHE_DIR, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(cached):
        with open(cached, encoding="utf-8") as handle:
            return json.load(handle)
    for attempt in range(6):
        out = subprocess.run(
            ["curl", "-sL", "-A", USER_AGENT, url],
            capture_output=True, text=True, check=False,
        ).stdout
        if out.startswith("{"):
            time.sleep(1.5)  # be polite between successful requests too
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(cached, "w", encoding="utf-8") as handle:
                handle.write(out)
            return json.loads(out)
        wait = 15 * (attempt + 1)
        print(f"  rate limited, waiting {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise SystemExit(f"gave up on {url}")


class TextExtractor(HTMLParser):
    """Collects readable paragraphs, skipping headers, notes and navigation."""

    def __init__(self, keep_lines=False):
        super().__init__(convert_charrefs=True)
        self.keep_lines = keep_lines
        self.stack = []      # (tag, dropping)
        self.drop_depth = 0
        self.parts = []
        self.heading = None
        self.in_heading = False

    def handle_starttag(self, tag, attrs):
        if tag in VOID_TAGS:
            if tag == "br" and not self.drop_depth:
                self.parts.append("\n")
            return
        classes = dict(attrs).get("class", "") or ""
        drop = tag in DROP_TAGS or any(name in classes.split() for name in DROP_CLASSES)
        if drop:
            self.drop_depth += 1
        self.stack.append((tag, drop))
        if not self.drop_depth and tag in ("h2", "h3", "h4") and self.heading is None:
            self.in_heading = True
        if not self.drop_depth and tag in BLOCK_TAGS:
            self.parts.append("\n\n")

    def handle_endtag(self, tag):
        # "<br />" reaches here too (HTMLParser closes self-closing tags), but a void
        # tag was never pushed and must not end a paragraph a second time.
        if tag in VOID_TAGS:
            return
        while self.stack:
            open_tag, drop = self.stack.pop()
            if drop:
                self.drop_depth -= 1
            if open_tag == tag:
                break
        if tag in ("h2", "h3", "h4"):
            self.in_heading = False
        if not self.drop_depth and tag in BLOCK_TAGS:
            self.parts.append("\n\n")

    def handle_data(self, data):
        if self.drop_depth:
            return
        if self.keep_lines:
            # In verse a line ends at <br>; the newline after it in the source is not
            # a second break, or every line would become its own stanza.
            data = data.replace("\n", " ")
        if self.in_heading:
            self.heading = ((self.heading or "") + data).strip() or None
            return
        self.parts.append(data)

    def text(self):
        raw = "".join(self.parts)
        raw = html.unescape(raw).replace(" ", " ")
        paragraphs = []
        for block in re.split(r"\n\s*\n", raw):
            if self.keep_lines:
                # Verse: each line stays a line.
                lines = [re.sub(r"[ \t]+", " ", part).strip() for part in block.split("\n")]
                line = "\n".join(part for part in lines if part)
            else:
                line = re.sub(r"[ \t]+", " ", block.replace("\n", " ")).strip()
            if line:
                paragraphs.append(line)
        return LICENSE_FOOTER.sub("", "\n\n".join(paragraphs))


NAV_LINE = re.compile(r"^(by\s.+|\d{1,3}|[\u2190\u2192\u2191\u2193<>|]+|\u2190.*|.*\u2192)$")
NUMBERED_TITLE = re.compile(r"^\d{1,3}\.\s+(.{2,80})$")


def clean_chapter(text, fallback_title):
    """Drop the Wikisource header remnants and lift the chapter name into the title.

    A chapter page opens with the work's credit ("by ..."), the chapter number, the
    previous/next links and an arrow; the numbered line among them is the real
    chapter name, e.g. "01. Otabek Yusufbek Hoji O'g'li".
    """
    paragraphs = text.split("\n\n")
    title = fallback_title
    while paragraphs:
        head = paragraphs[0].strip()
        named = NUMBERED_TITLE.match(head)
        if named and title == fallback_title:
            title = named.group(1).strip()
            paragraphs.pop(0)
        elif NAV_LINE.match(head) or named:
            paragraphs.pop(0)
        else:
            break
    return title, "\n\n".join(paragraphs).strip()


def chapter_pages(prefix):
    pages = api(action="query", list="allpages", apprefix=prefix, aplimit=500)
    titles = [p["title"] for p in pages["query"]["allpages"]]
    # Natural order: "/2" before "/10".
    def key(title):
        tail = title[len(prefix):]
        numbers = re.findall(r"\d+", tail)
        return (int(numbers[0]) if numbers else 10**6, tail)
    return sorted(titles, key=key)


def fetch(book):
    print(f"{book['title']}:", file=sys.stderr)
    chapters = []
    for index, title in enumerate(chapter_pages(book["prefix"]), start=1):
        parsed = api(action="parse", page=title, prop="text", disablelimitreport=1)
        extractor = TextExtractor()
        extractor.feed(parsed["parse"]["text"]["*"])
        text = extractor.text()
        if len(text) < 200:
            print(f"  skipped {title}: too little text", file=sys.stderr)
            continue
        title, text = clean_chapter(text, extractor.heading or f"{index}-bob")
        chapters.append({"title": title, "text": text})
        print(f"  {title}: {len(text)} chars", file=sys.stderr)
    return {
        "id": book["id"],
        "title": book["title"],
        "author": book["author"],
        "year": book["year"],
        "license": LICENSE,
        "source": "https://wikisource.org/wiki/" + urllib.parse.quote(book["page"].replace(" ", "_")),
        "chapters": chapters,
    }


CAPS_HEADING = re.compile(r"^[A-ZʻʼÕÖÜ‘’'O\u2018\u2019\s«»\-]{3,40}$")


def fetch_single(book):
    """One page, split into chapters at its upper-case headings."""
    print(f"{book['title']}:", file=sys.stderr)
    parsed = api(action="parse", page=book["page"], prop="text", disablelimitreport=1)
    extractor = TextExtractor(keep_lines=True)
    extractor.feed(parsed["parse"]["text"]["*"])
    paragraphs = extractor.text().split("\n\n")
    while paragraphs and NAV_LINE.match(paragraphs[0].strip()):
        paragraphs.pop(0)
    chapters, title, body = [], "Muqaddima", []
    for paragraph in paragraphs:
        if CAPS_HEADING.match(paragraph.strip()) and any(ch.isalpha() for ch in paragraph):
            if body:
                chapters.append({"title": title, "text": "\n\n".join(body)})
            title, body = paragraph.strip().capitalize(), []
        else:
            body.append(paragraph)
    if body:
        chapters.append({"title": title, "text": "\n\n".join(body)})
    print(f"  {len(chapters)} chapters", file=sys.stderr)
    return {
        "id": book["id"], "title": book["title"], "author": book["author"], "year": book["year"],
        "license": book["license"],
        "source": "https://wikisource.org/wiki/" + urllib.parse.quote(book["page"].replace(" ", "_")),
        "chapters": chapters,
    }


def fetch_anthology(book):
    """Each poem its own chapter, titled with its poet; pages that are prose are skipped."""
    print(f"{book['title']}:", file=sys.stderr)
    chapters = []
    for poet, _full_name, titles in book["poems"]:
        for title in titles:
            wikitext = api(action="parse", page=title, prop="wikitext")
            if "error" in wikitext or "<poem" not in wikitext["parse"]["wikitext"]["*"]:
                print(f"  skipped {title}: not found or not verse", file=sys.stderr)
                continue
            parsed = api(action="parse", page=title, prop="text", disablelimitreport=1)
            extractor = TextExtractor(keep_lines=True)
            extractor.feed(parsed["parse"]["text"]["*"])
            paragraphs = extractor.text().split("\n\n")
            while paragraphs and NAV_LINE.match(paragraphs[0].strip()):
                paragraphs.pop(0)
            text = "\n\n".join(paragraphs).strip()
            if len(text) < 80:
                continue
            # "(Abdulla Qodiriy)" only disambiguated the page; a year tells two poems apart.
            name = re.sub(r"\s*\((?!\d{4}\))[^)]*\)$", "", title)
            chapters.append({"title": f"{name} — {poet}", "text": text})
            print(f"  {name}: {len(text)} chars", file=sys.stderr)
    return {
        "id": book["id"], "title": book["title"], "author": book["author"], "year": book["year"],
        "license": book["license"], "source": "https://wikisource.org", "chapters": chapters,
    }


def reclean():
    """Re-run the cleanup over already downloaded books, without the network."""
    for book in BOOKS:
        path = os.path.join(OUT_DIR, book["id"] + ".json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        for index, chapter in enumerate(data["chapters"], start=1):
            fallback = chapter["title"] if not re.match(r"^\d+-bob$", chapter["title"]) else f"{index}-bob"
            chapter["title"], chapter["text"] = clean_chapter(chapter["text"], fallback)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        print(f"recleaned {path}", file=sys.stderr)


def main():
    if "--reclean" in sys.argv:
        reclean()
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    catalog = []
    # --skip-novels keeps the two long novels already on disk; they take hundreds of
    # rate-limited requests and their text does not change.
    if "--skip-novels" in sys.argv:
        with open(os.path.join(OUT_DIR, "catalog.json"), encoding="utf-8") as handle:
            kept = {entry["id"]: entry for entry in json.load(handle)}
        catalog = [kept[book["id"]] for book in BOOKS if book["id"] in kept]
        fetched = []
    else:
        fetched = [fetch(book) for book in BOOKS]
    fetched += [fetch_single(book) for book in SINGLE_BOOKS]
    fetched.append(fetch_anthology(ANTHOLOGY))
    for data in fetched:
        path = os.path.join(OUT_DIR, data["id"] + ".json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        size = sum(len(c["text"]) for c in data["chapters"])
        catalog.append({k: data[k] for k in ("id", "title", "author", "year", "license", "source")}
                       | {"chapters": len(data["chapters"]), "characters": size})
        print(f"  -> {path}: {len(data['chapters'])} chapters, {size} chars", file=sys.stderr)
    with open(os.path.join(OUT_DIR, "catalog.json"), "w", encoding="utf-8") as handle:
        json.dump(catalog, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
