/* Responsive rules for the preview surface and the exported pages.
 *
 * Three files, one job:
 *
 *   responsive.rules.css    the rules themselves, a real stylesheet
 *   responsive.build.js     the substitution, a pure function, no imports
 *   responsive.js           this file, which wires the two together
 *
 * WHY THE CSS IS NOT IN THIS FILE
 *
 * It used to be one 268-line template literal with its comments inside it. A
 * backtick anywhere in those comments ends the literal early, and the CSS
 * after it parses as JavaScript — sometimes a syntax error, sometimes valid
 * code that silently produces nothing and takes the whole app down while the
 * build stays green. That trap cost this project six incidents. Every one
 * happened inside a comment, and every one was written while explaining the
 * code rather than while writing it.
 *
 * The rule against it was correct and kept being broken, because it asked for
 * care in the one place where care is easiest to forget. Moving the CSS into a
 * real stylesheet removes the requirement instead of restating it: in a .css
 * file a backtick is an ordinary character with no power to end anything. The
 * comments in there can now quote `flex-wrap: nowrap` freely, and so can this
 * one, because there is no longer a template literal in this file to end.
 *
 * WHAT MODE MEANS
 *
 *   'container' — how wide is the frame. The editor needs this. Its preview is
 *   a pane inside a pane, so a media query would sit there reporting the
 *   browser width while the surface renders at 400, and the width control
 *   would do nothing.
 *
 *   'media' — how wide is the viewport. The exported pages need this. They are
 *   real standalone pages, and they are a style reference for an agent. The
 *   DESIGN.md beside them says to treat each breakpoint as a min-width, which
 *   is media-query language. Shipping `@container` taught a technique the
 *   prose never mentions, and an agent copying the reference would carry it
 *   into an application that has no frame to measure.
 *
 * Both modes read the same breakpoints and collapse at the same widths, so the
 * exported page behaves like the thing you were looking at.
 */
import RULES from './responsive.rules.css?raw'
import { buildResponsiveCss } from './responsive.build.js'

export function responsiveCss (breakpoints = [], mode = 'container') {
  return buildResponsiveCss(RULES, breakpoints, mode)
}
