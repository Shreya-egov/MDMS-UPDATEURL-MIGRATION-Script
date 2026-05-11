'use strict';

const { spawn } = require('child_process');
const { config } = require('../config');
const logger = require('./logger');

let pfProcess = null;

/**
 * Starts `kubectl port-forward` for the configured mdms-v2 service.
 *
 * Resolves with the local base URL (e.g. http://localhost:8081) once
 * kubectl confirms the tunnel is up. Rejects after TIMEOUT_MS if it
 * never starts, or immediately if kubectl is unavailable.
 *
 * Usage:
 *   const baseUrl = await startPortForward();
 *   // make all API calls against baseUrl
 *   stopPortForward();
 */
const TIMEOUT_MS = 15_000;

function startPortForward() {
  return new Promise((resolve, reject) => {
    const { namespace, service, localPort, remotePort } = config.portForward;
    const args = [
      'port-forward',
      '-n', namespace,
      `svc/${service}`,
      `${localPort}:${remotePort}`,
    ];

    logger.info(`Starting port-forward: kubectl ${args.join(' ')}`);
    pfProcess = spawn('kubectl', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Port-forward timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
    }

    pfProcess.stdout.on('data', data => {
      const line = data.toString().trim();
      logger.debug(`[port-forward] ${line}`);
      if (line.includes('Forwarding from')) {
        cleanup();
        const baseUrl = `http://localhost:${localPort}`;
        logger.info(`Port-forward active → ${baseUrl}`);
        resolve(baseUrl);
      }
    });

    pfProcess.stderr.on('data', data => {
      const line = data.toString().trim();
      if (line) logger.warn(`[port-forward stderr] ${line}`);
    });

    pfProcess.on('error', err => {
      cleanup();
      reject(new Error(`kubectl not found or failed to start: ${err.message}`));
    });

    pfProcess.on('close', code => {
      if (code !== 0 && code !== null) {
        logger.warn(`Port-forward process closed with exit code ${code}`);
      }
    });
  });
}

/**
 * Terminates the kubectl port-forward process if it is running.
 */
function stopPortForward() {
  if (pfProcess) {
    pfProcess.kill('SIGTERM');
    pfProcess = null;
    logger.info('Port-forward stopped');
  }
}

/**
 * Resolves the effective base URL for API calls.
 *
 * - If USE_PORT_FORWARD=true: starts kubectl port-forward and returns localhost URL.
 * - Otherwise: returns the configured BASE_URL.
 *
 * Call stopPortForward() when done if port-forward was started.
 */
async function resolveBaseUrl() {
  if (config.portForward.enabled) {
    try {
      return await startPortForward();
    } catch (err) {
      logger.error(`Port-forward failed: ${err.message}`);
      logger.warn(`Falling back to BASE_URL: ${config.baseUrl}`);
      return config.baseUrl;
    }
  }
  return config.baseUrl;
}

module.exports = { startPortForward, stopPortForward, resolveBaseUrl };
