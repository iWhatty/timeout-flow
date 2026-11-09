// ./src/parseDuration.js


/**
 * Parses a duration string like "2s", "1.5m", "500ms" into milliseconds.
 * Also accepts raw number values (treated as ms).
 * @param {string|number} input
 * @returns {number}
 */
export function parseDuration(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new TypeError(`Expected a finite number of ms, got: ${input}`);
    }
    return input;
  }

  if (typeof input !== 'string') {
    throw new TypeError(`Expected a duration string or number, got ${typeof input}`);
  }

  const str = input.toLowerCase().trim();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/);

  if (!match) {
    throw new Error(
      `Invalid duration format: "${input}". Expected formats like "500ms", "2s", "1.5m", or "1h".`
    );
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    throw new TypeError(`Invalid duration value: "${match[1]}"`);
  }

  const unit = match[2];

  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60_000;
    case 'h': return value * 3_600_000;
  }
}