# Dan Li — Personal Site (Static)

This is a minimal static site scaffold (HTML/CSS/JS) deployed via GitHub Pages. No build tools or frameworks are required.

## Structure

- `index.html` — one‑page layout with section anchors (Hero, About, Work, Contact)
- `assets/css/main.css` — base tokens, layout, right‑side nav
- `assets/js/main.js` — smooth scroll + scrollspy (reduced‑motion aware)
- `assets/svg/` — placeholder for silver thread SVGs
- `assets/img/` — add thumbnails when needed

## Local preview

Open `index.html` directly or run a simple server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy (GitHub Pages)

This repo name (`dan-li-o.github.io`) serves Pages from the root of the `main` branch automatically. Push to `main` and Pages will update.

## CI

- Link check workflow runs Lychee on `**/*.html` for PRs, pushes, and weekly.

## Next steps (Milestones)

1) Thread line‑draw (hero→about) and text reveals using GSAP + ScrollTrigger.
2) Pinned “Work” mirror animation (front/back faces) with reduced‑motion fallback.
3) Weave/converge sequences and CTA circle draw.
4) Polish: typography, a11y, performance, SEO/social cards.
