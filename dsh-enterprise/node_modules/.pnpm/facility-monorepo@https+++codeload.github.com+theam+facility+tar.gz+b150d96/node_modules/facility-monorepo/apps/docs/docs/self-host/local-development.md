---
title: Local development
---

# Running Facility on your machine

`pnpm dev` gives you a working instance in a few minutes. Everything on this
page is about the part that is not obvious: **GitHub cannot reach your laptop**,
so some of the product only comes alive once your instance has a public URL.

Read the [quickstart](quickstart) first for the initial run and the
[GitHub App guide](github-app) for the App itself. This page covers what to do
after that, on a development machine.

## What works without a public URL

| Capability | Without a tunnel |
|---|---|
| Sign in, browse projects, read the knowledge base | Works — the OAuth callback can be `http://localhost:3400/api/auth/callback` |
| Dispatching agents from the UI | Works — the control plane triggers runs directly |
| Mirroring issues | Only when you press **sync from GitHub** |
| Reacting to issues, comments, pull requests, workflow runs | **Does not happen** — those arrive as webhooks |
| Slash commands in issue comments (`/architect`, `/builder`) | **Do not arrive** |

If you only want to look around, skip the tunnel. If you want the loop to react
to what happens on GitHub, keep reading.

## One tunnel, pointed at the web app

The web application proxies `/api/*` to the control plane, so a **single**
tunnel to port `3400` covers the interface, sign-in and webhooks. Do not tunnel
port `4400` as well.

| What GitHub or your browser needs | URL |
|---|---|
| The application | `https://<your-host>/` |
| OAuth callback | `https://<your-host>/api/auth/callback` |
| Webhook payload URL | `https://<your-host>/api/webhooks/github` |

The webhook path goes through `/api` because that is the proxy prefix — posting
to `https://<your-host>/webhooks/github` returns 404, which looks exactly like a
broken tunnel and is not.

## Starting a tunnel with cloudflared

Install it first: `brew install cloudflared`, or see
[Cloudflare's downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

### Throwaway tunnel — no account, new hostname each time

```bash
cloudflared tunnel --url http://localhost:3400
```

It prints a `https://<random>.trycloudflare.com` address. Good enough for an
afternoon; the hostname changes on every restart, and each change means editing
the App's callback and webhook URLs and your `.env` again.

### Named tunnel — stable hostname, needs a domain on Cloudflare

Worth the ten minutes if you will use it more than once:

```bash
cloudflared tunnel login
cloudflared tunnel create facility-dev
cloudflared tunnel route dns facility-dev dev.example.com
```

Then write `~/.cloudflared/config.yml`:

```yaml
tunnel: <the tunnel id printed by create>
credentials-file: /Users/you/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: dev.example.com
    service: http://localhost:3400
  - service: http_status:404
```

And run it — this stays in the foreground, so give it its own terminal:

```bash
cloudflared tunnel run
```

## Point Facility and the App at the tunnel

In `.env`:

```dotenv
# The origin your browser uses. Sign-in redirects and the session cookie's
# Secure flag are derived from it.
WEB_URL=https://dev.example.com
AUTH_CALLBACK_URL=https://dev.example.com/api/auth/callback

# Next blocks cross-origin development requests — without this the pages load
# but client-side navigation, live updates and hot reload fail.
FACILITY_DEV_ORIGINS=dev.example.com
```

Leave `PUBLIC_URL` as `http://localhost:4400`: it is the control plane's own
origin, not the browser-facing one.

Preview applications never share that browser origin. The default
`FACILITY_PREVIEW_URL=http://preview.localhost:4400` resolves to loopback in
modern browsers without editing `/etc/hosts`. If a teammate must open previews
through a tunnel, give the preview origin its own HTTPS hostname on a
separately registered site; do not reuse `dev.example.com` or a sibling of it.

In the GitHub App settings:

- **Callback URL** → `https://dev.example.com/api/auth/callback` (byte for byte;
  a mismatch shows GitHub's `redirect_uri` error page).
- **Webhook URL** → `https://dev.example.com/api/webhooks/github`, active, with
  a secret that matches `GITHUB_APP_WEBHOOK_SECRET`.

Restart the stack after changing `.env` — configuration is read at boot.

Verify the whole chain before trusting it:

```bash
curl -i https://dev.example.com/login                       # 200
curl -i -X POST https://dev.example.com/api/webhooks/github # 401: the route is
                                                            # there and refuses
                                                            # unsigned payloads
```

Then open the App's **Advanced → Recent deliveries** and redeliver an event: a
`2xx` means Facility received it.

## Day-to-day

- `pnpm dev` starts everything. Ctrl-C stops the foreground processes; Docker
  keeps running for next time.
- The tunnel is separate. Restarting the application does not restart it, and
  the reverse is also true.
- After pulling changes that touch `packages/ui` styles, restart the web app —
  the bundler keeps stale CSS across those edits more often than it should.

## When something looks broken

| Symptom | What it is |
|---|---|
| The tunnel returns 502 or 530 while `curl http://localhost:3400` is fine | `cloudflared` lost its connection — often after restarting the dev server while a page held an open event stream. Restart the tunnel. |
| Every page 404s, including `/login` | The dev server hit its open-file limit while scanning. Look at `apps/web/.next/dev/logs/next-development.log` for `EMFILE`; the errors do not reach the terminal. Raise the limit for the process (`ulimit -n 8192`) and start again. |
| Pages load but navigation, live updates or hot reload fail through the tunnel | `FACILITY_DEV_ORIGINS` is missing the tunnel hostname. |
| Manifest errors after switching branches | Stop the web app, delete `apps/web/.next`, start it again. |
| Issues never update by themselves | No webhook is reaching you. Check the App's recent deliveries, then that the payload URL includes `/api/`. |
| `501 auth_unconfigured` when signing in | `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` are missing — the configuration requires both or neither. |
| `403 not_invited` or `installation_access_required` | Your GitHub user is not provisioned on this instance, or the ids given to `facility instance bootstrap` do not match the real ones. |
