'use strict';

const winston = require('winston');
const fs = require('fs');
const path = require('path');
const { config } = require('../config');

const logDir = config.logDir || './logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const timestamp = new Date().toISOString().split('T')[0];

const logger = winston.createLogger({
  level: (config.logLevel || 'info').toLowerCase(),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] ${level.toUpperCase().padEnd(5)}: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) =>
          `[${timestamp}] ${level}: ${message}`
        )
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, `migration-${timestamp}.log`),
    }),
  ],
});

module.exports = logger;
