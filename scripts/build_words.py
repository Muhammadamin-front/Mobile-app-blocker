#!/usr/bin/env python3
"""Build the English word deck the block screen can show instead of a book.

Source: the New General Service List 1.2 by Browne, Culligan and Phillips, with
its easy-English definitions, licensed CC BY-SA 4.0. The deck takes NGSL ranks
1001-2000 — past the everyday core, into the B1-B2 band that IELTS and CEFR
preparation lives in. The Uzbek glosses in scripts/words/uz_glosses.tsv were
written for this app and, as an adaptation, are shared under the same license.
A third column there replaces an NGSL definition that reads poorly on its own.

Run from the repository root:  python3 scripts/build_words.py
Output: android/app/src/main/assets/words/ngsl-b1b2.json
"""

import csv
import io
import json
import os
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile

BASE = "https://www.newgeneralservicelist.com/s/"
OUT = os.path.join("android", "app", "src", "main", "assets", "words", "ngsl-b1b2.json")
GLOSSES = os.path.join("scripts", "words", "uz_glosses.tsv")
FIRST, LAST = 1001, 2000


def fetch(name):
    return subprocess.run(["curl", "-sL", BASE + name], capture_output=True, check=True).stdout


def ranks():
    text = fetch("NGSL_12_stats.csv").decode("utf-8-sig")
    return {row["Lemma"].strip().lower(): int(row["SFI Rank"]) for row in csv.DictReader(io.StringIO(text))}


def definitions():
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with tempfile.TemporaryFile() as handle:
        handle.write(fetch("NGSL_12_with_English_definitions.xlsx"))
        book = zipfile.ZipFile(handle)
        shared = [
            "".join(t.text or "" for t in si.iter("{%s}t" % ns["m"]))
            for si in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", ns)
        ]
        result = {}
        sheet = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
        for row in list(sheet.iter("{%s}row" % ns["m"]))[1:]:
            cells = []
            for cell in row.findall("m:c", ns):
                value = cell.find("m:v", ns)
                text = "" if value is None else value.text
                cells.append(shared[int(text)] if cell.get("t") == "s" and text else text)
            if len(cells) >= 2 and cells[0]:
                result[cells[0].strip().lower()] = " ".join((cells[1] or "").split())
        return result


def glosses():
    result = {}
    with open(GLOSSES, encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.rstrip("\n").split("\t")
            result[parts[0]] = (parts[1], parts[2] if len(parts) > 2 and parts[2] else None)
    return result


def main():
    rank = ranks()
    meaning = definitions()
    uz = glosses()
    words = []
    for lemma, position in sorted(rank.items(), key=lambda item: item[1]):
        if not FIRST <= position <= LAST or lemma not in uz:
            continue  # words without a gloss were left out on purpose
        gloss, override = uz[lemma]
        words.append({"w": lemma, "d": override or meaning.get(lemma, ""), "uz": gloss})
    deck = {
        "id": "ngsl-b1b2",
        "title": "English words · B1–B2",
        "source": "New General Service List 1.2 (Browne, Culligan & Phillips), ranks 1001–2000",
        "license": "CC BY-SA 4.0. Uzbek glosses written for Qoriqchi, shared under the same license.",
        "url": "https://www.newgeneralservicelist.com",
        "words": words,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(deck, handle, ensure_ascii=False, separators=(",", ":"))
    missing = [w for w in uz if w not in rank]
    print(f"{len(words)} words -> {OUT}" + (f"; glosses with no NGSL entry: {missing}" if missing else ""))


if __name__ == "__main__":
    main()
