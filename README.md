# Quarto Website

This repo contains the source for a Quarto website to be published with GitHub Pages. The rendered site is not tracked (see `.gitignore`).

## Prerequisites

- Install Quarto: https://quarto.org/docs/get-started/

## Local development

```bash
quarto preview
```

## Build

```bash
quarto render
```

## Publish to GitHub Pages (gh-pages branch)

This repo includes a GitHub Actions workflow that renders and publishes on pushes to `main`.

1. Push this repo to GitHub (`dan-li-o/dan-li-o.github.io`).
2. In the repo settings, set Pages to deploy from the `gh-pages` branch.
3. Push any changes to `main`; the action will render and update `gh-pages`.

Alternatively, you can publish locally using Quarto:

```bash
quarto publish gh-pages
```

This builds the site locally and pushes the rendered output to the `gh-pages` branch using the GitHub token.

