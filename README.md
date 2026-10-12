# Routines

A calm, minimal tracker for your daily routines.

- Check off routines each day, with a progress ring and a 7-day strip
- Tap a past day to fill in something you forgot
- Streaks for each routine
- Works offline and installs on your phone's home screen (PWA)
- Light and dark mode
- Your data stays in your browser (`localStorage`). Use **Export / Import** to back it up or move it to another device.

Plain HTML, CSS and JavaScript. No build step, no dependencies, no server.

## Host it for free (GitHub Pages)

1. Merge this into `main`.
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` deploys automatically via `.github/workflows/pages.yml`.
   Your app will be at `https://<your-username>.github.io/<repo-name>/`.

> GitHub Pages is free for public repos. For a private repo, use [Cloudflare Pages](https://pages.cloudflare.com) or [Netlify](https://netlify.com) instead (also free): connect the repo, leave the build command empty and set the output directory to `/`.

## Install on your phone

Open the site, then:
- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ → Install app

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
