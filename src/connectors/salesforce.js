// src/connectors/salesforce.js
const axios = require('axios');
const BaseConnector = require('./base');

const API_VERSION = 'v59.0';

const MODULE_FIELDS = {
  Contact:     ['Id','FirstName','LastName','Email','Phone','AccountId','Title','LeadSource','CreatedDate','LastModifiedDate'],
  Lead:        ['Id','FirstName','LastName','Email','Phone','Company','Status','LeadSource','CreatedDate'],
  Account:     ['Id','Name','Website','Industry','NumberOfEmployees','AnnualRevenue','BillingCity','BillingCountry'],
  Opportunity: ['Id','Name','Amount','CloseDate','StageName','Probability','AccountId','OwnerId'],
};

class SalesforceConnector extends BaseConnector {
  constructor(credentials) {
    super(credentials);
    this.instanceUrl = credentials.instance_url;
    this.http = axios.create({
      baseURL: `${credentials.instance_url}/services/data/${API_VERSION}`,
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });
  }

  async testConnection() {
    const res = await this.http.get('/limits');
    return { ok: true, org: res.data };
  }

  async getModules() {
    return Object.keys(MODULE_FIELDS).map(k => ({
      name: k,
      key: k,
      description: `Salesforce ${k}s`,
    }));
  }

  async getRecords(module, { page = 1, pageSize = 200, nextUrl } = {}) {
    const fields = MODULE_FIELDS[module];
    if (!fields) throw new Error(`Unknown module: ${module}`);

    let url, res;

    if (nextUrl) {
      // Salesforce returns absolute nextRecordsUrl
      res = await this.http.get(nextUrl.replace(`/services/data/${API_VERSION}`, ''));
    } else {
      const soql = `SELECT ${fields.join(',')} FROM ${module} ORDER BY LastModifiedDate DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      res = await this.http.get('/query', { params: { q: soql } });
    }

    const records = res.data.records.map(r => {
      const { attributes, ...rest } = r;
      return { _id: r.Id, _source: 'salesforce', ...rest };
    });

    return {
      records,
      nextPage: res.data.nextRecordsUrl || null,
      totalSize: res.data.totalSize,
    };
  }

  async upsertRecord(module, record) {
    const { _id, _source, Id, ...fields } = record;

    if (_id && _source === 'salesforce') {
      await this.http.patch(`/sobjects/${module}/${_id}`, fields);
      return { id: _id, action: 'updated' };
    }

    // Upsert by Email for Contact/Lead
    if (fields.Email && (module === 'Contact' || module === 'Lead')) {
      try {
        const res = await this.http.patch(
          `/sobjects/${module}/Email/${encodeURIComponent(fields.Email)}`,
          fields
        );
        return { id: res.data.id, action: res.data.created ? 'created' : 'updated' };
      } catch {}
    }

    const res = await this.http.post(`/sobjects/${module}`, fields);
    return { id: res.data.id, action: 'created' };
  }

  async deleteRecord(module, id) {
    await this.http.delete(`/sobjects/${module}/${id}`);
    return { ok: true };
  }

  // Bulk duplicate detection using SOQL
  async findDuplicates(module, field = 'Email') {
    const soql = `SELECT ${field}, COUNT(Id) cnt FROM ${module} WHERE ${field} != null GROUP BY ${field} HAVING COUNT(Id) > 1`;
    const res = await this.http.get('/query', { params: { q: soql } });
    return res.data.records;
  }

  // OAuth helpers
  static getAuthUrl(clientId, redirectUri, isSandbox = false) {
    const base = isSandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'api refresh_token offline_access',
    });
    return `${base}/services/oauth2/authorize?${params}`;
  }

  static async exchangeCode(code, clientId, clientSecret, redirectUri, isSandbox = false) {
    const base = isSandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
    const res = await axios.post(`${base}/services/oauth2/token`, new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    return {
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      instance_url: res.data.instance_url,
    };
  }

  static async refreshToken(refreshToken, clientId, clientSecret) {
    const res = await axios.post('https://login.salesforce.com/services/oauth2/token', new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    return { access_token: res.data.access_token, instance_url: res.data.instance_url };
  }
}

module.exports = SalesforceConnector;
