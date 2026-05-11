'use strict';

require('dotenv').config();

const readline = require('readline');
const path = require('path');
const { config, validateConfig } = require('./config');
const logger = require('./utils/logger');
const { listBackups, loadBackup } = require('./utils/backup');
const { updateMdmsRecord } = require('./api/update');
const { resolveBaseUrl, stopPortForward } = require('./utils/portforward');

// ── CLI helper ────────────────────────────────────────────────────────────────

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ── Derive schemaCode from backup filename ────────────────────────────────────

function schemaCodeFromFilename(filename) {
  // filename format: SCHEMA_CODE__2024-01-01T00-00-00-000Z.json
  const base = path.basename(filename, '.json');
  const schemaRaw = base.split('__')[0];
  // convert underscores back: ACCESSCONTROL-ACTIONS-TEST_actions-test → ACCESSCONTROL-ACTIONS-TEST.actions-test
  // The dot in the schemaCode was replaced by _ during backup, so restore the last _ to .
  const lastUnderscore = schemaRaw.lastIndexOf('_');
  return lastUnderscore !== -1
    ? `${schemaRaw.slice(0, lastUnderscore)}.${schemaRaw.slice(lastUnderscore + 1)}`
    : schemaRaw;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  validateConfig();

  const backups = listBackups();

  if (backups.length === 0) {
    logger.error('No backup files found in backup directory. Nothing to roll back.');
    process.exit(1);
  }

  logger.info('═'.repeat(60));
  logger.info('MDMS Rollback Tool');
  logger.info('═'.repeat(60));
  logger.info('Available backups (newest first):\n');
  backups.forEach(({ name, mtime }, i) =>
    logger.info(`  [${i}] ${name}  (${mtime.toISOString()})`)
  );

  const raw = await ask('\nEnter the index of the backup to restore: ');
  const idx = parseInt(raw, 10);

  if (isNaN(idx) || idx < 0 || idx >= backups.length) {
    logger.error('Invalid selection. Exiting.');
    process.exit(1);
  }

  const chosen = backups[idx];
  const schemaCode = schemaCodeFromFilename(chosen.name);
  const records = loadBackup(chosen.fullPath);

  logger.info(`\nSelected : ${chosen.name}`);
  logger.info(`Schema   : ${schemaCode}`);
  logger.info(`Records  : ${records.length}`);

  const confirm = await ask('\nThis will overwrite current MDMS data. Type "yes" to proceed: ');
  if (confirm.toLowerCase() !== 'yes') {
    logger.info('Rollback cancelled.');
    process.exit(0);
  }

  const baseUrl = await resolveBaseUrl();

  let success = 0;
  let failed = 0;

  for (const record of records) {
    const uid = record.id ?? record.uniqueIdentifier ?? '(no-id)';
    const res = await updateMdmsRecord(schemaCode, record, baseUrl);

    if (res.success) {
      success++;
      logger.info(`[Rollback] ✓ id=${uid} HTTP=${res.status}`);
    } else {
      failed++;
      logger.error(`[Rollback] ✗ id=${uid} error=${res.error}`);
    }
  }

  stopPortForward();

  logger.info('═'.repeat(60));
  logger.info(`Rollback complete — success: ${success}  failed: ${failed}`);
  logger.info('═'.repeat(60));
}

process.on('SIGINT', () => { stopPortForward(); process.exit(0); });

main().catch(err => {
  logger.error(`Fatal: ${err.message}`);
  stopPortForward();
  process.exit(1);
});
