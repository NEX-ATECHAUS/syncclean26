# Clean'Sync — by Nex-a Tech Solutions — Production Deployment Guide

## Stack
- **Backend**: Node.js + Express, SQLite (swappable to Postgres)
- **Auth**: Magic link (passwordless email) via Nodemailer
- **AI**: Anthropic Claude — reads API docs, suggests field mappings, detects dupes
- **Connectors**: HubSpot, Salesforce, Pipedrive, Monday.com, GoHighLevel, Airtable, Zoho CRM + any custom REST API
- **Deploy**: Railway (recommended) or any VPS

---

## 1. Local development

```bash
git clone <your-repo>
cd cleansync
npm install
cp .env.example .env   # fill in all values (see below)
npm run dev            # nodemon watches for changes
```

Test the API is running:
```bash
curl http://localhost:3000/health
# {"ok":true,"ts":"..."}
```

---

## 2. Environment variables

Edit `.env` — every key is documented in `.env.example`.

### Required keys

| Key | Where to get it |
|-----|----------------|
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ENCRYPTION_KEY` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `SMTP_*` | Use Resend (free 3k/mo): https://resend.com |

### OAuth app setup (per platform)

**HubSpot**
1. Go to https://developers.hubspot.com → Create app
2. Add redirect URI: `https://yourdomain.com/api/connectors/hubspot/callback`
3. Required scopes: `crm.objects.contacts.read/write`, `crm.objects.companies.read/write`, `crm.objects.deals.read/write`
4. Copy Client ID + Secret → `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`

**Salesforce**
1. Setup → App Manager → New Connected App
2. Enable OAuth, add redirect URI: `https://yourdomain.com/api/connectors/salesforce/callback`
3. Scopes: `api`, `refresh_token`, `offline_access`
4. Copy Consumer Key/Secret → `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`

**GoHighLevel**
1. GHL Marketplace → Create App → OAuth
2. Redirect URI: `https://yourdomain.com/api/connectors/gohighlevel/callback`
3. Scopes: `contacts.readonly`, `contacts.write`, `opportunities.readonly`, `opportunities.write`

**Zoho CRM**
1. https://api-console.zoho.com → Add Client → Server-based
2. Redirect URI: `https://yourdomain.com/api/connectors/zoho/callback`
3. Scopes: `ZohoCRM.modules.ALL`, `ZohoCRM.settings.ALL`

**Pipedrive, Monday.com, Airtable** — API key only, no OAuth app needed.

---

## 3. Deploy to Railway

Railway gives you a Node.js server + persistent disk for SQLite in about 5 minutes.

```bash
npm install -g @railway/cli
railway login
railway init          # creates a new project
railway up            # deploys
```

Then in the Railway dashboard:
1. **Variables** → paste all your `.env` values
2. **Networking** → Generate domain (e.g. `cleansync-api.up.railway.app`)
3. Set `FRONTEND_URL` to your frontend domain
4. Update all OAuth redirect URIs to use the Railway domain

For the SQLite database file to persist across deploys:
1. Railway dashboard → your service → **Volumes**
2. Mount path: `/app/data`
3. Set `DATABASE_PATH=/app/data/syncclean.db`

---

## 4. Deploy to a VPS (DigitalOcean / Hetzner)

```bash
# On your server
apt update && apt install -y nodejs npm nginx
npm install -g pm2

git clone <your-repo> /var/www/cleansync
cd /var/www/cleansync
npm install
cp .env.example .env && nano .env   # fill in values

# Start with PM2 (auto-restarts on crash)
pm2 start src/index.js --name cleansync
pm2 save && pm2 startup

# Nginx reverse proxy
cat > /etc/nginx/sites-available/cleansync << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Required for SSE (streaming sync logs)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
EOF

ln -s /etc/nginx/sites-available/cleansync /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.yourdomain.com
```

---

## 5. Swap SQLite → Postgres (production scale)

The DB layer uses `better-sqlite3` by default. To move to Postgres:

1. `npm install pg` and `npm uninstall better-sqlite3`
2. Replace `src/db/index.js` with a `pg` pool:

```js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = pool;
```

3. Convert `.prepare().run()` calls to `pool.query('...', [params])` — or drop in
   [Knex.js](https://knexjs.org) as a query builder that works with both.

---

## 6. API reference

### Auth
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/auth/magic` | `{email}` | Send magic link |
| GET | `/api/auth/verify?token=` | — | Verify token → returns `{accessToken, refreshToken, user}` |
| POST | `/api/auth/refresh` | `{refreshToken}` | Refresh access token |
| GET | `/api/auth/me` | — | Get current user (requires `Authorization: Bearer <token>`) |

### Connectors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/connectors` | List user's connections |
| POST | `/api/connectors` | Add API-key connection `{platform, credentials, displayName}` |
| DELETE | `/api/connectors/:id` | Remove connection |
| GET | `/api/connectors/:id/test` | Test connection |
| GET | `/api/connectors/:id/modules` | List available modules |
| GET | `/api/connectors/:id/records/:module` | Fetch records (paginated) |
| GET | `/api/connectors/:platform/oauth/start` | Get OAuth redirect URL |
| GET | `/api/connectors/hubspot/callback` | OAuth callback (HubSpot) |
| GET | `/api/connectors/salesforce/callback` | OAuth callback (Salesforce) |
| GET | `/api/connectors/gohighlevel/callback` | OAuth callback (GoHighLevel) |
| GET | `/api/connectors/zoho/callback` | OAuth callback (Zoho) |

### AI
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/ai/analyse-docs` | `{url}` | Analyse API docs (batch) |
| POST | `/api/ai/analyse-docs/stream` | `{url}` | Analyse with SSE log stream |
| POST | `/api/ai/suggest-mappings` | `{sourceFields, destFields, ...}` | AI field mapping suggestions |
| POST | `/api/ai/detect-duplicates` | `{records[], rules}` | AI duplicate detection |

### Sync
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sync/jobs` | List sync jobs |
| POST | `/api/sync/jobs` | Create job `{sourceId, destinationId, fieldMap, dedupRules, ...}` |
| POST | `/api/sync/jobs/:id/run` | Run job (SSE stream) |
| GET | `/api/sync/jobs/:id/runs` | Run history |
| POST | `/api/sync/preview-dupes` | Preview duplicates before sync |

---

## 7. Frontend integration (React)

The backend is framework-agnostic. Wire the wizard UI from the previous artifact to this API:

```js
// Sign in
const res = await fetch('/api/auth/magic', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
});

// After magic link click — verify token from URL
const { accessToken, refreshToken, user } = await fetch(
  `/api/auth/verify?token=${token}`
).then(r => r.json());
localStorage.setItem('token', accessToken);

// Authenticated request
const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

// Stream AI doc analysis
const es = new EventSource('/api/ai/analyse-docs/stream');
// POST body via fetch first, then listen to SSE

// Stream sync progress
const syncStream = new EventSource(`/api/sync/jobs/${jobId}/run`);
syncStream.onmessage = ({ data }) => {
  const { type, text, level } = JSON.parse(data);
  if (type === 'log') appendLog(text, level);
  if (type === 'done') showSummary(data);
};
```

---

## 8. Adding more connectors

Create `src/connectors/yourplatform.js` extending `BaseConnector`:

```js
const BaseConnector = require('./base');

class YourPlatformConnector extends BaseConnector {
  async testConnection() { ... }
  async getModules()     { ... }
  async getRecords(module, options) { ... }
  async upsertRecord(module, record) { ... }
  async deleteRecord(module, id) { ... }
}

module.exports = YourPlatformConnector;
```

Then register it in `src/connectors/index.js`:
```js
const CONNECTORS = {
  ...existing,
  yourplatform: require('./yourplatform'),
};
```

And add metadata to `listConnectorMeta()`. That's it — all routes, sync engine, and AI services work automatically.
