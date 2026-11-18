/**
 * UI kit: builders for the reusable components styled in kit.css. Screens use these instead
 * of assembling class names, so every button, card and dialog looks and behaves the same.
 */
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './kit.css';
import { h, icon, type IconName } from '../dom';

export type Tone = 'neutral' | 'primary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
/** Text (wrapped in a span) or ready-made content. */
export type Content = string | Node;

interface Pressable {
  onClick?: () => void;
  /** Tooltip / longer description. */
  title?: string;
  disabled?: boolean;
  /** Extra classes for layout tweaks by the caller. */
  class?: string;
}

export interface ButtonOptions extends Pressable {
  label: Content;
  icon?: IconName;
  tone?: Tone;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  /** Flat with a dashed outline instead of raised: for extras like "Delete photo". */
  quiet?: boolean;
}

export function button(o: ButtonOptions): HTMLButtonElement {
  return pressable(
    [
      o.quiet ? 'quiet' : 'raised',
      'btn',
      toneClass(o.tone),
      o.size && o.size !== 'md' && `btn-${o.size}`,
      o.block && 'btn-block',
    ],
    o,
    o.icon ? icon(o.icon) : null,
    content(o.label),
  );
}

/** Button content with a title and a smaller second line. */
export function twoLine(title: string, detail: string): HTMLElement {
  return h('span', { class: 'two-line' }, h('span', {}, title), h('small', {}, detail));
}

export interface ToolOptions extends Pressable {
  icon: IconName;
  label: Content;
  /** Makes the tool an on/off switch (aria-pressed) that flips itself when tapped. */
  pressed?: boolean;
  onToggle?: (pressed: boolean) => void;
}

/** Toolbar button: icon above a short label. */
export function toolButton(o: ToolOptions): HTMLButtonElement {
  const btn = pressable(
    ['raised', 'tool'],
    { ...o, onClick: undefined },
    icon(o.icon),
    content(o.label),
  );
  if (o.pressed !== undefined) btn.setAttribute('aria-pressed', String(o.pressed));
  btn.addEventListener('click', () => {
    if (o.pressed !== undefined) {
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(next));
      o.onToggle?.(next);
    }
    o.onClick?.();
  });
  return btn;
}

export interface Choice<T> {
  value: T;
  label: string;
  /** Colour sample shown before the label. */
  swatch?: string;
}

export interface ChoiceGroupOptions<T> {
  label: string;
  /** Short explanation under the label. */
  hint?: string;
  options: Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

/** A labelled row of large buttons of which exactly one is selected (with a check mark). */
export function choiceGroup<T extends string | number | boolean>(
  o: ChoiceGroupOptions<T>,
): HTMLElement {
  const id = uid('choice');
  const buttons = o.options.map((opt) => {
    const btn = h(
      'button',
      { class: 'raised choice', type: 'button', 'aria-pressed': String(opt.value === o.selected) },
      icon('check'),
      opt.swatch ? h('span', { class: 'swatch', style: `background:${opt.swatch}` }) : null,
      h('span', {}, opt.label),
    );
    btn.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
      o.onSelect(opt.value);
    });
    return btn;
  });
  return h(
    'section',
    { class: 'field' },
    h('h2', { class: 'field-label', id }, o.label),
    o.hint ? h('p', { class: 'muted field-hint' }, o.hint) : null,
    h('div', { class: 'choice-group', role: 'group', 'aria-labelledby': id }, ...buttons),
  );
}

export interface TileOptions extends Pressable {
  value: Content;
  unit?: string;
  /** Small highlighted line, e.g. a best time. */
  note?: string;
  /** Selected look, e.g. for a number pad. */
  pressed?: boolean;
}

/** Big number tile, e.g. a piece count. Place several in a `.tile-grid`. */
export function tile(o: TileOptions): HTMLButtonElement {
  const btn = pressable(
    ['raised', 'tile'],
    o,
    h('strong', { class: 'tile-value' }, o.value),
    o.unit ? h('span', { class: 'tile-unit' }, o.unit) : null,
    o.note ? h('span', { class: 'tile-note' }, o.note) : null,
  );
  if (o.pressed !== undefined) btn.setAttribute('aria-pressed', String(o.pressed));
  return btn;
}

export interface CardOptions extends Pressable {
  title: string;
  subtitle?: string;
  /** Picture URL, or an icon on a plain background (for "add" cards). */
  image?: string;
  icon?: IconName;
  /** Status shown on the picture, see `badge()`. */
  badge?: HTMLElement | null;
  /** Dashed outline instead of raised: for "add something" cards. */
  quiet?: boolean;
}

/** Picture card. Place several in a `.card-grid`. */
export function card(o: CardOptions): HTMLButtonElement {
  const media = o.image
    ? h('img', { class: 'card-img', src: o.image, alt: '', loading: 'lazy' })
    : h('span', { class: 'card-img card-img-icon' }, o.icon ? icon(o.icon) : null);
  return pressable(
    [o.quiet ? 'quiet' : 'raised', 'card'],
    o,
    h('span', { class: 'card-media' }, media, o.badge),
    h(
      'span',
      { class: 'card-label' },
      h('strong', {}, o.title),
      o.subtitle ? h('span', { class: 'muted' }, o.subtitle) : null,
    ),
  );
}

export interface HeroCardOptions extends Pressable {
  image: string;
  title: string;
  /** Further lines below the title; the last one is shown muted. */
  lines: string[];
  icon?: IconName;
}

/** The one big "do this next" card, e.g. "Continue puzzle". */
export function heroCard(o: HeroCardOptions): HTMLButtonElement {
  return pressable(
    ['raised', 'hero-card'],
    o,
    h('img', { src: o.image, alt: '' }),
    h(
      'span',
      { class: 'hero-card-text' },
      h('strong', {}, o.title),
      ...o.lines.map((line, i) =>
        h('span', { class: i === o.lines.length - 1 && i > 0 ? 'muted' : undefined }, line),
      ),
    ),
    h('span', { class: 'hero-card-go' }, icon(o.icon ?? 'play')),
  );
}

/** Small status pill, e.g. "Solved" (primary) or "Started · 40 %" (accent). */
export function badge(text: string, o: { tone?: 'primary' | 'accent'; icon?: IconName } = {}) {
  return h(
    'span',
    { class: o.tone === 'primary' ? 'badge tone-primary' : 'badge' },
    o.icon ? icon(o.icon) : null,
    text,
  );
}

/** Large round icon, e.g. the check mark on "Well done!". */
export function iconCircle(name: IconName): HTMLElement {
  return h('div', { class: 'icon-circle' }, icon(name));
}

export interface DialogContent {
  icon?: IconName;
  title: string;
  text?: string;
  /** Anything between the text and the buttons. */
  extra?: Node[];
  /** Stacked full-width buttons, most important first. */
  actions: HTMLElement[];
}

/** Fills a `<dialog class="dialog">` with the standard layout. */
export function fillDialog(dialog: HTMLDialogElement, c: DialogContent): void {
  dialog.replaceChildren(
    ...[
      c.icon ? iconCircle(c.icon) : null,
      h('h2', { class: 'dialog-title' }, c.title),
      c.text ? h('p', { class: 'dialog-text' }, c.text) : null,
      ...(c.extra ?? []),
      h('div', { class: 'dialog-actions' }, ...c.actions),
    ].filter((n): n is HTMLElement => n !== null),
  );
}

// --- internals ----------------------------------------------------------------

function pressable(
  classes: (string | false | undefined)[],
  o: Pressable,
  ...children: (Node | null)[]
): HTMLButtonElement {
  return h(
    'button',
    {
      class: [...classes, o.class].filter(Boolean).join(' '),
      type: 'button',
      title: o.title,
      disabled: o.disabled,
      onclick: o.onClick,
    },
    ...children,
  );
}

function toneClass(tone: Tone | undefined): string | undefined {
  return tone && tone !== 'neutral' ? `tone-${tone}` : undefined;
}

function content(c: Content): Node {
  return typeof c === 'string' ? h('span', {}, c) : c;
}

let uidCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++uidCounter}`;
}
