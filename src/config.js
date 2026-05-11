require('dotenv').config();

const usePortForward = process.env.USE_PORT_FORWARD !== 'false';
const localPort = parseInt(process.env.K8S_LOCAL_PORT || '8081', 10);

const config = {
  // Resolved base URL — localhost when port-forward is active, external URL otherwise
  baseUrl: usePortForward
    ? `http://localhost:${localPort}`
    : (process.env.BASE_URL || 'https://campaigns.afro.who.int'),

  authToken: process.env.AUTH_TOKEN,
  tenantId: process.env.TENANT_ID || 'chad',

  schemaCodes: process.env.SCHEMA_CODES
    ? process.env.SCHEMA_CODES.split(',').map(s => s.trim()).filter(Boolean)
    : ['ACCESSCONTROL-ACTIONS-TEST.actions-test'],

  oldUrl: process.env.OLD_URL || '/workbench-ui/employee',
  newUrl: process.env.NEW_URL || '/chad/hcm-digit-ui/employee',

  limit: parseInt(process.env.LIMIT || '100000', 10),
  dryRun: process.env.DRY_RUN === 'true',
  batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),

  backupDir: process.env.BACKUP_DIR || './backups',
  reportsDir: process.env.REPORTS_DIR || './reports',
  logDir: process.env.LOG_DIR || './logs',
  logLevel: process.env.LOG_LEVEL || 'info',

  portForward: {
    enabled: usePortForward,
    namespace: process.env.K8S_NAMESPACE || 'egov',
    service: process.env.K8S_SERVICE || 'mdms-v2',
    localPort,
    remotePort: parseInt(process.env.K8S_REMOTE_PORT || '8080', 10),
  },
};

function validateConfig() {
  const required = ['authToken', 'tenantId'];
  const missing = required.filter(key => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}. Check your .env file.`);
  }
  if (config.schemaCodes.length === 0) {
    throw new Error('SCHEMA_CODES must contain at least one entry.');
  }
}

module.exports = { config, validateConfig };
