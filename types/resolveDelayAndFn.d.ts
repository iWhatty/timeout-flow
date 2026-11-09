/**
 * Resolves flexible overloads and returns `{ fn, delay, options }`.
 *
 * Supported forms:
 * - (fn, delay, [options])
 * - (delay, fn, [options])
 * - (fn, [options])               // delay defaults
 *
 * This is intentionally strict about what counts as "options" to avoid
 * treating random values as configuration.
 *
 * @template {Record<string, any>} O
 * @param {Function|string|number} a
 * @param {Function|string|number|O} b
 * @param {O} [c]
 * @param {string|number} [defaultDelay=0]
 * @returns {{ fn: Function, delay: number, options: O }}
 */
export function resolveDelayFnOptions<O extends Record<string, any>>(a: Function | string | number, b: Function | string | number | O, c?: O, defaultDelay?: string | number): {
    fn: Function;
    delay: number;
    options: O;
};

export const isPlainOptions: (v: any) => boolean;
