// src/connectors/pipedrive.js
const axios = require('axios');
const BaseConnector = require('./base');

class PipedriveConnector extends BaseConnector {
  constructor(credentials) {
    super(credentials);
    this.http = axios.create({
      baseURL: `https://${credentials.domain || 'api'}.pipedrive.com/v1`,
      params: { api_token: credentials.api_key },
    });
  }

  async testConnection() {
    const res = await this.http.get('/users/me');
    return { ok: true, user: res.data.data?.name };
  }

  async getModules() {
    return [
      { name: 'Persons', key: 'persons', description: 'Contacts / people' },
      { name: 'Organizations', key: 'organizations', description: 'Companies' },
      { name: 'Deals', key: 'deals', description: 'Sales pipeline deals' },
      { name: 'Leads', key: 'leads', description: 'Inbound leads' },
      { name: 'Activities', key: 'activities', description: 'Tasks and calls' },
    ];
  }

  async getRecords(module, { page = 1, pageSize = 100 } = {}) {
    const res = await this.http.get(`/${module}`, {
      params: { start: (page - 1) * pageSize, limit: pageSize },
    });
    const records = (res.data.data || []).map(r => ({ _id: r.id, _source: 'pipedrive', ...r }));
    const hasMore = res.data.additional_data?.pagination?.more_items_in_collection;
    return { records, nextPage: hasMore ? page + 1 : null };
  }

  async upsertRecord(module, record) {
    const { _id, _source, ...data } = record;
    if (_id && _source === 'pipedrive') {
      await this.http.put(`/${module}/${_id}`, data);
      return { id: _id, action: 'updated' };
    }
    const res = await this.http.post(`/${module}`, data);
    return { id: res.data.data.id, action: 'created' };
  }

  async deleteRecord(module, id) {
    await this.http.delete(`/${module}/${id}`);
    return { ok: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// src/connectors/monday.js
class MondayConnector extends BaseConnector {
  constructor(credentials) {
    super(credentials);
    this.apiKey = credentials.api_key;
    this.boardId = credentials.board_id;
  }

  async graphql(query, variables = {}) {
    const axios = require('axios');
    const res = await axios.post('https://api.monday.com/v2',
      { query, variables },
      { headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' } }
    );
    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data;
  }

  async testConnection() {
    const data = await this.graphql(`{ me { name email } }`);
    return { ok: true, user: data.me?.name };
  }

  async getModules() {
    const data = await this.graphql(`{ boards(limit: 20) { id name description } }`);
    return (data.boards || []).map(b => ({
      name: b.name,
      key: b.id,
      description: b.description || 'Monday.com board',
    }));
  }

  async getRecords(boardId, { page = 1, pageSize = 100 } = {}) {
    const q = `query($boardId: [ID!]!, $limit: Int!, $page: Int!) {
      boards(ids: $boardId) {
        items_page(limit: $limit, page: $page) {
          cursor
          items { id name column_values { id text value } }
        }
      }
    }`;
    const data = await this.graphql(q, { boardId: [boardId], limit: pageSize, page });
    const board = data.boards?.[0];
    const items = board?.items_page?.items || [];
    const records = items.map(item => {
      const cols = {};
      item.column_values.forEach(c => { cols[c.id] = c.text; });
      return { _id: item.id, _source: 'monday', name: item.name, ...cols };
    });
    return { records, nextPage: board?.items_page?.cursor ? page + 1 : null };
  }

  async upsertRecord(boardId, record) {
    const { _id, _source, name, ...cols } = record;
    const colValues = JSON.stringify(cols);
    if (_id && _source === 'monday') {
      await this.graphql(
        `mutation($id: ID!, $cols: JSON!) { change_multiple_column_values(item_id: $id, board_id: ${boardId}, column_values: $cols) { id } }`,
        { id: _id, cols: colValues }
      );
      return { id: _id, action: 'updated' };
    }
    const res = await this.graphql(
      `mutation($boardId: ID!, $name: String!, $cols: JSON!) { create_item(board_id: $boardId, item_name: $name, column_values: $cols) { id } }`,
      { boardId, name: name || 'Untitled', cols: colValues }
    );
    return { id: res.create_item.id, action: 'created' };
  }

  async deleteRecord(boardId, id) {
    await this.graphql(`mutation { delete_item(item_id: ${id}) { id } }`);
    return { ok: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// src/connectors/gohighlevel.js
class GoHighLevelConnector extends BaseConnector {
  constructor(credentials) {
    super(credentials);
    this.axios = require('axios').create({
      baseURL: 'https://services.leadconnectorhq.com',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        Version: '2021-07-28',
      },
    });
    this.locationId = credentials.location_id;
  }

  async testConnection() {
    const res = await this.axios.get('/locations/' + this.locationId);
    return { ok: true, location: res.data.location?.name };
  }

  async getModules() {
    return [
      { name: 'Contacts', key: 'contacts', description: 'CRM contacts' },
      { name: 'Opportunities', key: 'opportunities', description: 'Pipeline opportunities' },
      { name: 'Calendars', key: 'calendars', description: 'Appointments' },
      { name: 'Campaigns', key: 'campaigns', description: 'Marketing campaigns' },
      { name: 'Forms', key: 'forms', description: 'Form submissions' },
      { name: 'Conversations', key: 'conversations', description: 'SMS/email threads' },
    ];
  }

  async getRecords(module, { page = 1, pageSize = 100 } = {}) {
    const endpoints = {
      contacts: `/contacts/?locationId=${this.locationId}&limit=${pageSize}&skip=${(page - 1) * pageSize}`,
      opportunities: `/opportunities/search?location_id=${this.locationId}&limit=${pageSize}&skip=${(page - 1) * pageSize}`,
    };
    const url = endpoints[module] || `/contacts/?locationId=${this.locationId}&limit=${pageSize}`;
    const res = await this.axios.get(url);
    const raw = res.data.contacts || res.data.opportunities || res.data.data || [];
    const records = raw.map(r => ({ _id: r.id, _source: 'gohighlevel', ...r }));
    const hasMore = raw.length === pageSize;
    return { records, nextPage: hasMore ? page + 1 : null };
  }

  async upsertRecord(module, record) {
    const { _id, _source, ...data } = record;
    data.locationId = this.locationId;
    if (_id && _source === 'gohighlevel') {
      await this.axios.put(`/contacts/${_id}`, data);
      return { id: _id, action: 'updated' };
    }
    // Search by email
    if (data.email) {
      try {
        const s = await this.axios.get(`/contacts/?locationId=${this.locationId}&email=${data.email}`);
        const existing = s.data.contacts?.[0];
        if (existing) {
          await this.axios.put(`/contacts/${existing.id}`, data);
          return { id: existing.id, action: 'updated' };
        }
      } catch {}
    }
    const res = await this.axios.post('/contacts/', data);
    return { id: res.data.contact.id, action: 'created' };
  }

  async deleteRecord(module, id) {
    await this.axios.delete(`/contacts/${id}`);
    return { ok: true };
  }

  static getAuthUrl(clientId, redirectUri) {
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'contacts.readonly contacts.write opportunities.readonly opportunities.write' });
    return `https://marketplace.gohighlevel.com/oauth/chooselocation?${params}`;
  }

  static async exchangeCode(code, clientId, clientSecret, redirectUri) {
    const axios = require('axios');
    const res = await axios.post('https://services.leadconnectorhq.com/oauth/token', new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return { access_token: res.data.access_token, refresh_token: res.data.refresh_token, location_id: res.data.locationId };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// src/connectors/airtable.js
class AirtableConnector extends BaseConnector {
  constructor(credentials) {
    super(credentials);
    this.axios = require('axios').create({
      baseURL: 'https://api.airtable.com/v0',
      headers: { Authorization: `Bearer ${credentials.api_key}` },
    });
    this.baseId = credentials.base_id;
  }

  async testConnection() {
    const res = await this.axios.get(`/meta/bases/${this.baseId}/tables`);
    return { ok: true, tables: res.data.tables?.length };
  }

  async getModules() {
    const res = await this.axios.get(`/meta/bases/${this.baseId}/tables`);
    return (res.data.tables || []).map(t => ({
      name: t.name,
      key: t.id,
      description: `Airtable table: ${t.name}`,
    }));
  }

  async getRecords(tableId, { pageSize = 100, offset } = {}) {
    const params = { pageSize };
    if (offset) params.offset = offset;
    const res = await this.axios.get(`/${this.baseId}/${tableId}`, { params });
    const records = res.data.records.map(r => ({ _id: r.id, _source: 'airtable', ...r.fields }));
    return { records, nextPage: res.data.offset || null };
  }

  async upsertRecord(tableId, record) {
    const { _id, _source, ...fields } = record;
    if (_id && _source === 'airtable') {
      await this.axios.patch(`/${this.baseId}/${tableId}/${_id}`, { fields });
      return { id: _id, action: 'updated' };
    }
    const res = await this.axios.post(`/${this.baseId}/${tableId}`, { fields });
    return { id: res.data.id, action: 'created' };
  }

  async deleteRecord(tableId, id) {
    await this.axios.delete(`/${this.baseId}/${tableId}/${id}`);
    return { ok: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// src/connectors/zoho.js
class ZohoConnector extends BaseConnector {
  constructor(credentials) {
    super(credentials);
    this.region = credentials.region || 'com'; // com | eu | in | au
    this.axios = require('axios').create({
      baseURL: `https://www.zohoapis.${this.region}/crm/v6`,
      headers: { Authorization: `Zoho-oauthtoken ${credentials.access_token}` },
    });
  }

  async testConnection() {
    const res = await this.axios.get('/users?type=CurrentUser');
    return { ok: true, user: res.data.users?.[0]?.full_name };
  }

  async getModules() {
    const res = await this.axios.get('/settings/modules');
    return (res.data.modules || [])
      .filter(m => m.api_supported)
      .map(m => ({ name: m.module_name, key: m.api_name, description: m.singular_label }));
  }

  async getRecords(module, { page = 1, pageSize = 200 } = {}) {
    const res = await this.axios.get(`/${module}`, { params: { page, per_page: pageSize } });
    const records = (res.data.data || []).map(r => ({ _id: r.id, _source: 'zoho', ...r }));
    const info = res.data.info;
    const hasMore = info?.more_records;
    return { records, nextPage: hasMore ? page + 1 : null };
  }

  async upsertRecord(module, record) {
    const { _id, _source, ...data } = record;
    if (_id && _source === 'zoho') {
      await this.axios.put(`/${module}`, { data: [{ id: _id, ...data }] });
      return { id: _id, action: 'updated' };
    }
    const res = await this.axios.post(`/${module}/upsert`, { data: [data], duplicate_check_fields: ['Email'] });
    const result = res.data.data?.[0];
    return { id: result?.details?.id, action: result?.code === 'SUCCESS' ? 'created' : 'updated' };
  }

  async deleteRecord(module, id) {
    await this.axios.delete(`/${module}?ids=${id}`);
    return { ok: true };
  }

  static getAuthUrl(clientId, redirectUri, region = 'com') {
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'ZohoCRM.modules.ALL,ZohoCRM.settings.ALL', access_type: 'offline' });
    return `https://accounts.zoho.${region}/oauth/v2/auth?${params}`;
  }

  static async exchangeCode(code, clientId, clientSecret, redirectUri, region = 'com') {
    const axios = require('axios');
    const res = await axios.post(`https://accounts.zoho.${region}/oauth/v2/token`, new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return { access_token: res.data.access_token, refresh_token: res.data.refresh_token, region };
  }

  static async refreshToken(refreshToken, clientId, clientSecret, region = 'com') {
    const axios = require('axios');
    const res = await axios.post(`https://accounts.zoho.${region}/oauth/v2/token`, new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return { access_token: res.data.access_token };
  }
}

module.exports = { PipedriveConnector, MondayConnector, GoHighLevelConnector, AirtableConnector, ZohoConnector };
