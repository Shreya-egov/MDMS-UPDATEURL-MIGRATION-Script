'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const logger = require('./logger');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function escapeCsv(val) {
  const str = String(val == null ? '' : val);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

/**
 * Writes a CSV report of all changes attempted.
 * Each entry: { schemaCode, uniqueIdentifier, field, oldValue, newValue, status }
 */
function generateCsvReport(changes) {
  ensureDir(config.reportsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(config.reportsDir, `migration-report-${ts}.csv`);

  const header = 'SchemaCode,UniqueIdentifier,Field,OldValue,NewValue,Status\n';
  const rows = changes
    .map(c =>
      [c.schemaCode, c.uniqueIdentifier, c.field, c.oldValue, c.newValue, c.status]
        .map(escapeCsv)
        .join(',')
    )
    .join('\n');

  fs.writeFileSync(filePath, header + rows, 'utf8');
  logger.info(`CSV report saved → ${filePath}`);
  return filePath;
}

/**
 * Prints a structured summary to the log at INFO level.
 */
function printSummary(stats) {
  const line = '═'.repeat(60);
  logger.info(line);
  logger.info('MIGRATION SUMMARY');
  logger.info(line);
  logger.info(`Mode                   : ${stats.dryRun ? 'DRY RUN (no changes applied)' : 'LIVE'}`);
  logger.info(`Total records fetched  : ${stats.totalFetched}`);
  logger.info(`Records modified       : ${stats.modified}`);
  logger.info(`Records skipped        : ${stats.skipped}`);
  logger.info(`Total URL replacements : ${stats.totalReplacements}`);
  if (!stats.dryRun) {
    logger.info(`Updates successful     : ${stats.updateSuccess}`);
    logger.info(`Updates failed         : ${stats.updateFailed}`);
  }
  logger.info(line);
}

module.exports = { generateCsvReport, printSummary };
