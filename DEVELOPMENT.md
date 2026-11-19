# Development

## Run it

```sh
npm ci
npm run dev
```

Open `http://localhost:5173/usual/`. The site is always served under `/usual/`, as on GitHub Pages.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm test` | Runs the tests: the logic, every page, the pages driven in jsdom, and a check that fails on any hex colour |
| `npm run build` | Type-checks, then builds the site into `dist/` |
| `npm run preview` | Serves `dist/` at `http://localhost:4173/usual/` |

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`. It runs the tests, builds, and publishes `dist/` to GitHub Pages at `https://<username>.github.io/usual/`. In the repository's Pages settings, the source must be GitHub Actions.

The workflow passes the repository's Pages address to the build as `VITE_SITE_URL`, and canonical and Open Graph links are built from it. A local build uses the preview address.
