/**
 * The radial token menu: rings of slices around a token, drilling into sub-rings and gauge rings.
 * Right-click opens it (Shift + right-click opens Foundry's HUD instead). Spec: docs/SCOPE.md section 5.
 * Drawn as an SVG overlay in screen pixels, so it stays the same size at every zoom.
 */

import { MODULE_ID } from './constants.js';
import { CONDITIONS, temperatureStep } from './conditions.js';
import { adjustLevel, clearConditions, getLevel, setHack, setLevel } from './store.js';
import { canEdit } from './settings.js';
import { resolveActors } from './api.js';
import { artOf, hackOf, mountOf, unitSystems } from './items.js';
import { iconDefs, iconId, temperatureIcon } from './icons.js';
import {
   closeCoreHud, controlToken, controlledTokens, openCoreHud, tokenScreenGeometry,
   toggleCombat, toggleHidden, toggleTarget
} from './compat.js';

const NS = 'http://www.w3.org/2000/svg';
const RING_WIDTH = 84;
const MIN_INNER = 46;
const MAX_INNER = 150;
const MAX_SLICES = 8;
const GAUGE_START = 225;
const GAUGE_SWEEP = 270;

/** A right-button release this far (screen px) from the press was a canvas pan, not a click. */
const PAN_THRESHOLD = 6;

/** Wait after the right-button release before drawing the ring (ms). */
const OPEN_DELAY = 60;

/** How long a ring takes to furl away before it's removed (ms). Matches the CSS. */
const LEAVE_MS = 200;

/** Icon for each condition's slice and gauge. */
const CONDITION_ICONS = { temperature: 'thermal', targetLock: 'targetLock', jammed: 'jammed', recoil: 'recoil' };

/** @returns {boolean} False when the player's system asks for reduced motion. */
function motionAllowed()
{
   return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

/** Console trace, on when `CONFIG.debug.etuConditions = true`. */
function debug(...args)
{
   if (globalThis.CONFIG?.debug?.etuConditions) { console.log('ETU Conditions |', ...args); }
}

const t = (key) => game.i18n.localize(`${MODULE_ID}.${key}`);
const tf = (key, data) => game.i18n.format(`${MODULE_ID}.${key}`, data);

/**
 * @param {number} cx - Center x.
 * @param {number} cy - Center y.
 * @param {number} r - Radius.
 * @param {number} deg - Angle in degrees, 0 = up, clockwise.
 * @returns {[number, number]} Point.
 */
function polar(cx, cy, r, deg)
{
   const a = (deg * Math.PI) / 180;
   return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** @returns {string} SVG path for a ring sector from angle a0 to a1 between radii r0 and r1. */
function sector(cx, cy, r0, r1, a0, a1)
{
   const large = a1 - a0 > 180 ? 1 : 0;
   const [x1, y1] = polar(cx, cy, r1, a0);
   const [x2, y2] = polar(cx, cy, r1, a1);
   const [x3, y3] = polar(cx, cy, r0, a1);
   const [x4, y4] = polar(cx, cy, r0, a0);
   return `M${x1} ${y1}A${r1} ${r1} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 ${large} 0 ${x4} ${y4}Z`;
}

/** Longest slice label line, in characters, before it is shortened. */
const LABEL_LINE = 12;

/**
 * Splits a slice label into at most two lines that fit a slice, shortening with "…" when needed.
 *
 * @param {string} label - Full label.
 * @returns {string[]} One or two lines.
 */
export function labelLines(label)
{
   const clip = (s) => (s.length > LABEL_LINE ? `${s.slice(0, LABEL_LINE - 1).trimEnd()}…` : s);
   if (label.length <= LABEL_LINE) { return [label]; }
   const words = label.split(/\s+/);
   if (words.length === 1) { return [clip(label)]; }
   // Break where the two lines come out most even.
   let best = 1;
   let bestDiff = Infinity;
   for (let i = 1; i < words.length; i++)
   {
      const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
      if (diff < bestDiff) { best = i; bestDiff = diff; }
   }
   return [clip(words.slice(0, best).join(' ')), clip(words.slice(best).join(' '))];
}

/** Creates an SVG element with attributes and optional text. */
function svg(name, attrs = {}, text)
{
   const node = document.createElementNS(NS, name);
   for (const [k, v] of Object.entries(attrs)) { node.setAttribute(k, v); }
   if (text !== undefined) { node.textContent = text; }
   return node;
}

// ---- Gauge definitions -------------------------------------------------------------

/**
 * A gauge describes one editable value: its levels, how to read and write it, and its text.
 *
 * @param {string} key - Condition key.
 * @returns {object} Gauge.
 */
function conditionGauge(key)
{
   const def = CONDITIONS[key];
   const levels = [];
   for (let v = def.min; v <= def.max; v++) { levels.push(v); }
   return {
      key,
      title: t(`condition.${key}`),
      levels,
      editable: (actor) => actor.isOwner && canEdit(key),
      get: (actor) => getLevel(actor, key),
      set: (actors, v) => Promise.all(actors.map((a) => setLevel(a, key, v))),
      nudge: (actors, d) => Promise.all(actors.map((a) => adjustLevel(a, key, d))),
      cell: (v) => (key === 'temperature' ? temperatureStep(v).short : String(v)),
      // Temperature cells carry a flame or snowflake that grows with the distance from Normal.
      cellIcon: key === 'temperature' ? (v) => (v ? temperatureIcon(v) : null) : null,
      color: (v) => def.pipColor(v),
      value: (v) => (key === 'temperature'
         ? `${t(`temperature.${temperatureStep(v).key}`)} (${v > 0 ? '+' : ''}${v})`
         : (v ? String(v) : t(`none.${key}`))),
      note: (v, actor) =>
      {
         if (key === 'temperature')
         {
            if (v !== 0 && actor.type !== 'pc') { return t('note.temperature.npc'); }
            return t(`note.temperature.${temperatureStep(v).key}`);
         }
         return v ? tf(`note.${key}`, { level: v }) : t(`note.${key}Off`);
      }
   };
}

/**
 * @param {Item} item - The system that can be hacked.
 * @returns {object} Gauge for its Hack rating. Applies to this one unit only.
 */
function hackGauge(item)
{
   const levels = [];
   for (let v = 0; v <= 10; v++) { levels.push(v); }
   const read = () => hackOf(item);
   return {
      key: 'hacked',
      title: `${t('condition.hacked')}: ${item.name}`,
      levels,
      single: true,
      editable: (actor) => actor.isOwner && canEdit('hacked'),
      get: read,
      set: (_actors, v) => setHack(item.parent, item.id, v),
      nudge: (_actors, d) => setHack(item.parent, item.id, Math.max(0, Math.min(10, read() + d))),
      cell: (v) => String(v),
      color: () => '#d0574e',
      value: (v) => (v ? String(v) : t('none.hacked')),
      note: (v) => (v ? tf('note.hacked', { level: v, name: item.name }) : tf('note.hackedOff', { name: item.name }))
   };
}

// ---- The menu ---------------------------------------------------------------------------

class RadialMenu
{
   constructor()
   {
      this.token = null;
      this.path = [];
      this.page = 0;
      this.hot = null;
      this.root = null;
      this.transition = null;
      this.lastClosed = null;
      this.pending = null;
      this.shownAt = 0;
      this.onKey = this.onKey.bind(this);
      this.onOutside = this.onOutside.bind(this);
   }

   get isOpen() { return !!this.token; }

   /**
    * Handles a right-click on a token. If the button is still held, the ring waits for the release:
    * opening under a held button would take the release away from the canvas. A release after the
    * pointer moved was a pan, so the ring stays closed. If the button is already up, it opens after a
    * short delay that lets the trailing context-menu event pass.
    *
    * @param {Token} token - The token right-clicked.
    * @param {object} [event] - The pointer-down event. Omit to open at once (macros, tests).
    * @returns {boolean} True if the right-click is ours (Foundry's HUD should not open).
    */
   open(token, event)
   {
      debug('open requested', { token: token?.name, actor: !!token?.actor, owner: token?.document?.isOwner });
      if (!token?.actor || !token.document?.isOwner) { return false; }
      // A second right-click on the same token closes the menu (the pointerdown already did) and stays closed.
      if (this.lastClosed?.token === token && performance.now() - this.lastClosed.at < 400) { return true; }
      closeCoreHud();
      controlToken(token);
      this.close();
      if (!event) { this.show(token); return true; }

      // Foundry may report the right-click on release instead of press. If the button is already up,
      // only the trailing context-menu event is left to pass.
      const held = ((event.buttons ?? 0) & 2) === 2;
      debug('right-click', { token: token.name, type: event.type, button: event.button, buttons: event.buttons, held });
      if (!held)
      {
         this.pending = { timer: setTimeout(() => { this.pending = null; this.show(token); }, OPEN_DELAY) };
         return true;
      }

      const start = { x: event.clientX ?? event.client?.x, y: event.clientY ?? event.client?.y };
      const onUp = (up) =>
      {
         if (up.button !== 2) { return; }
         this.cancelPending();
         const moved = Number.isFinite(start.x) && Math.hypot(up.clientX - start.x, up.clientY - start.y) > PAN_THRESHOLD;
         debug('right-button released', { moved });
         if (moved) { return; }
         // Let the context-menu event that follows the release (on Windows) pass before the ring covers the cursor.
         this.pending = { timer: setTimeout(() => { this.pending = null; this.show(token); }, OPEN_DELAY) };
      };
      window.addEventListener('pointerup', onUp, true);
      this.pending = { onUp };
      return true;
   }

   cancelPending()
   {
      if (this.pending?.onUp) { window.removeEventListener('pointerup', this.pending.onUp, true); }
      if (this.pending?.timer) { clearTimeout(this.pending.timer); }
      this.pending = null;
   }

   /** @param {Token} token - Draw the ring around this token now. */
   show(token)
   {
      if (!token?.actor || token.destroyed) { return; }
      this.close({ animate: false });
      debug('show ring', { token: token.name });
      this.shownAt = performance.now();
      this.token = token;
      this.path = [];
      this.page = 0;
      this.hot = null;
      this.transition = 'open';
      this.build();
      this.render();
      document.addEventListener('keydown', this.onKey, true);
      document.addEventListener('pointerdown', this.onOutside, true);
   }

   /**
    * @param {object} [options]
    * @param {boolean} [options.animate=true] - Furl the ring closed instead of removing it at once.
    */
   close({ animate = true } = {})
   {
      this.cancelPending();
      const root = this.root;
      if (root && animate && motionAllowed())
      {
         // Furl the ring in, then remove it. It stops taking input straight away.
         root.classList.add('is-closing');
         root.querySelector('.etu-layer')?.classList.add('etu-leave-close');
         setTimeout(() => root.remove(), LEAVE_MS);
      }
      else { root?.remove(); }
      this.root = null;
      this.token = null;
      document.removeEventListener('keydown', this.onKey, true);
      document.removeEventListener('pointerdown', this.onOutside, true);
   }

   /** Units a change applies to: every selected token when the menu's token is among them. */
   targets()
   {
      const selected = controlledTokens();
      return selected.includes(this.token) ? resolveActors(selected) : [this.token.actor];
   }

   // ---- Tree -----------------------------------------------------------------------------

   rootNode()
   {
      const token = this.token;
      const actor = token.actor;
      const g = (key) => ({ key, label: t(`condition.${key}`), type: 'gauge', gauge: conditionGauge(key), icon: CONDITION_ICONS[key] });
      const systems = unitSystems(actor);
      const hackedCount = systems.filter((i) => hackOf(i) > 0).length;
      const lock = getLevel(actor, 'targetLock');
      const jam = getLevel(actor, 'jammed');

      return {
         label: token.name,
         type: 'group',
         children: [
            { ...g('temperature'), label: t('menu.thermal'), icon: temperatureIcon(getLevel(actor, 'temperature')) },
            {
               key: 'signal', label: t('menu.signal'), type: 'group', icon: 'signal',
               badge: lock || jam ? `L${lock} J${jam}` : '',
               children: [g('targetLock'), g('jammed')]
            },
            g('recoil'),
            {
               key: 'hacked', label: t('condition.hacked'), type: 'group', icon: 'hacked',
               badge: hackedCount ? tf('menu.hackedCount', { count: hackedCount }) : '',
               empty: t('menu.noSystems'),
               children: systems.map((item) =>
               {
                  const mount = mountOf(item);
                  return {
                     key: item.id, label: item.name, type: 'gauge', gauge: hackGauge(item),
                     tag: mount ? t(`mount.short.${mount}`) : '', icon: mount ?? 'system', art: artOf(item)
                  };
               })
            },
            {
               key: 'token', label: t('menu.token'), type: 'group', icon: 'token',
               children: [
                  { key: 'target', label: t(token.isTargeted ? 'menu.untarget' : 'menu.target'), type: 'action', stay: true,
                    icon: 'target', run: () => toggleTarget(token) },
                  { key: 'combat', label: t(token.inCombat ? 'menu.leaveCombat' : 'menu.joinCombat'), type: 'action', stay: true,
                    icon: 'combat', run: () => toggleCombat(token) },
                  ...(game.user.isGM ? [{ key: 'hide', label: t(token.document.hidden ? 'menu.reveal' : 'menu.hide'), type: 'action', stay: true,
                    icon: token.document.hidden ? 'reveal' : 'hide', run: () => toggleHidden(token) }] : []),
                  { key: 'core', label: t('menu.foundryHud'), type: 'action',
                    icon: 'hud', run: () => { this.close(); openCoreHud(token); } }
               ]
            },
            { key: 'clear', label: t('menu.clearAll'), type: 'action', stay: true, icon: 'clear',
              run: () => Promise.all(this.targets().map((a) => clearConditions(a))) }
         ]
      };
   }

   /** @returns {{ node: object, trail: string[] }} The node at the current path. */
   current()
   {
      let node = this.rootNode();
      const trail = [node.label];
      for (const key of this.path)
      {
         const next = node.children?.find((c) => c.key === key);
         if (!next) { break; }
         node = next;
         trail.push(next.label);
      }
      return { node, trail };
   }

   /**
    * Slices shown for a group node, with paging when there are more than fit.
    *
    * @param {object} node - Group node.
    * @returns {object[]} Visible slices.
    */
   slices(node)
   {
      const kids = node.children;
      if (kids.length <= MAX_SLICES) { return kids; }
      const per = MAX_SLICES - 1;
      const pages = Math.ceil(kids.length / per);
      const page = this.page % pages;
      return [
         ...kids.slice(page * per, page * per + per),
         { key: '__more', label: t('menu.more'), type: 'more', badge: `${page + 1}/${pages}`, icon: 'more' }
      ];
   }

   // ---- Actions ----------------------------------------------------------------------------

   async choose(index)
   {
      const { node } = this.current();
      if (node.type !== 'group') { return; }
      const slice = this.slices(node)[index];
      if (!slice) { return; }
      if (slice.type === 'more') { this.page += 1; this.transition = 'page'; this.render(); return; }
      if (slice.type === 'action')
      {
         await slice.run();
         if (this.isOpen) { if (!slice.stay) { this.path = []; } this.render(); }
         return;
      }
      this.path.push(slice.key);
      this.page = 0;
      this.hot = null;
      this.transition = 'down';
      this.render();
   }

   back()
   {
      if (!this.path.length) { this.close(); return; }
      this.path.pop();
      this.page = 0;
      this.hot = null;
      this.transition = 'up';
      this.render();
   }

   async setGauge(gauge, value)
   {
      if (!gauge.editable(this.token.actor)) { return this.warnLocked(); }
      await gauge.set(gauge.single ? [this.token.actor] : this.targets(), value);
      if (this.isOpen) { this.render(); }
   }

   async nudgeGauge(gauge, delta)
   {
      if (!gauge.editable(this.token.actor)) { return this.warnLocked(); }
      await gauge.nudge(gauge.single ? [this.token.actor] : this.targets(), delta);
      if (this.isOpen) { this.render(); }
   }

   warnLocked()
   {
      ui.notifications.warn(t('warn.gmOnly'));
   }

   // ---- Events --------------------------------------------------------------------------

   onOutside(event)
   {
      if (this.root && !this.root.contains(event.target))
      {
         this.lastClosed = { token: this.token, at: performance.now() };
         this.close();
      }
   }

   onKey(event)
   {
      if (!this.isOpen) { return; }
      const { node } = this.current();
      let handled = false;
      if (event.key === 'Escape') { this.back(); handled = true; }
      else if (/^[1-9]$/.test(event.key) && node.type === 'group') { this.choose(Number(event.key) - 1); handled = true; }
      else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && node.type === 'gauge')
      {
         this.nudgeGauge(node.gauge, event.key === 'ArrowRight' ? 1 : -1);
         handled = true;
      }
      // Keep these keys away from Foundry's own bindings (hotbar digits, Esc menu) while the menu is open.
      if (handled) { event.preventDefault(); event.stopPropagation(); }
   }

   /** Called when a condition changes anywhere, so the open menu shows current values. */
   refresh(actor)
   {
      if (this.isOpen && (!actor || actor === this.token.actor || actor.uuid === this.token.actor?.uuid)) { this.render(); }
   }

   /**
    * Called on pan, zoom, and token refresh. Moves the ring; rebuilds it only if its size must change.
    * Rebuilding here would cut short an animation, e.g. the first unfurl, which the token's own
    * refresh (from being selected as the ring opens) arrives in the middle of.
    */
   reposition()
   {
      if (!this.isOpen || !this.root) { return; }
      if (this.token.destroyed || !this.token.actor) { this.close(); return; }
      const box = this.layout();
      if (box.r0 !== this.drawnR0) { this.render(); return; }
      Object.assign(this.root.style, { left: `${box.x}px`, top: `${box.y}px` });
   }

   /**
    * @returns {{ x: number, y: number, r0: number, r1: number, size: number, c: number }} Where the ring
    *   goes on screen (kept fully visible) and its inner/outer radii, from the token's current size.
    */
   layout()
   {
      const geo = tokenScreenGeometry(this.token);
      const r0 = Math.min(MAX_INNER, Math.max(MIN_INNER, Math.round(geo.radius + 8)));
      const r1 = r0 + RING_WIDTH;
      const size = (r1 + 22) * 2;
      const margin = r1 + 12;
      const x = Math.min(window.innerWidth - margin, Math.max(margin, geo.x));
      const y = Math.min(window.innerHeight - margin, Math.max(margin, geo.y));
      return { x, y, r0, r1, size, c: size / 2 };
   }

   // ---- Rendering ----------------------------------------------------------------------------

   build()
   {
      this.root = document.createElement('div');
      this.root.className = 'etu-radial';
      this.root.innerHTML = '<svg class="etu-radial-svg" xmlns="http://www.w3.org/2000/svg"></svg>'
         + '<div class="etu-radial-crumb"></div><div class="etu-radial-readout" hidden></div>';
      const surface = this.root.querySelector('svg');
      surface.addEventListener('click', (e) => this.onClick(e));
      surface.addEventListener('contextmenu', (e) =>
      {
         e.preventDefault();
         e.stopPropagation();
         // Ignore a late context-menu event from the right-click that opened the ring.
         if (performance.now() - this.shownAt > 300) { this.back(); }
      });
      surface.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      surface.addEventListener('pointermove', (e) => this.onHover(e));
      surface.addEventListener('pointerleave', () => { if (this.hot) { this.hot = null; this.renderReadout(); } });
      document.body.append(this.root);
   }

   onClick(event)
   {
      const hit = event.target.closest('[data-act]');
      if (!hit) { return; }
      event.stopPropagation();
      const act = hit.dataset.act;
      if (act === 'back') { this.back(); }
      else if (act === 'slice') { this.choose(Number(hit.dataset.i)); }
      else if (act === 'cell')
      {
         const { node } = this.current();
         this.setGauge(node.gauge, Number(hit.dataset.v));
      }
   }

   onWheel(event)
   {
      event.preventDefault();
      event.stopPropagation();
      const hit = event.target.closest('[data-act]');
      if (!hit) { return; }
      const { node } = this.current();
      let gauge = null;
      if (node.type === 'gauge') { gauge = node.gauge; }
      else if (hit.dataset.act === 'slice') { gauge = this.slices(node)[Number(hit.dataset.i)]?.gauge ?? null; }
      if (gauge) { this.nudgeGauge(gauge, event.deltaY < 0 ? 1 : -1); }
   }

   onHover(event)
   {
      const hit = event.target.closest('[data-act]');
      let hot = null;
      if (hit?.dataset.act === 'slice') { hot = { kind: 'slice', i: Number(hit.dataset.i) }; }
      if (hit?.dataset.act === 'cell') { hot = { kind: 'cell', v: Number(hit.dataset.v) }; }
      if (JSON.stringify(hot) === JSON.stringify(this.hot)) { return; }
      this.hot = hot;
      for (const el of this.root.querySelectorAll('.is-hot')) { el.classList.remove('is-hot'); }
      if (hit && hot) { hit.classList.add('is-hot'); }
      this.renderReadout();
   }

   render()
   {
      if (!this.root || !this.token) { return; }
      const actor = this.token.actor;
      const { x, y, r0, r1, size, c } = this.layout();
      this.drawnR0 = r0;
      this.renderSeq = (this.renderSeq ?? 0) + 1;
      Object.assign(this.root.style, { left: `${x}px`, top: `${y}px` });

      const surface = this.root.querySelector('svg');
      surface.setAttribute('width', size);
      surface.setAttribute('height', size);
      surface.setAttribute('viewBox', `0 0 ${size} ${size}`);
      Object.assign(surface.style, { left: `${-c}px`, top: `${-c}px` });
      if (!surface.querySelector('defs')) { surface.insertAdjacentHTML('afterbegin', iconDefs()); }

      // A transition keeps the old ring briefly so it can furl out while the new one unfurls.
      const transition = motionAllowed() ? this.transition : null;
      this.transition = null;
      for (const old of surface.querySelectorAll('.etu-layer'))
      {
         if (!transition) { old.remove(); continue; }
         old.classList.replace('etu-layer', 'etu-leaving');
         old.classList.add(`etu-leave-${transition}`);
         setTimeout(() => old.remove(), LEAVE_MS);
      }
      const layer = svg('g', {
         class: `etu-layer${transition ? ` etu-enter-${transition}` : ''}`,
         style: `--cx: ${c}px; --cy: ${c}px`
      });
      layer.append(svg('circle', { cx: c, cy: c, r: r1 + 6, class: 'etu-ring-backdrop' }));

      const { node, trail } = this.current();
      if (node.type === 'group') { this.renderGroup(layer, node, actor, c, r0, r1); }
      else if (node.type === 'gauge') { this.renderGauge(layer, node, actor, c, r0, r1); }

      layer.append(svg('circle', { cx: c, cy: c, r: r0 - 3, class: 'etu-center', 'data-act': 'back' }));
      surface.append(layer);

      const count = this.targets().length;
      const crumb = this.root.querySelector('.etu-radial-crumb');
      crumb.textContent = trail.join('  ›  ') + (count > 1 ? `  ·  ${tf('menu.selected', { count })}` : '');
      crumb.style.top = `${-r1 - 46}px`;
      this.root.querySelector('.etu-radial-readout').style.top = `${r1 + 26}px`;
      this.renderReadout();
   }

   renderGroup(layer, node, actor, c, r0, r1)
   {
      const slices = this.slices(node);
      if (!slices.length)
      {
         layer.append(svg('circle', { cx: c, cy: c, r: (r0 + r1) / 2, class: 'etu-empty-ring' }));
         layer.append(svg('text', { x: c, y: c - r0 - 14, class: 'etu-slice-label' }, node.empty ?? ''));
         return;
      }
      const n = slices.length;
      const span = 360 / n;
      slices.forEach((s, i) =>
      {
         const mid = i * span;
         const a0 = mid - span / 2 + 1.5;
         const a1 = mid + span / 2 - 1.5;
         const locked = s.type === 'gauge' && !s.gauge.editable(actor);
         const cls = ['etu-slice', `etu-slice-${s.type}`, locked ? 'is-locked' : '',
            this.hot?.kind === 'slice' && this.hot.i === i ? 'is-hot' : ''].filter(Boolean).join(' ');
         // Each wedge is its own group so it can furl and unfurl on its own beat.
         const wedge = svg('g', { class: 'etu-wedge', style: `--i: ${i}` });
         layer.append(wedge);
         wedge.append(svg('path', { d: n === 1 ? sector(c, c, r0, r1, 0.01, 359.99) : sector(c, c, r0, r1, a0, a1), class: cls, 'data-act': 'slice', 'data-i': i }));

         const [lx, ly] = polar(c, c, (r0 + r1) / 2, mid);
         // Faint texture behind the label: the system's own card art if it has some, else a line icon.
         // As large as the ring's width allows, but no wider than the wedge's arc at mid-radius.
         const arc = Math.PI * (r0 + r1) * (span / 360);
         const iconSize = Math.min(RING_WIDTH * 0.78, arc * 0.85);
         if (s.art)
         {
            const clipId = `etu-clip-${this.renderSeq}-${i}`;
            const clip = svg('clipPath', { id: clipId });
            clip.append(svg('circle', { cx: lx, cy: ly, r: iconSize / 2 }));
            wedge.append(clip);
            wedge.append(svg('image', {
               href: s.art, x: lx - iconSize / 2, y: ly - iconSize / 2, width: iconSize, height: iconSize,
               preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${clipId})`, class: 'etu-slice-art'
            }));
         }
         else
         {
            wedge.append(svg('use', { href: `#${iconId(s.icon)}`, x: lx - iconSize / 2, y: ly - iconSize / 2, width: iconSize, height: iconSize, class: 'etu-slice-icon' }));
         }
         const lines = labelLines(s.label);
         const level = s.type === 'gauge' ? s.gauge.get(actor) : null;
         let value = s.type === 'gauge' ? (level ? s.gauge.cell(level) : '') : s.badge ?? '';
         if (s.tag) { value = value ? `${s.tag} · ${value}` : s.tag; }
         const top = ly - (lines.length - 1) * 6 - (value ? 5 : 0);
         lines.forEach((line, j) => wedge.append(svg('text', { x: lx, y: top + j * 12 + 4, class: 'etu-slice-label' }, line.toUpperCase())));
         if (value)
         {
            wedge.append(svg('text', {
               x: lx, y: top + lines.length * 12 + 6, class: 'etu-slice-value',
               style: `fill: ${s.type !== 'gauge' ? 'var(--etu-accent)' : level ? s.gauge.color(level) : 'var(--etu-muted)'}`
            }, value));
         }
         if (s.type === 'group' || s.type === 'more')
         {
            const [dx, dy] = polar(c, c, r1 - 7, mid);
            wedge.append(svg('circle', { cx: dx, cy: dy, r: 2.5, class: 'etu-drill-dot' }));
         }
         if (i < 9)
         {
            const [nx, ny] = polar(c, c, r1 + 14, mid);
            wedge.append(svg('text', { x: nx, y: ny + 4, class: 'etu-slice-key' }, String(i + 1)));
         }
      });
   }

   renderGauge(layer, node, actor, c, r0, r1)
   {
      const gauge = node.gauge;
      const levels = gauge.levels;
      const current = gauge.get(actor);
      const w = GAUGE_SWEEP / levels.length;
      const locked = !gauge.editable(actor);
      const signed = levels[0] < 0;
      levels.forEach((v, i) =>
      {
         const a0 = GAUGE_START + i * w + 1;
         const a1 = GAUGE_START + (i + 1) * w - 1;
         const mid = GAUGE_START + (i + 0.5) * w;
         const active = v === current;
         const within = signed
            ? (current < 0 ? v >= current && v < 0 : current > 0 ? v <= current && v > 0 : false)
            : v > 0 && v <= current;
         const cls = ['etu-cell', active ? 'is-active' : '', within && !active ? 'is-within' : '', locked ? 'is-locked' : '',
            this.hot?.kind === 'cell' && this.hot.v === v ? 'is-hot' : ''].filter(Boolean).join(' ');
         // Cells sweep in one after another around the arc.
         const wedge = svg('g', { class: 'etu-wedge', style: `--i: ${i}` });
         layer.append(wedge);
         const attrs = { d: sector(c, c, r0 + 8, r1, a0, a1), class: cls, 'data-act': 'cell', 'data-v': v };
         if (active || within) { attrs.style = `fill: ${gauge.color(v)}`; }
         wedge.append(svg('path', attrs));
         const [lx, ly] = polar(c, c, (r0 + 8 + r1) / 2, mid);
         const cellIcon = gauge.cellIcon?.(v);
         if (cellIcon)
         {
            const arc = Math.PI * (r0 + 8 + r1) * (w / 360);
            const size = Math.min((r1 - r0 - 8) * 0.8, arc * 0.9);
            wedge.append(svg('use', {
               href: `#${iconId(cellIcon)}`, x: lx - size / 2, y: ly - size / 2, width: size, height: size,
               class: `etu-cell-icon${active ? ' is-active' : ''}`
            }));
         }
         wedge.append(svg('text', { x: lx, y: ly + 4, class: `etu-cell-label${active ? ' is-active' : ''}` }, gauge.cell(v)));
      });
      // The gap at the bottom holds the condition's icon and the way back.
      const gap = svg('g', { class: 'etu-wedge etu-gauge-gap', style: `--i: ${levels.length}` });
      layer.append(gap);
      const [gx, gy] = polar(c, c, (r0 + r1) / 2 + 2, 180);
      const iconSize = 26;
      gap.append(svg('use', { href: `#${iconId(node.icon)}`, x: gx - iconSize / 2, y: gy - iconSize - 2, width: iconSize, height: iconSize, class: 'etu-gap-icon' }));
      gap.append(svg('text', { x: gx, y: gy + 12, class: 'etu-slice-key' }, `◂ ${t('menu.back')}`));
   }

   renderReadout()
   {
      const box = this.root?.querySelector('.etu-radial-readout');
      if (!box || !this.token) { return; }
      const actor = this.token.actor;
      const { node } = this.current();
      let title = '';
      let note = '';
      if (node.type === 'gauge')
      {
         const v = this.hot?.kind === 'cell' ? this.hot.v : node.gauge.get(actor);
         title = `${node.gauge.title}: ${node.gauge.value(v)}`;
         note = node.gauge.note(v, actor);
      }
      else if (this.hot?.kind === 'slice')
      {
         const s = this.slices(node)[this.hot.i];
         if (s?.type === 'gauge')
         {
            const v = s.gauge.get(actor);
            title = `${s.gauge.title}: ${s.gauge.value(v)}`;
            note = `${s.gauge.note(v, actor)} · ${t('menu.wheelHint')}`;
         }
         else if (s) { title = s.label; note = t(s.type === 'action' ? 'menu.runsNow' : 'menu.opensRing'); }
      }
      box.hidden = !title;
      box.replaceChildren();
      if (!title) { return; }
      const strong = document.createElement('strong');
      strong.textContent = title;
      const span = document.createElement('span');
      span.textContent = note;
      box.append(strong, span);
   }
}

export const radialMenu = new RadialMenu();
