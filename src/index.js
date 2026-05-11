'use strict';

require('dotenv').config();

const { config, validateConfig } = require('./config');
const logger = require('./utils/logger');
const { replaceUrls, diffChanges } = require('./utils/replacer');
const { saveBackup } = require('./utils/backup');
const { generateCsvReport, printSummary } = require('./utils/report');
const { resolveBaseUrl, stopPortForward } = require('./utils/portforward');
const { searchMdmsRecords } = require('./api/search');
const { updateMdmsRecord } = require('./api/update');

// ── Concurrency helper ────────────────────────────────────────────────────────

/**
 * Runs an array of async task functions with at most `concurrency` running
 * simultaneously (no external dependency required).
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ── Per-schema processing ─────────────────────────────────────────────────────

async function processSchema(schemaCode, baseUrl, stats, allChanges) {
  logger.info(`\n${'─'.repeat(60)}`);
  logger.info(`Processing schema: ${schemaCode}`);
  logger.info(`${'─'.repeat(60)}`);

  let records;
  try {
    records = await searchMdmsRecords(schemaCode, baseUrl);
  } catch (err) {
    logger.error(`Skipping schema "${schemaCode}" — search failed: ${err.message}`);
    return;
  }

  stats.totalFetched += records.length;

  if (records.length === 0) {
    logger.warn(`No records returned for "${schemaCode}"`);
    return;
  }

  // Save backup before any modifications
  saveBackup(schemaCode, records);

  const toUpdate = [];

  for (const record of records) {
    const uid = record.id ?? record.uniqueIdentifier ?? '(no-id)';
    const { replaced, value: newData } = replaceUrls(record.data);

    if (!replaced) {
      stats.skipped++;
      continue;
    }

    const changes = diffChanges(record.data, newData);
    stats.modified++;
    stats.totalReplacements += changes.length;

    for (const ch of changes) {
      logger.info(`  [REPLACE] id=${uid}  field=${ch.path}`);
      logger.info(`    old → ${ch.oldValue}`);
      logger.info(`    new → ${ch.newValue}`);

      allChanges.push({
        schemaCode,
        uniqueIdentifier: uid,
        field: ch.path,
        oldValue: ch.oldValue,
        newValue: ch.newValue,
        status: config.dryRun ? 'DRY_RUN' : 'PENDING',
      });
    }

    if (!config.dryRun) {
      toUpdate.push({ record: { ...record, data: newData }, uid, changes });
    }
  }

  if (config.dryRun) {
    logger.info(`[DRY RUN] Would update ${stats.modified} record(s) in "${schemaCode}" — no API calls made`);
    return;
  }

  if (toUpdate.length === 0) return;

  // Batch-parallel updates
  const tasks = toUpdate.map(({ record, uid, changes }) => async () => {
    const res = await updateMdmsRecord(schemaCode, record, baseUrl);

    if (res.success) {
      stats.updateSuccess++;
      logger.info(`[Update] ✓ SUCCESS id=${uid} HTTP=${res.status}`);
      markChanges(allChanges, uid, changes, 'SUCCESS');
    } else {
      stats.updateFailed++;
      logger.error(`[Update] ✗ FAILED id=${uid} error=${res.error}`);
      markChanges(allChanges, uid, changes, 'FAILED');
    }
  });

  await runWithConcurrency(tasks, config.batchSize);
}

function markChanges(allChanges, uid, changes, status) {
  for (const ch of changes) {
    const entry = allChanges.find(
      e => e.uniqueIdentifier === uid && e.field === ch.path && e.status === 'PENDING'
    );
    if (entry) entry.status = status;
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

async function main() {
  validateConfig();

  logger.info('═'.repeat(60));
  logger.info('MDMS URL Migration Tool');
  logger.info('═'.repeat(60));
  logger.info(`Mode          : ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
  logger.info(`Old URL       : ${config.oldUrl}`);
  logger.info(`New URL       : ${config.newUrl}`);
  logger.info(`Schema codes  : ${config.schemaCodes.join(', ')}`);
  logger.info(`Batch size    : ${config.batchSize}`);
  logger.info(`Port-forward  : ${config.portForward.enabled ? 'enabled' : 'disabled'}`);
  logger.info('═'.repeat(60));

  const baseUrl = await resolveBaseUrl();

  const stats = {
    totalFetched: 0,
    modified: 0,
    skipped: 0,
    totalReplacements: 0,
    updateSuccess: 0,
    updateFailed: 0,
    dryRun: config.dryRun,
  };

  const allChanges = [];

  try {
    for (const schemaCode of config.schemaCodes) {
      await processSchema(schemaCode, baseUrl, stats, allChanges);
    }
  } finally {
    stopPortForward();
  }

  if (allChanges.length > 0) {
    generateCsvReport(allChanges);
  }

  printSummary(stats);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  logger.info('\nInterrupted — cleaning up…');
  stopPortForward();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopPortForward();
  process.exit(0);
});

main().catch(err => {
  logger.error(`Fatal: ${err.message}`);
  if (process.env.LOG_LEVEL === 'debug') logger.error(err.stack);
  stopPortForward();
  process.exit(1);
});
