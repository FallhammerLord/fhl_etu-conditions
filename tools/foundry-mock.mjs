/**
 * Minimal Foundry globals for running module code in Node. Anything not modeled here returns a
 * harmless proxy, so a missing mock shows up as wrong behavior in a check, not a crash on import.
 */
const any = new Proxy(function () {}, {
   get: (target, key) => (key === Symbol.toPrimitive ? () => '' : any),
   apply: () => any,
   construct: () => any
});

const hooks = new Map();
globalThis.Hooks = {
   on: (name, fn) => { (hooks.get(name) ?? hooks.set(name, []).get(name)).push(fn); },
   once: (name, fn) => globalThis.Hooks.on(name, fn),
   callAll: (name, ...args) => { for (const fn of hooks.get(name) ?? []) { fn(...args); } }
};

const settings = new Map();
const warnings = [];
globalThis.game = {
   user: { isGM: true },
   i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}` },
   settings: {
      register: (mod, key, cfg) => settings.set(`${mod}.${key}`, cfg.default),
      get: (mod, key) => settings.get(`${mod}.${key}`),
      set: (mod, key, v) => settings.set(`${mod}.${key}`, v)
   },
   modules: new Map([['fhl-etu-conditions', {}]])
};
/** Stand-in for the token class the Cypher System configures; counts core right-clicks. */
class MockToken
{
   _onClickRight() { this.coreRightClick = (this.coreRightClick ?? 0) + 1; }
}
globalThis.CONFIG = { statusEffects: [], Token: { objectClass: MockToken } };
globalThis.CONST = { ACTIVE_EFFECT_SHOW_ICON: { NEVER: 0, CONDITIONAL: 1, ALWAYS: 2 } };
globalThis.ui = { notifications: { warn: (m) => warnings.push(m), info: () => {} } };
globalThis.foundry = { canvas: { containers: {} }, utils: any };
globalThis.PIXI = { Container: class {}, Graphics: class {}, Text: class {} };
globalThis.fromUuidSync = () => null;

export { hooks, settings, warnings };
