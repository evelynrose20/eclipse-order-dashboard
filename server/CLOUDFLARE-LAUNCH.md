# Eclipse Order — Publish Windows API through the existing Cloudflare Tunnel

This uses the existing **Eclipse-Order-API** Cloudflare Tunnel and the Windows Node API on port **3182**. Do **not** create another tunnel or open MySQL port 3306 in Windows Firewall/router.

## 1. Know the exact HTTPS website origin

For the repository's standard GitHub Pages deployment, the likely URL is:
\`https://evelynrose20.github.io/eclipse-order-dashboard/\`

The CORS **origin** for that URL is \`https://evelynrose20.github.io\` (NO repository path and NO trailing slash).

If your real published site has a custom domain, use its exact URL origin instead (for example \`https://orders.rosefires.com\`). Do not guess. The full page URL and API URL are different concepts.

The GitHub Pages workflow on the current Windows/MySQL implementation builds with:
\`VITE_ECLIPSE_API_URL=https://api.rosefires.com\`

That public URL contains **no secret**.

## 2. Backup and configure the existing Windows API

Make a HeidiSQL backup/export of \`eclipse_order\`, including your Domina account, before publishing.

Update the intended release revision on your PC, retaining your private \`server/.env\`.

In \`server/.env\`, keep DB_* unchanged and use:

\`\`\`ini
API_PORT=3182
API_PUBLIC_ENABLED=true
API_PUBLIC_HOST=api.rosefires.com
API_ALLOWED_ORIGIN=https://evelynrose20.github.io
\`\`\`

Replace the last value ONLY if your actual frontend is hosted under another HTTPS origin. Do not paste MySQL credentials into GitHub or this guide. Never put \`DB_PASSWORD\` in a Vite or GitHub Pages environment variable.

Stop the existing Windows API with Ctrl+C and restart from the **server folder**:

\`\`\`powershell
npm install
npm start
\`\`\`

The console must show:
\`Public routing ENABLED for api.rosefires.com\`
and the exact HTTPS allowed website origin.

The API continues listening **only on 127.0.0.1:3182**. The tunnel connects locally. \`npm run dev\` is for development; \`npm start\` is the non-watch entrypoint. **Do not run both in separate windows.**

## 3. Publish the EXISTING Cloudflare Tunnel

Cloudflare Zero Trust dashboard → **Networking → Tunnels → Eclipse-Order-API → Routes → Add route → Published application**.

Use:

- **Hostname:** \`api.rosefires.com\` (subdomain \`api\`, domain \`rosefires.com\`)
- **Service type:** HTTP
- **Service URL:** \`http://127.0.0.1:3182\`
- **Path:** leave empty (serve all API routes)
- **HTTP Host Header:** leave unset/default, so Node sees \`api.rosefires.com\`
- Cloudflare will create the tunnel DNS mapping when saving the published route (if you have an existing conflicting DNS record, reconcile it instead of duplicating).

Do **NOT** publish port 3306, point the route to port 5173, disable TLS checks globally, or create a duplicate tunnel service.

## 4. Protect the login and registration endpoints

In Cloudflare's **Security → Security rules**, add zone-level rate limits on the API hostname's \`/auth/login\` and \`/auth/register\` requests. Suggested starting threshold: 10 requests per IP per minute for login, and fewer for registration; choose **Block** when the rate is exceeded. Tune to your usage and Cloudflare plan. Do not use a browser **Managed Challenge** on these API JSON requests unless implementing Turnstile/Pre-Clearance: an AJAX client cannot display Cloudflare's HTML challenge.

The Node API also uses account- and visitor-based login throttles, registration throttles, randomized password hashing, revocable sessions, and required manual Domina approval. These are starter protections; you still need secure recovery/email verification and ongoing security maintenance for public launch.

Never put Cloudflare Access login protection in front of **the whole API** if the website is intended for visitors to self-register without an additional Access account. If you choose Access, the browser architecture must be updated accordingly.

## 5. Verify HTTPS + CORS + login

From Windows PowerShell:

\`\`\`powershell
Invoke-RestMethod https://api.rosefires.com/health
\`\`\`

Expected: \`status: ok\`. If this is unreachable, inspect Cloudflare Tunnel routes and the Node server console. A healthy tunnel alone does NOT prove the API route is configured.

Test the CORS allowlist for your website origin:

\`\`\`powershell
Invoke-WebRequest -Uri "https://api.rosefires.com/auth/login" -Method OPTIONS -Headers @{
  Origin = "https://evelynrose20.github.io"
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "content-type"
}
\`\`\`

Replace the Origin if the published site uses a custom hostname. Expect HTTP 204 and \`Access-Control-Allow-Origin\` matching the specified origin. Ensure \`/auth/setup-domina\` and \`/ready\` are not available publicly (404). Never expose setup endpoints for remote account creation.

Finally open your published GitHub Pages site and check browser-based sign-in, account request, Domina account approval, roster and event screens. A GitHub Pages build on **main** must contain the public API URL. A pull request does not deploy automatically; merge an approved release only after API routing and browser tests succeed.

## 6. Keep the API online

Cloudflare's \`cloudflared\` service can be Healthy while Node is stopped. Your **Node API and MySQL must remain running** for members to use the website. Until a proper Windows service/task is configured and tested, do not close the API PowerShell window. Restarting your PC will interrupt the API unless you have independently configured automatic startup.

Do not delete your existing Supabase project until the published frontend is verified to use Windows/MySQL for every active feature and you have a restorable database backup.
