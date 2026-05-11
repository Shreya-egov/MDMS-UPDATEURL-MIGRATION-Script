'use strict';

const { config } = require('../config');

/**
 * Recursively replaces all occurrences of config.oldUrl with config.newUrl
 * in any value — string, array, or object.
 * Returns { replaced: bool, value: newValue }
 */
function replaceUrls(value) {
  if (typeof value === 'string') {
    if (value.includes(config.oldUrl)) {
      return {
        replaced: true,
        value: value.split(config.oldUrl).join(config.newUrl),
      };
    }
    return { replaced: false, value };
  }

  if (Array.isArray(value)) {
    let anyReplaced = false;
    const newArr = value.map(item => {
      const r = replaceUrls(item);
      if (r.replaced) anyReplaced = true;
      return r.value;
    });
    return { replaced: anyReplaced, value: newArr };
  }

  if (value !== null && typeof value === 'object') {
    let anyReplaced = false;
    const newObj = {};
    for (const key of Object.keys(value)) {
      const r = replaceUrls(value[key]);
      if (r.replaced) anyReplaced = true;
      newObj[key] = r.value;
    }
    return { replaced: anyReplaced, value: newObj };
  }

  return { replaced: false, value };
}

/**
 * Compares oldObj and newObj and returns a flat list of changed string fields.
 * Each entry: { path, oldValue, newValue }
 */
function diffChanges(oldObj, newObj, path = '') {
  const changes = [];

  if (typeof oldObj === 'string') {
    if (oldObj !== newObj) {
      changes.push({ path: path || '(root)', oldValue: oldObj, newValue: newObj });
    }
    return changes;
  }

  if (Array.isArray(oldObj)) {
    const len = Math.max(oldObj.length, (newObj || []).length);
    for (let i = 0; i < len; i++) {
      changes.push(...diffChanges(oldObj[i], newObj[i], `${path}[${i}]`));
    }
    return changes;
  }

  if (oldObj !== null && typeof oldObj === 'object') {
    for (const key of Object.keys(oldObj)) {
      changes.push(
        ...diffChanges(oldObj[key], newObj ? newObj[key] : undefined, path ? `${path}.${key}` : key)
      );
    }
  }

  return changes;
}

module.exports = { replaceUrls, diffChanges };
