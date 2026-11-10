# dan-li-o.github.io

Dan Li's personal site: one page, an animated network of the places, people,
ideas and works in her life, built with D3.

- **Edit the content:** `data/network.yml` (see [HOW-TO-EDIT.md](HOW-TO-EDIT.md)).
- **Build locally:** `pip install pyyaml && python3 tools/build.py`, then
  `python3 -m http.server -d _site 8000` and open http://localhost:8000.
- **Publish:** push to `main`. GitHub Actions checks the data, builds the page
  and publishes it to the `gh-pages` branch. A data mistake stops the publish
  and the live site stays as it was.
- **Extra files** (a CV PDF, images) go in `static/` and are published at the
  site root.

The book *Unlawful Laws* lives in its own repository and is served at
`/3body`. Don't add a `3body` folder or page here, or it would hide the book.
