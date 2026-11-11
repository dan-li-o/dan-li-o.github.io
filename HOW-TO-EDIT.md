# How to edit the site

Everything on the homepage comes from one file: **`data/network.yml`**.
Change it, save (commit), and the site updates by itself in about a minute.

## From your phone (GitHub app or github.com)

1. Open the repo **dan-li-o/dan-li-o.github.io** → `data` → `network.yml`.
2. Tap the pencil ✎ to edit.
3. Make your change, then **Commit changes**.
4. In a minute or two the live site updates. If something was mistyped, the
   **Actions** tab shows a red ✗ with a plain explanation, and the live site
   stays as it was until you fix it.

## Add a node

Copy a block like this to the right section and change it:

```yaml
- id: kyoto             # short, unique, no spaces
  type: city            # city | school | person | field | topic | hobby | work
  label: Kyoto
  year: 2027            # when it enters your life
  links: [japanese]     # ids it connects to
```

Optional lines:

| line | what it does |
|---|---|
| `end: 2030` | the year it ended (shown in the card) |
| `size: 2` | 1 small (default), 2 medium, 3 large |
| `note: one short line` | shown when someone taps it |
| `short: Brief name` | for medium and large nodes: shown for a moment as the node arrives (defaults to the label) |
| `url: https://...` | adds an "Open ↗" link |
| `private: true` | shows the dot but hides the name |
| `arrives: born` | grows out of its neighbor instead of fading in (works do this automatically) |

Lines starting with `#` are notes to yourself; the site ignores them.

## Update the CV

The **CV** button opens `/cv/`, built from **`data/cv.md`**.

- Each entry is one line: `- **2023** · What happened`
- Details go underneath, indented four spaces: `    - Advisor: …`
- Section titles start with `## `; sub-titles with `### `.
- Links: `[text](https://…)`. Italics: `*Title*`. Bold: `**Li, D.**`
- To offer a PDF, add it as `static/cv.pdf`. A "Download PDF" button appears
  on the CV page by itself.

## How links work

- Write a link on **either** node, once. `links: [a, b]`
- A line draws in the animation when **both** of its nodes are on screen.

## Colors

Places (city, school) are blue; people orange; ideas (field, topic, hobby)
green; works purple. Schools are rings; hobbies are lighter.

## On a computer (WSL + Claude Code)

```bash
cd ~/dan-li-o.github.io
python3 tools/build.py          # checks the data and builds _site/index.html
python3 -m http.server -d _site 8000   # preview at http://localhost:8000
git add -A && git commit -m "Update network" && git push
```

Or just ask Claude Code: *"Add a node for … linked to …, check it with
tools/build.py, and push."*
