# Eclipse Order Dashboard

A React dashboard built with Vite. Roster changes are saved in the current
browser's local storage; they are not shared between visitors or devices.

## Run locally

```sh
npm ci
npm run dev
```

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys the site on
each push to `main`. In the repository's **Settings → Pages**, set the build
and deployment source to **GitHub Actions**. The first deployment is available
at `https://<owner>.github.io/<repository>/`.
