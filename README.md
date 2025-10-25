# Dan Li — Personal Site

Minimal one-page site authored in plain HTML/CSS/JS and deployed from the repository root via GitHub Pages. No bundlers or frameworks required.

## Structure

- `index.html` — hero, featured work, quote, about, and contact sections
- `styles.css` — tokens, layout, grid background, and micro-illustrations
- `script.js` — reduced-motion-friendly reveal + scrollspy + dynamic year
- `.nojekyll` — disables GitHub Pages’ default Jekyll processing

## Local preview

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Deploy

Repo name (`dan-li-o.github.io`) means pushes to `main` instantly update Pages. No extra build step—keep static assets at the root.
