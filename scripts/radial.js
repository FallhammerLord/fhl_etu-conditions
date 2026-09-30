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
import {
   closeCoreHud, controlToken, controlledTokens, openCoreHud, tokenScreenGeometry,
   toggleCombat, toggleHidden, toggleTarget
} from './compat.js';

const NS = 'http://www.w3.org/2000/svg';
const RING_WIDTH = 70;
const MIN_INNER = 46;
const MAX_INNER = 150;
const MAX_SLICES = 8;
const GAUGE_START = 225;
const GAUGE_SWEEP = 270;

/** A right-button release this far (screen px) from the press was a canvas pan, not a click. */
const PAN_THRESHOLD = 6;

/** Wait after the right-button release before drawing the ring (ms). */
const OPEN_DELAY = 60;

/** Item types offered under Hacked (weapons, gear, and anything already hacked). */
const HACKABLE_TYPES = new Set(['attack', 'equipment', 'armor', 'artifact']);

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
   const read = () => Number(item.getFlag(MODULE_ID, 'hack') ?? 0);
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
      this.animate = false;
      this.lastClosed = null;
      this.pending = null;
      this.shownAt = 0;
      this.onKey = this.onKey.bind(this);
      this.onOutside = this.onOutside.bind(this);
   }

   get isOpen() { return !!this.token; }

   /**
    * Handles a right-click on a token. Foundry reports the click when the button goes down, so the ring
    * waits for the release: opening under a held button would take the release away from the canvas and
    * leave Foundry stuck mid right-drag (panning). A release after the pointer moved was a pan, so the
    * ring stays closed.
    *
    * @param {Token} token - The token right-clicked.
    * @param {object} [event] - The pointer-down event. Omit to open at once (macros, tests).
    * @returns {boolean} True if the right-click is ours (Foundry's HUD should not open).
    */
   open(token, event)
   {
      if (!token?.actor || !token.document?.isOwner) { return false; }
      // A second right-click on the same token closes the menu (the pointerdown already did) and stays closed.
      if (this.lastClosed?.token === token && performance.now() - this.lastClosed.at < 400) { return true; }
      closeCoreHud();
      controlToken(token);
      this.close();
      if (!event) { this.show(token); return true; }

      const start = { x: event.clientX ?? event.client?.x, y: event.clientY ?? event.client?.y };
      const onUp = (up) =>
      {
         if (up.button !== 2) { return; }
         this.cancelPending();
         const moved = Number.isFinite(start.x) && Math.hypot(up.clientX - start.x, up.clientY - start.y) > PAN_THRESHOLD;
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
      this.close();
      this.shownAt = performance.now();
      this.token = token;
      this.path = [];
      this.page = 0;
      this.hot = null;
      this.animate = true;
      this.build();
      this.render();
      document.addEventListener('keydown', this.onKey, true);
      document.addEventListener('pointerdown', this.onOutside, true);
   }

   close()
   {
      this.cancelPending();
      this.root?.remove();
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
      const g = (key) => ({ key, label: t(`condition.${key}`), type: 'gauge', gauge: conditionGauge(key) });
      const systems = actor.items.filter((i) => HACKABLE_TYPES.has(i.type) || Number(i.getFlag(MODULE_ID, 'hack') ?? 0) > 0);
      const hackedCount = systems.filter((i) => Number(i.getFlag(MODULE_ID, 'hack') ?? 0) > 0).length;
      const lock = getLevel(actor, 'targetLock');
      const jam = getLevel(actor, 'jammed');

      return {
         label: token.name,
         type: 'group',
         children: [
            { ...g('temperature'), label: t('menu.thermal') },
            {
               key: 'signal', label: t('menu.signal'), type: 'group',
               badge: lock || jam ? `L${lock} J${jam}` : '',
               children: [g('targetLock'), g('jammed')]
            },
            g('recoil'),
            {
               key: 'hacked', label: t('condition.hacked'), type: 'group',
               badge: hackedCount ? tf('menu.hackedCount', { count: hackedCount }) : '',
               empty: t('menu.noSystems'),
               children: systems.map((item) => ({ key: item.id, label: item.name, type: 'gauge', gauge: hackGauge(item) }))
            },
            {
               key: 'token', label: t('menu.token'), type: 'group',
               children: [
                  { key: 'target', label: t(token.isTargeted ? 'menu.untarget' : 'menu.target'), type: 'action', stay: true,
                    run: () => toggleTarget(token) },
                  { key: 'combat', label: t(token.inCombat ? 'menu.leaveCombat' : 'menu.joinCombat'), type: 'action', stay: true,
                    run: () => toggleCombat(token) },
                  ...(game.user.isGM ? [{ key: 'hide', label: t(token.document.hidden ? 'menu.reveal' : 'menu.hide'), type: 'action', stay: true,
                    run: () => toggleHidden(token) }] : []),
                  { key: 'core', label: t('menu.foundryHud'), type: 'action',
                    run: () => { this.close(); openCoreHud(token); } }
               ]
            },
            { key: 'clear', label: t('menu.clearAll'), type: 'action', stay: true,
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
         { key: '__more', label: t('menu.more'), type: 'more', badge: `${page + 1}/${pages}` }
      ];
   }

   // ---- Actions ----------------------------------------------------------------------------

   async choose(index)
   {
      const { node } = this.current();
      if (node.type !== 'group') { return; }
      const slice = this.slices(node)[index];
      if (!slice) { return; }
      if (slice.type === 'more') { this.page += 1; this.animate = true; this.render(); return; }
      if (slice.type === 'action')
      {
         await slice.run();
         if (this.isOpen) { if (!slice.stay) { this.path = []; } this.render(); }
         return;
      }
      this.path.push(slice.key);
      this.page = 0;
      this.hot = null;
      this.animate = true;
      this.render();
   }

   back()
   {
      if (!this.path.length) { this.close(); return; }
      this.path.pop();
      this.page = 0;
      this.hot = null;
      this.animate = true;
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

   /** Called on pan, zoom, and token movement. */
   reposition()
   {
      if (!this.isOpen) { return; }
      if (this.token.destroyed || !this.token.actor) { this.close(); return; }
      this.render();
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
      const geo = tokenScreenGeometry(this.token);
      const r0 = Math.min(MAX_INNER, Math.max(MIN_INNER, geo.radius + 8));
      const r1 = r0 + RING_WIDTH;
      const size = (r1 + 22) * 2;
      const c = size / 2;

      // Keep the whole ring on screen.
      const margin = r1 + 12;
      const x = Math.min(window.innerWidth - margin, Math.max(margin, geo.x));
      const y = Math.min(window.innerHeight - margin, Math.max(margin, geo.y));
      Object.assign(this.root.style, { left: `${x}px`, top: `${y}px` });

      const surface = this.root.querySelector('svg');
      surface.setAttribute('width', size);
      surface.setAttribute('height', size);
      surface.setAttribute('viewBox', `0 0 ${size} ${size}`);
      Object.assign(surface.style, { left: `${-c}px`, top: `${-c}px` });
      surface.replaceChildren();
      const layer = svg('g', this.animate ? { class: 'etu-ring-in' } : {});
      this.animate = false;
      layer.append(svg('circle', { cx: c, cy: c, r: r1 + 6, class: 'etu-ring-backdrop' }));

      const { node, trail } = this.current();
      if (node.type === 'group') { this.renderGroup(layer, node, actor, c, r0, r1); }
      else if (node.type === 'gauge') { this.renderGauge(layer, node.gauge, actor, c, r0, r1); }

      layer.append(svg('circle', { cx: c, cy: c, r: r0 - 3, class: 'etu-center', 'data-act': 'back' }));
      surface.append(layer);

      const count = this.targets().length;
      const crumb = this.root.querySelector('.etu-radial-crumb');
      crumb.textContent = trail.join('  ›  ') + (count > 1 ? `  ·  ${tf('menu.selected', { count })}` : '');
      crumb.style.top = `${-r1 - 46}px`;
      this.root.querySelector('.etu-radial-readout').style.top = `${r1 + 14}px`;
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
         layer.append(svg('path', { d: n === 1 ? sector(c, c, r0, r1, 0.01, 359.99) : sector(c, c, r0, r1, a0, a1), class: cls, 'data-act': 'slice', 'data-i': i }));

         const [lx, ly] = polar(c, c, (r0 + r1) / 2, mid);
         const words = s.label.split(' ');
         const lines = words.length > 1 && s.label.length > 10 ? [words.slice(0, -1).join(' '), words.at(-1)] : [s.label];
         const level = s.type === 'gauge' ? s.gauge.get(actor) : null;
         const value = s.type === 'gauge' ? (level ? s.gauge.cell(level) : '') : s.badge ?? '';
         const top = ly - (lines.length - 1) * 6 - (value ? 5 : 0);
         lines.forEach((line, j) => layer.append(svg('text', { x: lx, y: top + j * 12 + 4, class: 'etu-slice-label' }, line.toUpperCase())));
         if (value)
         {
            layer.append(svg('text', {
               x: lx, y: top + lines.length * 12 + 6, class: 'etu-slice-value',
               style: `fill: ${s.type === 'gauge' ? s.gauge.color(level) : 'var(--etu-accent)'}`
            }, value));
         }
         if (s.type === 'group' || s.type === 'more')
         {
            const [dx, dy] = polar(c, c, r1 - 7, mid);
            layer.append(svg('circle', { cx: dx, cy: dy, r: 2.5, class: 'etu-drill-dot' }));
         }
         if (i < 9)
         {
            const [nx, ny] = polar(c, c, r1 + 12, mid);
            layer.append(svg('text', { x: nx, y: ny + 4, class: 'etu-slice-key' }, String(i + 1)));
         }
      });
   }

   renderGauge(layer, gauge, actor, c, r0, r1)
   {
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
         const attrs = { d: sector(c, c, r0 + 8, r1, a0, a1), class: cls, 'data-act': 'cell', 'data-v': v };
         if (active || within) { attrs.style = `fill: ${gauge.color(v)}`; }
         layer.append(svg('path', attrs));
         const [lx, ly] = polar(c, c, (r0 + 8 + r1) / 2, mid);
         layer.append(svg('text', { x: lx, y: ly + 4, class: `etu-cell-label${active ? ' is-active' : ''}` }, gauge.cell(v)));
      });
      const [bx, by] = polar(c, c, (r0 + r1) / 2 + 4, 180);
      layer.append(svg('text', { x: bx, y: by + 4, class: 'etu-slice-key' }, `◂ ${t('menu.back')}`));
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
