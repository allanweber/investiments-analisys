---
name: Hetzner Coolify deploy
overview: Beginner-friendly steps for Hetzner + Coolify + PostgreSQL + GitHub, using Coolify’s built-in Cloudflare Tunnel integration (recommended “all resources” path) and optional Full TLS when Better Auth/OAuth needs end-to-end HTTPS on the origin.
todos:
  - id: dockerfile
    content: Add a production Dockerfile (Coolify builds/runs the app; Dockerfile recommended for this Nitro/TanStack stack)
    status: pending
  - id: hetzner-coolify
    content: Create Hetzner VPS (fresh Ubuntu), firewall/SSH per Coolify docs, run install script, secure Coolify registration
    status: pending
  - id: cf-tunnel-coolify
    content: "Cloudflare Tunnel (Zero Trust) + Coolify Cloudflared resource + Start Proxy; follow Coolify ‘All Resource’ tunnel guide — link in Part C"
    status: pending
  - id: full-tls-better-auth
    content: "If cookies/OAuth/JWT misbehave: complete Coolify Full TLS guide (origin cert, tunnel → HTTPS:443, Full strict, app URLs HTTPS)"
    status: pending
  - id: postgres-coolify
    content: "In Coolify: PostgreSQL for this app; enable backups to S3-compatible storage"
    status: pending
  - id: github-coolify
    content: "Connect GitHub, create Application, auto-deploy branch, env vars (DATABASE_URL from Coolify, BETTER_AUTH_*)"
    status: pending
  - id: prod-env-auth
    content: OAuth redirects + BETTER_AUTH_URL/TRUSTED_ORIGINS for https://invest.allanweber.dev; run migrations after first deploy
    status: pending
isProject: false
---

# Deploy on Hetzner with Coolify (simple guide)

## What you are building (in plain English)

1. You rent a small Linux computer in Hetzner (**a VPS**).
2. You install **Coolify** on it once. Coolify is a **web dashboard** that installs Docker for you and then deploys **many apps** from Git — good for your “this server will have other apps” goal.
3. You use **Cloudflare** for DNS. You will use a **Cloudflare Tunnel** the **Coolify-approved way**: Coolify runs a **Cloudflared** container and sends traffic to Coolify’s **proxy** on port **80**, so you do **not** add a new tunnel hostname for every future app in most setups. Cloudflare handles **HTTPS at the edge** first; your app may later need **Full TLS on Coolify** for login/OAuth (see Part C).
4. You add **PostgreSQL** in Coolify, turn on **backups** to S3-compatible storage, and connect **GitHub** so pushes can redeploy automatically.

Your app is **TanStack Start / Nitro + PostgreSQL + Better Auth**. You still need a proper **`Dockerfile`** in the repo so Coolify can build and run it reliably ([`package.json`](../package.json); local [`docker-compose.yml`](../docker-compose.yml) is only for dev Postgres today).

---

## Part A — Hetzner server (one time)

1. **Create an account** at [Hetzner Cloud](https://console.hetzner.cloud/) if needed.
2. **Add an SSH key** on your PC (so you can log in without a password):
   - Example: `ssh-keygen -t ed25519 -C "hetzner"`  
   - Upload the **public** key (`.pub` file) in Hetzner when creating the server.
3. **Create a new server** (important: **dedicated to Coolify** — Coolify’s docs recommend a **fresh** machine):
   - **Image:** Ubuntu **24.04** LTS.
   - **Size:** at least **2 vCPU, 2 GB RAM, ~30 GB disk** (Coolify minimum); if you expect several apps + builds on the same box, **4 GB RAM** is more comfortable.
   - **SSH key:** select yours.
   - Note the **public IPv4 address**.
4. **Log in:** `ssh root@YOUR_SERVER_IP`
5. **Firewall (simple rule of thumb):** allow inbound **SSH (22)**, **HTTP (80)**, **HTTPS (443)**. Coolify’s own UI often uses port **8000** until you put it on a domain — either allow **8000** from **your home IP only**, or follow Coolify’s docs to secure the dashboard quickly. Official firewall notes: [Coolify firewall guide](https://coolify.io/docs/knowledge-base/server/firewall).

---

## Part B — Install Coolify (one command)

On the server as **root** (what Coolify expects for the quick installer):

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

When it finishes, open the URL it prints (usually `http://YOUR_SERVER_IP:8000`).

- **Immediately** complete the **first admin registration** — anyone who hits that page before you could register as admin.
- After that, prefer following Coolify’s guidance to **use a proper hostname + HTTPS for the Coolify dashboard** (so you are not using raw IP:8000 forever).

Details and options: [Coolify installation](https://coolify.io/docs/get-started/installation).

---

## Part C — Cloudflare Tunnel + `invest.allanweber.dev` (Coolify’s way)

Coolify documents this clearly; follow their pages in order (don’t skip the “Start Proxy” step):

- **Overview (why / when):** [Cloudflare Tunnels](https://coolify.io/docs/integrations/cloudflare/tunnels/overview)
- **What you should use as a beginner:** [Access All Resource via Cloudflare Tunnels](https://coolify.io/docs/integrations/cloudflare/tunnels/all-resource)
- **If login or OAuth acts wrong:** [Full HTTPS/TLS](https://coolify.io/docs/integrations/cloudflare/tunnels/full-tls)

### C1 — Create the tunnel in Cloudflare (high level)

1. Log into Cloudflare → **Zero Trust** → **Networks** → **Tunnels** → **Add a tunnel** → type **Cloudflared**.
2. Name it (e.g. `hetzner-coolify`).
3. Copy the **token** (the long `eyJ…` string — store it in a password manager).

When Cloudflare asks you to add a **public hostname**, the **All Resource** guide uses one rule for **everything**:

- **Type:** **HTTP** (important).
- **URL:** **`http://localhost:80`** (important).

For the hostname, beginners often use a **wildcard** like `*.allanweber.dev` so **every** Coolify app on that server can use its own subdomain **without** coming back to Cloudflare for each new app. If you prefer only this app for now, you can use `invest.allanweber.dev` instead and add more hostnames later (same `localhost:80`).

### C2 — Encryption mode (first pass)

In Cloudflare **SSL/TLS** → **Overview**: set encryption to **Full** (as in Coolify’s tunnel guide). You may move to **Full (strict)** after you complete **Full TLS** if needed.

### C3 — Run the tunnel **inside Coolify** (not by hand)

1. In Coolify: **+ New resource** → search **Cloudflared** → deploy it.
2. Paste the **tunnel token** in that service’s **environment variables** and deploy.

### C4 — Start Coolify’s proxy

Coolify: **Servers** → your server → **Proxy** → **Start Proxy**.

This is what routes traffic from the tunnel (`localhost:80`) to **each** application. Without this, tunnel setup won’t make sense.

### C5 — DNS gotcha (if the site doesn’t load)

If Cloudflare **does not** create a DNS record because one already existed, Coolify explains fixing it with a **CNAME** to `YOUR_TUNNEL_ID.cfargotunnel.com` (proxied). See **Known issues** on the same **All Resource** page.

### C6 — Your app domain in Coolify (Better Auth / OAuth)

Coolify warns: for tunnel setups, start with the app URL as **HTTP** in the resource settings to avoid **`TOO_MANY_REDIRECTS`**, because **Cloudflare** terminates HTTPS first.

**But:** this app uses **Better Auth** (cookies, redirects, OAuth). Coolify explicitly says: if something needs real HTTPS to the app, follow **[Full HTTPS/TLS](https://coolify.io/docs/integrations/cloudflare/tunnels/full-tls)** after the tunnel works — origin certificate on the server, tunnel points to **HTTPS on 443**, Cloudflare **Full (strict)**, then use **`https://invest.allanweber.dev`** everywhere (`BETTER_AUTH_URL`, trusted origins, OAuth console).

**Practical order for you:** get the tunnel + proxy + app **loading** with the **All Resource** guide, then plan **Full TLS** before you call authentication “done.”

### Optional: no tunnel (simpler, but exposes server IP)

If you ever skip the tunnel: point **`invest` A record** to the Hetzner IP and let Coolify use **Let’s Encrypt** on the server. You lose the “hidden IP” benefit. With your choice, **stay on Coolify’s tunnel guides** above.

---

## Part D — PostgreSQL + backups inside Coolify

1. In the Coolify UI, **create a PostgreSQL database** (as a **resource** tied to a project).
2. Coolify will give you a **connection string** / credentials your app should use as `DATABASE_URL`.
3. Enable **automated backups** in Coolify to an **S3-compatible bucket** (Cloudflare R2, Backblaze B2, AWS S3, etc.). Coolify documents this as a built-in feature ([Coolify docs overview](https://coolify.io/docs) mentions S3 backups and one-click restore).
4. **Later apps:** add **another** database instance or another database on the same server depending on how you like to isolate data — Coolify supports multiple resources.

---

## Part E — Deploy *this* app from GitHub

1. In Coolify, connect **GitHub** (OAuth or token — follow Coolify’s “Source” / Git provider screens).
2. **New resource → Application** (or equivalent wizard), pick **this repository**.
3. **Build pack:** prefer **Dockerfile** — add one to the repo that:
   - Installs dependencies with `pnpm`
   - Runs `pnpm build`
   - Starts the Nitro production server on **`0.0.0.0`** and the port Coolify expects (often you expose one port in the Dockerfile; Coolify maps it).
4. Set the **public hostname** to `invest.allanweber.dev`. Match **HTTP vs HTTPS** to whatever stage you are at in Part C (HTTP-first for tunnel basics; **HTTPS URLs** after **Full TLS** if Coolify requires it for your auth flow).
5. **Environment variables** (at minimum, from your [`.env.example`](../.env.example)):
   - `DATABASE_URL` — paste the value Coolify shows for the Postgres you created.
   - `BETTER_AUTH_URL` — must match the **public URL users type in the browser** (`https://invest.allanweber.dev` once Full TLS / production HTTPS is correct).
   - `BETTER_AUTH_SECRET` — long random secret.
   - `BETTER_AUTH_TRUSTED_ORIGINS` — include the same public origin as above.
6. **Deploy.** After the first successful deploy, run **database migrations** once (Coolify often lets you run a one-off command in the container, or you run `pnpm db:migrate` locally against production `DATABASE_URL` if you prefer — pick one safe workflow).
7. In **Google (or other) OAuth** console, add **authorized redirect URIs** for the **production** URL.

**Automation:** Coolify’s **Git integration** handles “push to deploy” so you usually **do not** need a separate GitHub Actions deploy pipeline unless you want extra CI steps (tests, lint).

---

## Part F — Multiple apps on the same server

- This is **exactly** what Coolify is for: add **another Application**, another **FQDN** (e.g. `other.allanweber.dev`), another database if needed.
- Watch **RAM and disk**: builds are heavy; upgrade the VPS if the server feels slow.

---

## Quick checklist before you call it “live”

- [ ] VPS meets Coolify minimums; SSH/firewall match Coolify’s docs.
- [ ] Coolify installed; first admin account claimed; dashboard access tightened over time.
- [ ] Cloudflare **Tunnel** created; **Cloudflared** deployed in Coolify with token; **Proxy started**.
- [ ] DNS / tunnel hostname covers `invest.allanweber.dev` (direct record or wildcard).
- [ ] If using Better Auth/OAuth: **Full TLS** completed or verified; no redirect/cookie loops.
- [ ] App `Dockerfile` works; deploy succeeds from GitHub.
- [ ] Postgres in Coolify; `DATABASE_URL` set; migrations applied.
- [ ] Backups go to **remote** S3-compatible storage.
- [ ] `BETTER_AUTH_*` and OAuth provider redirect URIs match your real public URL.

---

## What you are not doing anymore

- No manual SSH deploy scripts from GitHub Actions (unless you add tests/CI yourself).
- No hand-written `docker compose` folder structure on the VPS for this app — Coolify owns that.
- No separate `systemd` unit for `cloudflared` — Coolify runs **Cloudflared** as a managed resource.

---

## The simple story (read this when you feel lost)

**Order:** Hetzner → **Coolify install** → **Tunnel in Cloudflare** → **Cloudflared + Proxy in Coolify** → **Postgres in Coolify** → **App from GitHub** → **Full TLS if auth needs it** → **OAuth URLs**.
