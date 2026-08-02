/* The editor chrome, as a real stylesheet.
 *
 * This lived in a template literal, and a backtick typed inside a CSS comment
 * silently truncated the whole sheet — four times. The app rendered nothing
 * and the build could still pass, because the resulting syntax error landed
 * somewhere unrelated. There was a test guarding it, but a test catches the
 * mistake after it is made.
 *
 * A .css file cannot have the problem at all: backticks are ordinary
 * characters here. Imported with ?raw because the app injects it through a
 * <style> tag rather than letting Vite hoist it, which keeps the chrome and
 * the preview stylesheet on the same footing.
 *
 * Nothing was interpolated into it, so nothing is lost by the move. */
import css from './theme.css?raw'

export const APP_CSS = css
