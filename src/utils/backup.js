'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const logger = require('./logger');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Saves a JSON backup of all records for a given schemaCode before update.
 * Returns the file path of the backup.
 */
function saveBackup(schemaCode, records) {
  ensureDir(config.backupDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = schemaCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(config.backupDir, `${safeName}__${ts}.json`);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
  logger.info(`Backup saved → ${filePath}`);
  return filePath;
}

/**
 * Loads a backup JSON file and returns the parsed records array.
 */
function loadBackup(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Lists all .json backup files in the backup directory, sorted newest first.
 */
function listBackups() {
  ensureDir(config.backupDir);
  return fs
    .readdirSync(config.backupDir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      fullPath: path.join(config.backupDir, f),
      mtime: fs.statSync(path.join(config.backupDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);
}

module.exports = { saveBackup, loadBackup, listBackups };
