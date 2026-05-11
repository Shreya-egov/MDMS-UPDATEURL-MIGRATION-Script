'use strict';

const axios = require('axios');
const { config } = require('../config');
const logger = require('../utils/logger');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Sends the updated MDMS record to the update API.
 * Retries up to config.retryAttempts times with exponential back-off.
 *
 * Returns { success, status, data } on success.
 * Returns { success: false, status, error } after all retries are exhausted
 * (does NOT throw — caller decides how to handle failures).
 */
async function updateMdmsRecord(schemaCode, record, baseUrl, attempt = 1) {
  const url = `${baseUrl}/mdms-v2/v2/_update/${schemaCode}`;
  const uid = record.id ?? record.uniqueIdentifier ?? 'unknown';
  const payload = {
    Mdms: record,
    RequestInfo: {
      authToken: config.authToken,
    },
  };

  try {
    const { data, status } = await axios.post(url, payload, {
      headers: { 'content-type': 'application/json;charset=UTF-8' },
      timeout: 30_000,
    });
    return { success: true, status, data };
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data
      ? JSON.stringify(err.response.data).slice(0, 200)
      : err.message;

    logger.warn(
      `[Update] Attempt ${attempt}/${config.retryAttempts} failed — id=${uid} status=${status ?? 'N/A'} msg=${msg}`
    );

    if (attempt < config.retryAttempts) {
      const delay = config.retryDelayMs * attempt;
      logger.info(`[Update] Retrying ${uid} in ${delay}ms…`);
      await sleep(delay);
      return updateMdmsRecord(schemaCode, record, baseUrl, attempt + 1);
    }

    return { success: false, status, error: err.message };
  }
}

module.exports = { updateMdmsRecord };
