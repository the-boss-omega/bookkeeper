# Routines

A simple, beautiful routine tracker with an iPhone-style design.

**Today**
- Routines grouped by morning, afternoon, evening and anytime, each with its own emoji and color
- Tap the circle to mark a day ✅ done, ❌ not done, or 💤 not needed (not needed never breaks a streak)
- Progress ring, perfect-day streak, and a week strip you can page through
- Choose which weekdays each routine repeats on, and move one week's session to another day without changing the usual schedule
- 🎉 Confetti when everything is done

**Stats**
- Perfect-day streak, total completions, 30-day completion rate, best streak
- Completion chart by week, month or year, with change vs. the previous period
- 17-week heatmap, best and toughest weekday, and per-routine rates and streaks

**Settings**
- Light / dark / automatic theme, week start day, celebrations and haptics
- Export / import backups, erase all data

Works offline and installs on your phone's home screen (PWA). Your data stays in your browser (`localStorage`).
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
