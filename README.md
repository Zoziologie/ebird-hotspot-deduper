# eBird Hotspot Deduper

A minimal Vue 3 static web app that helps find likely duplicate eBird hotspots within a region.

The app:
- asks for your eBird API token in an entry modal and stores it in `localStorage`
- lets you search region by name (country/state) and resolves the region code
- fetches hotspots from `GET /v2/ref/hotspot/{regionCode}`
- computes hotspot pairs under a distance threshold slider (default `10` meters)
- sorts candidates by distance (nearest first)
- shows candidates in a list and on a Leaflet map
- links each hotspot directly to the eBird edit page (`https://ebird.org/mylocations/edit/{locId}`)

## Tech stack

- Vue 3 + Vite
- Bootstrap 5
- Leaflet (OpenStreetMap tiles)
- No backend (browser-only API calls)

## Local development

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open the app, then provide:
- eBird API token
- region name (select one of the returned options)
- optional threshold using the slider

Region name lookup uses eBird region endpoints:
- `GET /v2/ref/region/list/country/world`
- `GET /v2/ref/region/list/subnational1/{countryCode}`

## Build static site

```bash
npm run build
```

Build output is written to `dist/` and can be hosted as a static site.

## GitHub Pages

This repository includes `.github/workflows/deploy-pages.yml` that:
- builds the app on pushes to `main`
- sets `VITE_BASE_PATH=/${{ github.event.repository.name }}/`
- deploys `dist/` to GitHub Pages

### One-time GitHub settings

1. In GitHub: `Settings` -> `Pages`
2. Under **Build and deployment**, set **Source** to **GitHub Actions**

## Notes

- The app stores API token, selected region, threshold, and filter setting in `localStorage` for convenience.
- The eBird hotspot payload may not always include checklist counts; those values are shown as `n/a` when unavailable.
