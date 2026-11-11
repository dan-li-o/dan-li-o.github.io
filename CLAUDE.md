# Dan Li's personal site (dan-li-o.github.io)

A single-page site: an animated network of Dan's life built with D3.

- **Data:** `data/network.yml` is the only file that normally changes. Format and rules are in `HOW-TO-EDIT.md`.
- **Page:** `src/template.html` holds the page, styles and D3 code. `__YAML__` and `__NOSCRIPT__` are filled in by the build.
- **CV:** `data/cv.md` (Markdown; entries `- **2023** · text`, details indented four spaces) is rendered with `src/cv.html` to `_site/cv/index.html`. The CV button on the homepage links there. `static/cv.pdf`, if present, adds a Download PDF button.
- **Build:** `python3 tools/build.py` (needs `pyyaml` and `markdown`) checks the data (ids unique, links point to real ids, years are numbers, size 1–3) and writes `_site/index.html` and `_site/cv/index.html`. Anything in `static/` is copied to the site root as-is (e.g. `static/cv.pdf`).
- **Publish:** pushing to `main` runs `.github/workflows/site.yml`, which checks, builds and publishes `_site/` to the `gh-pages` branch (Pages serves from `gh-pages`). Pull requests are checked but not published.
- **The book** lives in its own Quarto repo and is served at `/3body`. Never add a `3body` folder or page here.
- **Preview:** `python3 -m http.server -d _site 8000`.

When editing the data: keep one node per `- id:` block, list each link once, and run the build before pushing. Children appear only by nickname (Millie, Lulu) with the note "a human cub".
