---
name: Hetzner Dokploy or Coolify deploy
overview: Two self-hosted PaaS options on Hetzner—Dokploy first, Coolify second—with step-by-step database, application (GitHub + Docker), and Cloudflare Tunnel notes for each. Subdomain target invest.allanweber.dev; TanStack Start + Postgres + Better Auth.
todos:
  - id: dockerfile
    content: Add production Dockerfile (needed for both Dokploy and Coolify application deploys)
    status: pending
  - id: dokploy-path
    content: "If using Dokploy: install, Postgres resource + S3 backups, Git app + domain/tunnel per Option 1"
    status: pending
  - id: coolify-path
    content: "If using Coolify: install, Postgres + backups, Git app + Cloudflared + proxy per Option 2"
    status: pending
  - id: prod-env-auth
    content: BETTER_AUTH_* and OAuth redirects for https://invest.allanweber.dev; DB migrations after first deploy
    status: pending
isProject: false
---

# Hetzner: Dokploy (option 1) or Coolify (option 2)

This guide assumes **one VPS** on **Hetzner**, domain **Cloudflare** (`allanweber.dev`), app URL **`invest.allanweber.dev`**, and this repo: **TanStack Start / Nitro + PostgreSQL + Better Auth** — you need a **`Dockerfile`** in git ([`package.json`](../package.json); dev-only Postgres: [`docker-compose.yml`](../docker-compose.yml)).

Pick **one** platform. Both manage **Docker**, **reverse proxy**, and **deploy-from-Git**; both can use a **Cloudflare Tunnel** so you do not rely on public `A` records to your server IP.

**Doc links (bookmark these):**

- [Dokploy](https://dokploy.com/) — [Installation](https://docs.dokploy.com/docs/core/installation), [Databases](https://docs.dokploy.com/docs/core/databases), [Database backups](https://docs.dokploy.com/docs/core/databases/backups), [Applications](https://docs.dokploy.com/docs/core/applications), [Cloudflare DNS/SSL](https://docs.dokploy.com/docs/core/domains/cloudflare), [Cloudflare Tunnels](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels), [Cloudflared template](https://docs.dokploy.com/docs/templates/cloudflared)
- [Coolify](https://coolify.io/) — [Installation](https://coolify.io/docs/get-started/installation), [Cloudflare Tunnels overview](https://coolify.io/docs/integrations/cloudflare/tunnels/overview), [All resources tunnel](https://coolify.io/docs/integrations/cloudflare/tunnels/all-resource), [Full HTTPS/TLS](https://coolify.io/docs/integrations/cloudflare/tunnels/full-tls)

---

## Shared: Hetzner server

1. Create a **new** VPS (both tools expect a fresh box you can dedicate to the panel).
2. **Ubuntu 24.04 LTS** is a safe choice.
3. **Specs:** at least **2 vCPU, 2 GB RAM, ~30 GB disk**; use **4 GB RAM** if you will run several apps + builds.
4. Add your **SSH public key** in Hetzner; note the server **IPv4**.

You will install **either** Dokploy **or** Coolify on this machine (not both on the same first-time setup unless you know what you are doing).

---

## Option 1 — Dokploy

Dokploy uses **Docker Swarm** and **Traefik** on ports **80** and **443**; the panel defaults to **port 3000** until you put it on a domain.

### 1.1 Install Dokploy

1. Open ports: **22** (SSH), **80**, **443**, **3000** (panel until you secure it). Hetzner **Cloud Firewall** or `ufw` — see your provider.
2. SSH as root (or a sudo user per Dokploy docs): run the official installer from [Installation](https://docs.dokploy.com/docs/core/installation):

   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```

3. Open **`http://YOUR_SERVER_IP:3000`** and complete **admin registration** immediately.
4. Later: put the **Dokploy panel** on a hostname with HTTPS and consider **disabling** raw `IP:3000` — [Domains](https://docs.dokploy.com/docs/core/domains), [Secure your installation](https://docs.dokploy.com/docs/core/installation#secure-your-installation).

### 1.2 PostgreSQL in Dokploy

1. In the UI, create a **Project** (if needed), then add a **Database** → **Postgres**.
2. **Deploy** the database and wait until it is healthy.
3. Copy the **credentials / connection details** Dokploy exposes (host is usually a **Docker/Swarm service name** reachable from app containers on the same stack — use the exact URL Dokploy documents for “connect from an application”).
4. Set your app env **`DATABASE_URL`** to that value (same shape as [`.env.example`](../.env.example): `postgresql://user:password@host:5432/dbname`).

**Backups**

1. Add an **S3-compatible destination** under **Settings → Destinations** (bucket + keys), per [Backups](https://docs.dokploy.com/docs/core/databases/backups).
2. Open your database → **Backups** tab: pick destination, **schedule** (cron), prefix, enable, then **Test**.
3. Read [Restore](https://docs.dokploy.com/docs/core/databases/restore) once so you know where restores live.

### 1.3 Application in Dokploy (GitHub + this repo)

1. **Applications** → new application → source **GitHub** (connect OAuth / deploy keys per Dokploy’s [SSH keys](https://docs.dokploy.com/docs/core/ssh-keys) if private).
2. Select this repository and branch (e.g. `main`).
3. **Build:** use **Dockerfile** (recommended for Nitro/TanStack): ensure the Dockerfile exposes the **container port** your app listens on (e.g. `3000`) and binds **`0.0.0.0`**.
4. **Environment:** add at least:
   - `DATABASE_URL` (from step 1.2)
   - `BETTER_AUTH_URL=https://invest.allanweber.dev` (after HTTPS works end-to-end)
   - `BETTER_AUTH_SECRET` (strong random)
   - `BETTER_AUTH_TRUSTED_ORIGINS` including `https://invest.allanweber.dev`
5. **Deploy**; fix build logs until green.
6. **Migrations:** run `pnpm db:migrate` once against production (Dokploy **Advanced → Run Command** or from your laptop with production URL — pick one documented workflow).

**Domains (without tunnel — see 1.4 for tunnel)**

- **Domains** tab → **Create domain**: Host `invest.allanweber.dev`, path `/`, **Container port** = your app port.
- In Cloudflare DNS: **A** record `invest` → server IP; use **Full (strict)** or **Flexible** per [Cloudflare domains](https://docs.dokploy.com/docs/core/domains/cloudflare) (Let’s Encrypt on origin vs Cloudflare-origin cert).
- Enable **HTTPS** + **Let’s Encrypt** when using direct DNS to the VPS (not when using tunnel-only routing — see below).

**Webhooks:** enable **Deployments → Webhook** so **git push** triggers rebuild (documented under [Applications](https://docs.dokploy.com/docs/core/applications)).

### 1.4 Cloudflare Tunnel with Dokploy

Follow **[Cloudflare Tunnels](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels)** (official). Short version:

1. **Cloudflare** → Zero Trust → **Networks** → **Connectors** → **Create tunnel** → **Cloudflared** → copy **`TUNNEL_TOKEN`**.
2. **SSL/TLS** in Cloudflare: use **Full** or **Full (strict)** — the doc says **avoid Flexible** (redirect loops with Traefik).
3. In **Dokploy**, create an **Application** with Docker image **`cloudflare/cloudflared`**; env **`TUNNEL_TOKEN`**; **Advanced → Arguments**: `tunnel` then `run` (see guide).
4. **Published routes / public hostname** in Cloudflare:
   - **Recommended:** route to **Traefik** so **all** Dokploy apps share one tunnel: **HTTP** service URL **`dokploy-traefik:80`** (exact hostname from guide — this reaches Traefik inside the swarm).
   - **Wildcard subdomains:** DNS **CNAME** `*` → `YOUR_TUNNEL_ID.cfargotunnel.com` (proxied), and one tunnel hostname to **`dokploy-traefik:80`** so `invest.allanweber.dev` and future subdomains work without new tunnel entries.
5. For **your app** in Dokploy → **Domains**: add **`invest.allanweber.dev`** with the **correct container port**; with tunnel + Traefik, the doc recommends **HTTPS off** and **no Let’s Encrypt** on that domain in Dokploy so Cloudflare terminates TLS at the edge (see guide — conflicts otherwise).
6. **Better Auth / OAuth:** if cookies or redirects break, you may need **Full (strict)** plus a **trusted origin certificate** on Traefik — same class of issue as Coolify’s [Full TLS](https://coolify.io/docs/integrations/cloudflare/tunnels/full-tls); plan extra time to tune SSL mode and app `BETTER_AUTH_URL`.

**Alternative (no tunnel):** use **A record** to the VPS and Dokploy **HTTPS + Let’s Encrypt** as in [Cloudflare + Dokploy](https://docs.dokploy.com/docs/core/domains/cloudflare); server IP is visible.

---

## Option 2 — Coolify

Coolify uses its own **proxy** (not Traefik like Dokploy); Cloudflare Tunnel is a **first-class** integration.

### 2.1 Install Coolify

1. Firewall: **SSH**, **80**, **443**, and **8000** for first UI access (then lock down). See [Firewall](https://coolify.io/docs/knowledge-base/server/firewall).
2. Install (official [Installation](https://coolify.io/docs/get-started/installation)):

   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```

3. Open the printed URL (often **`http://IP:8000`**) and **register admin** immediately.

### 2.2 PostgreSQL in Coolify

1. **Project** → **+ New** → **Database** (or **PostgreSQL**).
2. Deploy; copy **`DATABASE_URL`** / credentials Coolify shows.
3. **Backups:** enable in the DB resource to **S3-compatible** storage ([Coolify docs](https://coolify.io/docs)).

### 2.3 Application in Coolify (GitHub + this repo)

1. Connect **GitHub** as a source.
2. **New Application** → this repo; build with **Dockerfile**.
3. **Environment variables:** same set as in 1.3 (`DATABASE_URL`, `BETTER_AUTH_*`).
4. **Deploy**; run **migrations** once when ready.

### 2.4 Cloudflare Tunnel with Coolify

Use Coolify’s order (do **not** skip **Start Proxy**):

1. Read [Tunnels overview](https://coolify.io/docs/integrations/cloudflare/tunnels/overview) then [All resources](https://coolify.io/docs/integrations/cloudflare/tunnels/all-resource).
2. **Cloudflare:** create tunnel → **HTTP** → **`http://localhost:80`** for the public hostname (or wildcard).
3. **Coolify:** deploy **Cloudflared** resource with **tunnel token**.
4. **Servers** → **Proxy** → **Start Proxy** (routes tunnel → apps).
5. **Application** FQDN: **`invest.allanweber.dev`**; follow Coolify’s **HTTP vs HTTPS** advice to avoid `TOO_MANY_REDIRECTS`; for **Better Auth**, plan **[Full HTTPS/TLS](https://coolify.io/docs/integrations/cloudflare/tunnels/full-tls)** after basics work.

**No tunnel:** point **`invest`** **A** record at the VPS and use Let’s Encrypt via Coolify; origin IP visible.

---

## Shared: Before you call it production

- [ ] **`Dockerfile`** builds and listens on **`0.0.0.0`**.
- [ ] **Postgres** running; **`DATABASE_URL`** correct; **migrations** applied.
- [ ] **S3 (or compatible) backups** configured and **test** restore understood.
- [ ] **Tunnel** or **DNS** documented for your choice; **no** redirect loops on login.
- [ ] **`BETTER_AUTH_URL` / `TRUSTED_ORIGINS` / OAuth** console match **`https://invest.allanweber.dev`**.

---

## Quick comparison (why two options)

- **Dokploy:** Traefik-based; tunnel points at **`dokploy-traefik:80`**; [single tunnel guide](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels) matches multi-app wildcard flow.
- **Coolify:** dedicated **Proxy** + **Cloudflared** template path; **`localhost:80`** to proxy in Cloudflare route; **Full TLS** doc for strict HTTPS to origin.

Both replace hand-written server **bash + systemd** deploys for multiple future apps.

---

## The simple story if you feel lost

**Dokploy:** Hetzner → **install Dokploy** → **Postgres + backups** → **App from GitHub** → **Domains** → **Cloudflared app + tunnel → Traefik:80** → tune SSL for auth.

**Coolify:** Hetzner → **install Coolify** → **Postgres + backups** → **App from GitHub** → **Tunnel + Cloudflared + Start Proxy** → **Full TLS** if auth needs it.
