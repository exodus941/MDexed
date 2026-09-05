/* ── WHAT EACH COMPONENT OWES A KEYBOARD ──
 *
 * Every open-spec system this was measured against publishes this and ours did
 * not. The accessibility section named focus, targets, states, overlays,
 * fields and waiting, and never said which KEYS a control answers. So a
 * builder reading the file learns that a switch needs a visible focus ring and
 * nothing about the fact that Space toggles it and Enter does not.
 *
 * The source is the ARIA Authoring Practices Guide. Nothing here is invented:
 * where the APG gives a pattern, the keys are its keys. Where a component is
 * not a widget at all, the entry says so rather than being left out, because
 * an absent entry reads as an oversight and a stated `none` reads as a
 * decision.
 *
 * ── ONE HOME ──
 *
 * `emit/markdown.js` renders this into DESIGN.md. `emit/checks.js` turns the
 * `requires` field into a check the reader can run. A contract written twice
 * would be worded one way for the reader and coded another way for the tool.
 *
 * ── THE TWO THINGS BUILDERS GET WRONG ──
 *
 * A composite widget has ONE tab stop, not one per item. Tab enters the group
 * and lands on the active item; the arrows move within it. Built with a
 * tabindex on every tab, a strip of six costs six presses to walk past.
 *
 * And Space is not Enter. A button takes both. A checkbox and a switch take
 * Space only, because Enter inside a form submits it.
 */

/** @typedef {{ key: string, does: string }} Binding */

/**
 * `requires` names the key identifiers a real implementation must contain, and
 * feeds the source check. It is deliberately a SUBSET of `keys`: only the ones
 * with no native element behind them. A `<button>` answers Enter and Space
 * with no script, so demanding the strings would fault correct code.
 */
export const KEYBOARD_CONTRACTS = [
  {
    component: 'button', role: 'button', pattern: 'Button',
    keys: [
      { key: 'Enter', does: 'Activates it.' },
      { key: 'Space', does: 'Activates it, on key-up.' },
    ],
    requires: [],
    note: 'A real `<button>` answers both with no script. A `div` with a click handler answers neither, which is the commonest way a control becomes mouse-only.',
  },
  {
    component: 'checkbox', role: 'checkbox', pattern: 'Checkbox',
    keys: [
      { key: 'Space', does: 'Toggles between checked and unchecked.' },
    ],
    requires: [],
    note: 'Space only. Enter submits the form around it, and a checkbox that also answers Enter steals that. A three-state box cycles to `indeterminate` only under program control, never from the keyboard.',
  },
  {
    component: 'switch', role: 'switch', pattern: 'Switch',
    keys: [
      { key: 'Space', does: 'Toggles on and off.' },
      { key: 'Enter', does: 'Optional, and only where the switch is built on a `<button>`.' },
    ],
    requires: [],
    note: 'It carries `aria-checked`, never `aria-pressed`. A switch is a state, and a toggle button is an action that stays down.',
  },
  {
    component: 'input', role: 'textbox', pattern: 'Text field',
    keys: [
      { key: 'Enter', does: 'Submits the form, where the field sits in one.' },
      { key: 'Escape', does: 'Clears the field, where it is a search box. Nowhere else.' },
    ],
    requires: [],
    note: 'Everything else is the platform’s: selection, word jumps, undo. Do not intercept them.',
  },
  {
    component: 'textarea', role: 'textbox', pattern: 'Multi-line text field',
    keys: [
      { key: 'Tab', does: 'Leaves the field. It never inserts a tab character.' },
      { key: 'Enter', does: 'Inserts a line break. It does not submit.' },
    ],
    requires: [],
    note: 'Trapping Tab to indent is the one change worth making only in a code editor, and it then needs Escape to release the trap.',
  },
  {
    component: 'select', role: 'combobox', pattern: 'Combobox',
    keys: [
      { key: 'Down', does: 'Opens the list, and moves to the next option once open.' },
      { key: 'Up', does: 'Moves to the previous option.' },
      { key: 'Home / End', does: 'Jumps to the first or last option.' },
      { key: 'Enter', does: 'Commits the focused option and closes.' },
      { key: 'Escape', does: 'Closes and restores the value it had on opening.' },
      { key: 'a printable character', does: 'Jumps to the next option starting with it.' },
    ],
    requires: ['ArrowDown', 'ArrowUp', 'Escape', 'Enter'],
    note: 'A native `<select>` gives all of this for nothing. A custom one owes every line, plus `aria-expanded` on the trigger and `aria-activedescendant` or a roving tabindex in the list.',
  },
  {
    component: 'tab', role: 'tab', pattern: 'Tabs',
    keys: [
      { key: 'Tab', does: 'Enters the strip and lands on the ACTIVE tab. One stop for the whole strip.' },
      { key: 'Left / Right', does: 'Moves between tabs in a horizontal strip. Up and Down in a vertical one.' },
      { key: 'Home / End', does: 'Jumps to the first or last tab.' },
      { key: 'Enter or Space', does: 'Activates the focused tab, where activation is manual.' },
    ],
    requires: ['ArrowRight', 'ArrowLeft', 'Home', 'End'],
    note: 'Automatic activation shows the panel as focus moves, and suits panels that are already loaded. Manual activation waits for Enter, and is right where showing a panel costs a fetch. Say which one you built. The strip is `role="tablist"`, each tab is `role="tab"` with `aria-selected` and `aria-controls`, and each panel is `role="tabpanel"` with `aria-labelledby`.',
  },
  {
    component: 'nav-item', role: 'link', pattern: 'Link',
    keys: [
      { key: 'Enter', does: 'Follows it.' },
    ],
    requires: [],
    note: 'A link is not a button: Space scrolls the page and must keep doing so. The current destination carries `aria-current="page"`.',
  },
  {
    component: 'nav-burger', role: 'button', pattern: 'Disclosure',
    keys: [
      { key: 'Enter or Space', does: 'Opens the menu and moves focus to its first item.' },
      { key: 'Escape', does: 'Closes it and returns focus to the burger.' },
      { key: 'Tab', does: 'Moves through the open menu. It does not trap: a fold is not a dialog.' },
    ],
    requires: ['Escape'],
    note: 'It carries `aria-expanded` and `aria-controls` pointing at the fold. A burger that only answers a click leaves a keyboard reader with no navigation at all below the collapse.',
  },
  {
    component: 'modal', role: 'dialog', pattern: 'Modal dialog',
    keys: [
      { key: 'Escape', does: 'Closes it.' },
      { key: 'Tab', does: 'Cycles forward inside it and never reaches the page behind.' },
      { key: 'Shift + Tab', does: 'Cycles backward, wrapping from the first element to the last.' },
    ],
    requires: ['Escape'],
    note: 'Focus enters on open and returns to the control that opened it on close. A `<dialog>` opened with `showModal()` gives the trap and the Escape for nothing; a hand-built one owes both.',
  },
  {
    component: 'tooltip', role: 'tooltip', pattern: 'Tooltip',
    keys: [
      { key: 'Escape', does: 'Dismisses it while its owner keeps focus.' },
    ],
    requires: ['Escape'],
    note: 'It appears on FOCUS as well as hover, or it does not exist for a keyboard. It is never the only place a piece of information lives, and it never holds a control: there is no way to reach one inside it.',
  },
  {
    component: 'alert', role: 'alert or status', pattern: 'Alert',
    keys: [
      { key: 'Escape', does: 'Dismisses it, where it can be dismissed.' },
    ],
    requires: [],
    note: 'It takes no focus. `role="alert"` interrupts the reader and suits a failure; `role="status"` waits for a pause and suits everything else. An alert holding an action needs that action in the tab order, which a bare `role="alert"` does not provide.',
  },
  {
    component: 'table', role: 'table', pattern: 'Not a widget',
    keys: [
      { key: 'Tab', does: 'Moves through the interactive cells only: a row checkbox, a row action, a sortable header.' },
    ],
    requires: [],
    note: 'A table is not a grid. Arrow keys move the page, and hijacking them costs more than it gives. Build `role="grid"` only where a cell is edited in place, and then the whole grid is one tab stop with arrows inside it.',
  },
  {
    component: 'card', role: 'none', pattern: 'Not a widget',
    keys: [],
    requires: [],
    note: 'A card is a container. Where the whole card is clickable, put the link on its heading and let the card’s click delegate to it, so the reader hears the destination rather than the whole card read aloud.',
  },
  {
    component: 'badge', role: 'none', pattern: 'Not a widget',
    keys: [],
    requires: [],
    note: 'It carries no focus and no keys. A badge whose count changes without a page load sits in a `role="status"`, or the number rewrites itself in silence.',
  },
  {
    component: 'avatar', role: 'img or none', pattern: 'Not a widget',
    keys: [],
    requires: [],
    note: 'Decorative beside a name that is already written, so `aria-hidden="true"`. Standing alone it needs the person’s name as its alternative text.',
  },
]

/** Every component that answers at least one key. */
export const INTERACTIVE_CONTRACTS = KEYBOARD_CONTRACTS.filter(c => c.keys.length > 0)

/** Lookup by component name, for the emitters. */
export const contractFor = name => KEYBOARD_CONTRACTS.find(c => c.component === name)
