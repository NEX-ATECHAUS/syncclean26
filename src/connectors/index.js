// src/connectors/index.js
const HubSpotConnector = require('./hubspot');
const SalesforceConnector = require('./salesforce');
const {
  PipedriveConnector,
  MondayConnector,
  GoHighLevelConnector,
  AirtableConnector,
  ZohoConnector,
} = require('./platforms');
const { decrypt } = require('../services/crypto');
const db = require('../db');

const CONNECTORS = {
  hubspot:      HubSpotConnector,
  salesforce:   SalesforceConnector,
  pipedrive:    PipedriveConnector,
  monday:       MondayConnector,
  gohighlevel:  GoHighLevelConnector,
  airtable:     AirtableConnector,
  zoho:         ZohoConnector,
};

// Get a live connector instance for a user's connection
function getConnector(connectionId, userId) {
  const conn = db
    .prepare('SELECT * FROM connections WHERE id = ? AND user_id = ?')
    .get(connectionId, userId);

  if (!conn) throw new Error('Connection not found');

  const Cls = CONNECTORS[conn.platform];
  if (!Cls) throw new Error(`No connector for platform: ${conn.platform}`);

  const credentials = decrypt(conn.credentials);
  return new Cls(credentials);
}

// List connector metadata (no secrets)
function listConnectorMeta() {
  return {
    hubspot:     { name: 'HubSpot',      authType: 'oauth2',   type: 'CRM',                docsUrl: 'https://developers.hubspot.com/docs/api/overview' },
    salesforce:  { name: 'Salesforce',   authType: 'oauth2',   type: 'CRM',                docsUrl: 'https://developer.salesforce.com/docs/apis' },
    pipedrive:   { name: 'Pipedrive',    authType: 'api_key',  type: 'CRM',                docsUrl: 'https://developers.pipedrive.com/docs/api/v1' },
    monday:      { name: 'Monday.com',   authType: 'api_key',  type: 'Work OS',            docsUrl: 'https://developer.monday.com/api-reference' },
    gohighlevel: { name: 'GoHighLevel',  authType: 'oauth2',   type: 'CRM',                docsUrl: 'https://highlevel.stoplight.io/docs/integrations' },
    airtable:    { name: 'Airtable',     authType: 'api_key',  type: 'Database',           docsUrl: 'https://airtable.com/developers/web/api/introduction' },
    zoho:        { name: 'Zoho CRM',     authType: 'oauth2',   type: 'CRM',                docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v6' },
  };
}

module.exports = { getConnector, listConnectorMeta, CONNECTORS, HubSpotConnector, SalesforceConnector };
