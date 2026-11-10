"""Check data/network.yml and build the site into _site/.

Run:  python3 tools/build.py
Fails with a plain message if the data has a mistake, so a typo never reaches the live site.
"""
import html
import pathlib
import shutil
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "network.yml"
TEMPLATE = ROOT / "src" / "template.html"
OUT = ROOT / "_site"
STATIC = ROOT / "static"   # anything here is published as-is (e.g. static/cv.pdf -> /cv.pdf)

TYPES = {"city", "school", "person", "field", "topic", "hobby", "work"}
ALLOWED = {"id", "type", "label", "label_zh", "year", "end", "size", "links",
           "url", "note", "private", "arrives"}


def fail(msg):
    print(f"\n✗ network.yml has a problem:\n  {msg}\n")
    sys.exit(1)


def check(nodes):
    if not isinstance(nodes, list) or not nodes:
        fail("the file should be a list of nodes, each starting with '- id:'")
    ids = set()
    for i, n in enumerate(nodes, 1):
        where = f"node #{i}" + (f" ('{n.get('id')}')" if isinstance(n, dict) and n.get("id") else "")
        if not isinstance(n, dict):
            fail(f"{where} is not written as 'key: value' lines")
        for k in ("id", "type", "label", "year"):
            if k not in n:
                fail(f"{where} is missing '{k}:'")
        if " " in str(n["id"]):
            fail(f"{where}: id can't contain spaces")
        if n["id"] in ids:
            fail(f"id '{n['id']}' is used twice")
        ids.add(n["id"])
        if n["type"] not in TYPES:
            fail(f"{where}: type '{n['type']}' should be one of {', '.join(sorted(TYPES))}")
        if not isinstance(n["year"], int) or not 1900 <= n["year"] <= 2100:
            fail(f"{where}: year should be a number like 2017")
        if "end" in n and (not isinstance(n["end"], int) or n["end"] < n["year"]):
            fail(f"{where}: end should be a year on or after {n['year']}")
        if "size" in n and n["size"] not in (1, 2, 3):
            fail(f"{where}: size should be 1, 2 or 3")
        if "links" in n and not isinstance(n["links"], list):
            fail(f"{where}: links should look like [a, b, c]")
        extra = set(n) - ALLOWED
        if extra:
            fail(f"{where}: unknown field(s) {', '.join(sorted(extra))} (typo?)")
    for n in nodes:
        for l in n.get("links", []) or []:
            if l not in ids:
                fail(f"'{n['id']}' links to '{l}', but no node has that id")


def noscript_list(nodes):
    groups = [("Works", lambda n: n["type"] == "work"),
              ("Places", lambda n: n["type"] in ("city", "school")),
              ("People", lambda n: n["type"] == "person" and not n.get("private")),
              ("Ideas", lambda n: n["type"] in ("field", "topic", "hobby"))]
    out = ["<h1>Dan Li</h1><p>Philosopher of science · AI, machine learning and climate science</p>"]
    for title, f in groups:
        out.append(f"<h2>{title}</h2><ul>")
        for n in sorted(filter(f, nodes), key=lambda n: -n["year"]):
            lab = html.escape(n["label"])
            if n.get("url"):
                lab = f'<a href="{html.escape(n["url"])}">{lab}</a>'
            out.append(f"<li>{n['year']} · {lab}</li>")
        out.append("</ul>")
    return "".join(out)


def main():
    text = DATA.read_text(encoding="utf-8")
    try:
        nodes = yaml.safe_load(text)
    except yaml.YAMLError as e:
        fail(f"couldn't read the file (often a missing space after ':' or a stray quote).\n  {e}")
    check(nodes)
    if "</script" in text.lower():
        fail("the text '</script' can't appear in the data")
    page = TEMPLATE.read_text(encoding="utf-8")
    page = page.replace("__YAML__", text).replace("__NOSCRIPT__", noscript_list(nodes))
    if OUT.exists():
        shutil.rmtree(OUT)
    if STATIC.exists():
        shutil.copytree(STATIC, OUT)
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(page, encoding="utf-8")
    links = {tuple(sorted((n["id"], l))) for n in nodes for l in (n.get("links") or [])}
    print(f"✓ {len(nodes)} nodes, {len(links)} links. Built _site/index.html")


if __name__ == "__main__":
    main()
