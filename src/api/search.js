'use strict';

const axios = require('axios');
const { config } = require('../config');
const logger = require('../utils/logger');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Fetches all MDMS records for a given schemaCode from the search API.
 * Retries up to config.retryAttempts times with exponential back-off.
 *
 * Returns an array of MDMS record objects (mdms[]).
 */
async function searchMdmsRecords(schemaCode, baseUrl, attempt = 1) {
  const url = `${baseUrl}/mdms-v2/v2/_search`;
  const payload = {
    MdmsCriteria: {
      tenantId: config.tenantId,
      limit: config.limit,
      schemaCode,
    },
    RequestInfo: {
      authToken: config.authToken,
    },
  };

  logger.info(`[Search] schemaCode=${schemaCode} attempt=${attempt}/${config.retryAttempts}`);

  try {
    const { data } = await axios.post(url, payload, {
      headers: { 'content-type': 'application/json;charset=UTF-8' },
      timeout: 60_000,
    });

    const records = data?.mdms ?? [];
    logger.info(`[Search] ✓ Fetched ${records.length} records for "${schemaCode}"`);
    return records;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data
      ? JSON.stringify(err.response.data).slice(0, 200)
      : err.message;

    logger.warn(`[Search] Attempt ${attempt} failed — status=${status ?? 'N/A'} msg=${msg}`);

    if (attempt < config.retryAttempts) {
      const delay = config.retryDelayMs * attempt;
      logger.info(`[Search] Retrying in ${delay}ms…`);
      await sleep(delay);
      return searchMdmsRecords(schemaCode, baseUrl, attempt + 1);
    }

    logger.error(`[Search] All retries exhausted for "${schemaCode}": ${err.message}`);
    throw err;
  }
}

module.exports = { searchMdmsRecords };
