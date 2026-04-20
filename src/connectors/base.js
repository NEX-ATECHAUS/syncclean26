// src/connectors/base.js
// Every platform connector extends this class

class BaseConnector {
  constructor(credentials) {
    this.credentials = credentials;
  }

  // Must be implemented by each connector
  async testConnection() { throw new Error('Not implemented'); }
  async getModules() { throw new Error('Not implemented'); }
  async getRecords(module, options = {}) { throw new Error('Not implemented'); }
  async upsertRecord(module, record) { throw new Error('Not implemented'); }
  async deleteRecord(module, id) { throw new Error('Not implemented'); }

  // Pagination helper - fetches all pages
  async getAllRecords(module, pageSize = 100) {
    const all = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { records, nextPage } = await this.getRecords(module, { page, pageSize });
      all.push(...records);
      hasMore = !!nextPage;
      page = nextPage || page + 1;
      if (!nextPage && records.length < pageSize) hasMore = false;
      // Rate limit safety
      await new Promise(r => setTimeout(r, 100));
    }

    return all;
  }
}

module.exports = BaseConnector;
