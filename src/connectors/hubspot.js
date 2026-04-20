// src/connectors/hubspot.js
const axios = require('axios');
const BaseConnector = require('./base');

const BASE = 'https://api.hubapi.com';

const MODULE_MAP = {
  contacts:  { object: 'contacts',  props: ['firstname','lastname','email','phone','company','lifecyclestage','hs_lead_status','createdate','lastmodifieddate'] },
  companies: { object: 'companies', props: ['name','domain','industry','numberofemployees','annualrevenue','city','country'] },
  deals:     { object: 'deals',     props: ['dealname','amount','closedate','dealstage','pipeline','hubspot_owner_id'] },
  tickets:   { object: 'tickets',   props: ['subject','hs_ticket_status','hs_ticket_priority','content','createdate'] },
};

class HubSpotConnector extends BaseConnector {
  constructor(credentials) {
    super(credentials);
    this.http = axios.create({
      baseURL: BASE,
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });
  }

  async testConnection() {
    const res = await this.http.get('/crm/v3/objects/contacts?limit=1');
    return { ok: true, status: res.status };
  }

  async getModules() {
    return Object.keys(MODULE_MAP).map(k => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      key: k,
      description: `HubSpot ${k}`,
    }));
  }

  async getRecords(module, { page = 1, pageSize = 100, after } = {}) {
    const mod = MODULE_MAP[module.toLowerCase()];
    if (!mod) throw new Error(`Unknown module: ${module}`);

    const params = {
      limit: pageSize,
      properties: mod.props.join(','),
    };
    if (after) params.after = after;

    const res = await this.http.get(`/crm/v3/objects/${mod.object}`, { params });
    const records = res.data.results.map(r => ({ _id: r.id, _source: 'hubspot', ...r.properties }));
    const nextCursor = res.data.paging?.next?.after || null;

    return { records, nextPage: nextCursor };
  }

  async upsertRecord(module, record) {
    const mod = MODULE_MAP[module.toLowerCase()];
    if (!mod) throw new Error(`Unknown module: ${module}`);

    const { _id, _source, ...props } = record;

    if (_id && _source === 'hubspot') {
      // Update
      const res = await this.http.patch(`/crm/v3/objects/${mod.object}/${_id}`, { properties: props });
      return { id: _id, action: 'updated' };
    }

    // Search by email first to avoid dupes
    if (props.email) {
      try {
        const search = await this.http.post(`/crm/v3/objects/${mod.object}/search`, {
          filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: props.email }] }],
        });
        if (search.data.results.length > 0) {
          const id = search.data.results[0].id;
          await this.http.patch(`/crm/v3/objects/${mod.object}/${id}`, { properties: props });
          return { id, action: 'updated' };
        }
      } catch {}
    }

    // Create
    const res = await this.http.post(`/crm/v3/objects/${mod.object}`, { properties: props });
    return { id: res.data.id, action: 'created' };
  }

  async deleteRecord(module, id) {
    const mod = MODULE_MAP[module.toLowerCase()];
    await this.http.delete(`/crm/v3/objects/${mod.object}/${id}`);
    return { ok: true };
  }

  // OAuth helpers
  static getAuthUrl(clientId, redirectUri, scopes) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes || 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write crm.objects.deals.read crm.objects.deals.write',
      response_type: 'code',
    });
    return `https://app.hubspot.com/oauth/authorize?${params}`;
  }

  static async exchangeCode(code, clientId, clientSecret, redirectUri) {
    const res = await axios.post('https://api.hubapi.com/oauth/v1/token', new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    return {
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expires_in: res.data.expires_in,
    };
  }

  static async refreshToken(refreshToken, clientId, clientSecret) {
    const res = await axios.post('https://api.hubapi.com/oauth/v1/token', new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    return { access_token: res.data.access_token, expires_in: res.data.expires_in };
  }
}

module.exports = HubSpotConnector;
