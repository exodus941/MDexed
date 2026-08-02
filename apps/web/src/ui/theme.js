/* The editor's own chrome — deliberately separate from the preview stylesheet.
   The thing being designed sits inside this and must never inherit any of it,
   which is why the two themes below only ever touch `--`-prefixed names the
   preview does not read. */
export const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  /* ── One hue for the whole chrome ──
     Every neutral below is the same hue at its own saturation and lightness,
     so the hue slider rotates the entire interface without touching its tonal
     structure. Written as HSL for exactly that reason: the hex values these
     replace encoded the hue fourteen separate times, and there was no way to
     change it without changing everything else too.

     The same choice is what makes a light theme a block of numbers rather
     than a rewrite. Only the lightnesses and a handful of saturations differ
     between the two, and the hue slider keeps working in both. */
  --ui-h:208;

  /* ── Brightness ──
   * --ui-b is the raw slider, 0-33 in dark and 66-100 in light. --b
   * normalises it to 0-1 inside whichever theme is active, so every lightness
   * below is one calc against a single number.
   *
   * Surfaces and text move together but not equally. Lifting a dark theme is
   * a request for "less black", not for less contrast, so the backgrounds
   * travel about seven points across the range while the text travels four
   * in the same direction. Contrast narrows a little at the bright end, which
   * is the honest cost of the control, and the range is deliberately short
   * enough that it never falls below AA.
   *
   * Written as calc() inside hsl() rather than as a filter on the root: a
   * filter would drag the preview pane with it and repaint the design being
   * worked on, which is the one thing the chrome must never do.
   */
  --ui-b:16;
  --b:calc(var(--ui-b) / 33);

  --bg:hsl(var(--ui-h) 12% calc(2% + var(--b) * 6%));
  --surf:hsl(var(--ui-h) 12% calc(5% + var(--b) * 6%));
  --surf2:hsl(var(--ui-h) 12% calc(8% + var(--b) * 6%));
  --surf3:hsl(var(--ui-h) 14% calc(11% + var(--b) * 8%));
  --bdr:hsl(var(--ui-h) 12% calc(12% + var(--b) * 8%));
  --bdr2:hsl(var(--ui-h) 12% calc(16% + var(--b) * 8%));
  --text:hsl(var(--ui-h) 5% calc(85% + var(--b) * 4%));
  --text-dim:hsl(var(--ui-h) 4% calc(72% + var(--b) * 5%));
  /* Solved for a target ratio rather than picked: muted lands on 6.25:1 and
     dim on 3.75:1 against their own surface at the default brightness. They
     started at 3.29 and 1.89, where the small uppercase labels were genuinely
     hard to read. Nothing meant to be read should sit that low. */
  --muted:hsl(var(--ui-h) 6% calc(56.8% + var(--b) * 5%));
  --dim:hsl(var(--ui-h) 8% calc(42.1% + var(--b) * 6%));
  --scroll:hsl(var(--ui-h) 11% calc(21% + var(--b) * 8%));
  --scroll-hover:hsl(var(--ui-h) 10% calc(30% + var(--b) * 8%));
  /* The full hue circle, 0 to 360, so every position on the track shows the
     hue it selects. Stops every 30° rather than every 60°: the gradient
     interpolates in sRGB, and across a 60° span that cuts the corner through
     a desaturated middle — the greens and cyans came out muddy. */
  --spectrum:linear-gradient(to right,
    hsl(0 70% 55%),hsl(30 70% 55%),hsl(60 70% 55%),hsl(90 70% 55%),
    hsl(120 70% 55%),hsl(150 70% 55%),hsl(180 70% 55%),hsl(210 70% 55%),
    hsl(240 70% 55%),hsl(270 70% 55%),hsl(300 70% 55%),hsl(330 70% 55%),hsl(360 70% 55%));

  /* ── Semantic colours ──
     Left out of the hue rotation on purpose: they mean something, and a hue
     slider that also turned the error colour green would be a different
     feature. They do change between themes, because a colour legible on a
     5%-lightness page is not legible on a 93% one. */
  --accent:#dc9055;--success:#5aad80;--danger:#de5c5c;--warn:#d8a441;
  /* The same four as bare channels, so a component can pick its own alpha:
     rgb(var(--accent-rgb) / .4). Sixty-five rgba() literals were spread
     across the panels, every one of them the dark theme's value, and every
     one of them wrong the moment a second theme existed. A triple is the only
     form that lets an arbitrary alpha stay theme-aware. */
  --accent-rgb:220 144 85;--success-rgb:90 173 128;
  --danger-rgb:222 92 92;--warn-rgb:216 164 65;
  /* Which direction a wash goes. White lightens the dark theme; black darkens
     the light one. Anything using this reads as "slightly emphasised", not as
     "slightly white". */
  --ink-rgb:255 255 255;
  /* Tints of those, for hovers and soft fills. */
  --accent-wash:rgba(220,144,85,.07);--accent-soft:rgba(220,144,85,.13);
  --accent-line:rgba(220,144,85,.28);--accent-ring:rgba(220,144,85,.55);
  --success-soft:rgba(90,173,128,.13);--danger-soft:rgba(222,92,92,.15);
  --hover-wash:rgba(255,255,255,.08);--grey-wash:rgba(127,127,127,.16);
  --thumb-ring:rgba(255,255,255,.55);
  --shade:rgba(0,0,0,.35);--track-shade:rgba(0,0,0,.22);

  --display:'Plus Jakarta Sans',system-ui,sans-serif;--sans:'Plus Jakarta Sans',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;
  /* One duration for the whole editor. Snappier than this reads as jumpy. */
  --t:125ms;--ease:cubic-bezier(0.2,0,0,1);
  /* Preview surfaces sit below the page, so a live sample never reads as
     another input. Deliberately darker than --surf3, which is input fill. */
  --preview:hsl(var(--ui-h) 16% 4%);--preview-bdr:hsl(var(--ui-h) 13% 12%);
  color-scheme:dark;
}

/* ── Light ──
 * Paper, not a lightbox. The page sits at 93% rather than pure white and the
 * panels rise from it, which keeps the tonal order of the dark theme intact:
 * the background is still the recessed plane and a card still floats above it.
 * Going to #fff would invert that, because there is nowhere lighter to go.
 *
 * Inputs invert, though. --surf3 is above the panel in dark and below it in
 * light, because a field reads as a well on paper and as a raised slot in the
 * dark. That is the one place the two themes genuinely disagree.
 *
 * Saturation runs a little higher than the dark theme at the same hue: a tint
 * that is clearly present at 15% lightness disappears entirely at 95%.
 */
:root[data-ui-theme="light"]{
  /* 66-100 on the same slider, normalised to the same 0-1. Dimming the light
     theme darkens the paper and darkens the text with it, so the page reads
     as a lower lamp rather than as grey ink on white. */
  --b:calc((var(--ui-b) - 67) / 33);

  --bg:hsl(var(--ui-h) 16% calc(86% + var(--b) * 9%));
  --surf:hsl(var(--ui-h) 20% calc(92% + var(--b) * 7%));
  --surf2:hsl(var(--ui-h) 24% calc(95% + var(--b) * 5%));
  --surf3:hsl(var(--ui-h) 16% calc(83% + var(--b) * 9%));
  --bdr:hsl(var(--ui-h) 14% calc(78% + var(--b) * 9%));
  --bdr2:hsl(var(--ui-h) 14% calc(70% + var(--b) * 9%));
  --text:hsl(var(--ui-h) 18% calc(12% + var(--b) * 5%));
  --text-dim:hsl(var(--ui-h) 12% calc(24% + var(--b) * 6%));
  --muted:hsl(var(--ui-h) 8% calc(32.8% + var(--b) * 6%));
  --dim:hsl(var(--ui-h) 10% calc(46.7% + var(--b) * 6%));
  --scroll:hsl(var(--ui-h) 12% calc(68% + var(--b) * 10%));
  --scroll-hover:hsl(var(--ui-h) 12% calc(56% + var(--b) * 10%));
  --preview:hsl(var(--ui-h) 14% calc(81% + var(--b) * 9%));
  --preview-bdr:hsl(var(--ui-h) 12% calc(73% + var(--b) * 9%));

  /* Darkened until each clears 4.5:1 on the 93% page, checked with this app's
     own contrast module rather than by eye. The dark theme's
     values sit around 60-70% lightness and read as pastel smears here. */
  --accent:#994f16;--success:#2f7350;--danger:#b3312f;--warn:#8a6008;
  --accent-rgb:153 79 22;--success-rgb:47 115 80;
  --danger-rgb:179 49 47;--warn-rgb:138 96 8;
  --ink-rgb:0 0 0;
  --accent-wash:rgba(153,79,22,.07);--accent-soft:rgba(153,79,22,.12);
  --accent-line:rgba(153,79,22,.32);--accent-ring:rgba(153,79,22,.55);
  --success-soft:rgba(47,115,80,.12);--danger-soft:rgba(179,49,47,.12);
  /* Hovers darken on paper rather than lightening. */
  --hover-wash:rgba(0,0,0,.05);--grey-wash:rgba(0,0,0,.08);
  --thumb-ring:rgba(0,0,0,.35);
  --shade:rgba(0,0,0,.18);--track-shade:rgba(0,0,0,.07);
  color-scheme:light;
}
/* Toggled from the header. Kills editor chrome motion without touching the
   preview pane, which is showing the user's own motion tokens. */
html.no-anim *,html.no-anim *::before,html.no-anim *::after{
  transition:none!important;animation:none!important;scroll-behavior:auto!important
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.5;min-height:100vh}
/* Wide enough to grab and dark enough to see. A 6px thumb on a transparent
   track reads as "no scrollbar", which is worse than no styling at all. */
*{scrollbar-width:thin;scrollbar-color:var(--scroll) transparent}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-track{background:var(--track-shade)}
::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:6px;border:2px solid transparent;background-clip:content-box;min-height:32px}
::-webkit-scrollbar-thumb:hover{background:var(--scroll-hover);background-clip:content-box}
::-webkit-scrollbar-corner{background:transparent}

input,textarea,select{font-family:var(--sans);font-size:14px;color:var(--text);background:var(--surf3);border:1px solid var(--bdr);border-radius:6px;padding:8px 12px;outline:none;transition:border-color var(--t) var(--ease),background var(--t) var(--ease);width:100%}
input:focus,textarea:focus,select:focus{border-color:var(--accent);background:var(--surf2)}
textarea{resize:vertical;min-height:90px;font-size:13px;line-height:1.6}
label{display:block;font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:5px}

.btn-primary{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;border-radius:6px;padding:8px 16px;background:var(--accent);color:var(--bg);transition:filter var(--t) var(--ease)}
.btn-primary:hover{filter:brightness(1.1)}
/* The accent in outline form. Sits beside the filled Export as its quieter
   sibling — same colour, same weight in the eye's hierarchy minus one step. */
.btn-outline{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--accent);border-radius:6px;padding:8px 16px;background:transparent;color:var(--accent);transition:background var(--t) var(--ease),color var(--t) var(--ease)}
.btn-outline:hover{background:var(--accent-soft)}
.btn-outline:disabled{opacity:.5;cursor:progress}
.btn-outline:disabled:hover{background:transparent}
/* The full package — the one export that contains all the others, so it gets
   its own colour rather than competing with the accent beside it. */
.btn-package{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;border-radius:6px;padding:8px 16px;background:var(--success);color:var(--bg);transition:filter var(--t) var(--ease)}
.btn-package:hover{filter:brightness(1.1)}
.btn-package:disabled{opacity:.55;cursor:progress}
.btn-package:disabled:hover{filter:none}
/* An unlocked seed shows its open padlock only on hover — the affordance is
   discoverable without all five swatches shouting at once. */
.seed-lock:hover > span{opacity:1!important}
.btn-ghost{font-family:var(--sans);font-size:13px;font-weight:400;cursor:pointer;border:1px solid var(--bdr);border-radius:6px;padding:8px 16px;background:transparent;color:var(--muted);transition:background var(--t) var(--ease),color var(--t) var(--ease),border-color var(--t) var(--ease);display:inline-flex;align-items:center;gap:5px}
.btn-ghost:hover{background:var(--surf2);color:var(--text);border-color:var(--bdr2)}
.btn-ghost:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost:disabled:hover{background:transparent;color:var(--muted);border-color:var(--bdr)}
.btn-add{margin-top:8px;width:100%;padding:10px 16px;background:var(--accent-wash);color:var(--accent);border:1px dashed var(--accent-line);border-radius:8px;cursor:pointer;font-size:13px;font-family:var(--sans);transition:background var(--t) var(--ease)}
.btn-add:hover{background:var(--accent-soft)}
.btn-delete{background:none;border:none;cursor:pointer;color:var(--dim);border-radius:4px;transition:color var(--t) var(--ease);display:flex;align-items:center;justify-content:center;padding:4px}
.btn-delete:hover{color:var(--danger)}
/* Tab-strip chevrons. Opacity transitions so reaching the end of travel dims
   the button rather than blinking it; the exit collapses the width in the
   same keyframe as the fade, so the tabs slide into the gap exactly as it
   closes rather than snapping across afterwards. */
.chev{transition:color var(--t) var(--ease),opacity var(--t) var(--ease)}
/* Width only. Opacity stays on the transition above, so the fade continues
   from wherever the button already was: a spent chevron is at 0.3, and
   animating a keyframe from 1 would flash it back to full brightness on its
   way out. */
@keyframes dmd-chev-out{from{width:40px}to{width:0}}
.chev-out{animation:dmd-chev-out var(--t) var(--ease) forwards;overflow:hidden;pointer-events:none;padding:0!important}

/* The shared close control. Dimmed until pointed at, so it never competes
   with the message it sits beside. */
/* File drop target. A dashed box reads as "put something here" in a way no
   button does, and it doubles as the click target so there is one thing to
   aim at rather than a zone plus a button beside it. */
/* A <label> so the hidden file input is triggered by clicking anywhere in the
   box — which means inheriting the field-label styling above, hence the
   resets on the first line. */
.dropzone{text-transform:none;letter-spacing:normal;font-weight:400;margin-bottom:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;
  padding:34px 20px;border:1.5px dashed var(--bdr2);border-radius:10px;background:var(--surf2);
  color:var(--muted);cursor:pointer;text-align:center;
  transition:border-color var(--t) var(--ease),background var(--t) var(--ease),color var(--t) var(--ease)}
.dropzone:hover{border-color:var(--accent);color:var(--text-dim)}
.dropzone.over{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}

/* The destructive action on a log row. Hidden until the row is pointed at,
   so a list of eighty entries is not eighty invitations to wipe your work.
   :focus-within matters as much as :hover — hover-only would make it
   unreachable by keyboard, which is the sort of thing this app's own audit
   exists to catch. */
.rewind-btn{opacity:0;pointer-events:none;transition:opacity var(--t) var(--ease),background var(--t) var(--ease)}
.log-row:hover .rewind-btn,.log-row:focus-within .rewind-btn{opacity:1;pointer-events:auto}
.rewind-btn:hover{background:rgb(var(--danger-rgb) / .12)}
.rewind-btn:focus-visible{opacity:1;pointer-events:auto;outline:2px solid var(--danger);outline-offset:1px}

.close-x{opacity:.55;transition:opacity var(--t) var(--ease),background var(--t) var(--ease)}
.close-x:hover{opacity:1;background:var(--grey-wash)}
.close-x:focus-visible{opacity:1;outline:2px solid var(--accent);outline-offset:1px}

/* Inline delete confirmation: red tick commits, grey cross backs out. */
.btn-confirm{background:none;border:none;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;padding:4px;transition:color var(--t) var(--ease),background var(--t) var(--ease)}
.btn-confirm-yes{color:var(--danger)}
.btn-confirm-yes:hover{background:var(--danger-soft)}
.btn-confirm-no{color:var(--muted)}
.btn-confirm-no:hover{color:var(--success);background:var(--success-soft)}

/* Live samples. Darker than any input so a preview never reads as a field. */
.preview-box{background:var(--preview);border:1px solid var(--preview-bdr);border-radius:7px}

/* The tab strip scrolls, but a visible scrollbar inside a 42px bar looks like
   a rendering fault. Chevrons take over the job. */
.no-bar{scrollbar-width:none;-ms-overflow-style:none}
.no-bar::-webkit-scrollbar{display:none;width:0;height:0}

/* Entrances. Overlays and popovers appearing instantly is the last obviously
   unanimated thing in the editor. */
@keyframes dmd-fade{from{opacity:0}to{opacity:1}}
@keyframes dmd-pop{from{opacity:0;transform:translateY(-4px) scale(.985)}to{opacity:1;transform:none}}
@keyframes dmd-rise{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
@keyframes dmd-fall{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.99)}}
@keyframes dmd-fade-out{from{opacity:1}to{opacity:0}}
.anim-fade{animation:dmd-fade var(--t) var(--ease) both}
/* A straight dissolve out, for things that leave in place rather than
   travelling — the notice bar, which occupies a row and shouldn't slide. */
.anim-fade-out{animation:dmd-fade-out var(--t) var(--ease) forwards}
.anim-pop{animation:dmd-pop var(--t) var(--ease) both}
.anim-rise{animation:dmd-rise var(--t) var(--ease) both}
/* Exit as a keyframe rather than a transition: a transition needs a frame to
   tick between the two states, and rAF is throttled whenever the page isn't
   compositing — which left the toast stuck invisible. */
.anim-fall{animation:dmd-fall var(--t) var(--ease) forwards}

/* Cross dissolve. Both layers animate for the same duration and overlap
   completely, so there is never a frame of empty pane between two tabs.
   Linear rather than eased: an eased pair crosses below 50% opacity in the
   middle and shows a dip. */
@keyframes dmd-xfade-out{from{opacity:1}to{opacity:0}}
.xfade-out{animation:dmd-xfade-out var(--t) linear forwards}
.xfade-in{animation:dmd-fade var(--t) linear both}

.seg,.seg-on{font-family:var(--sans);font-size:12px;cursor:pointer;border:1px solid transparent;border-radius:5px;padding:4px 10px;background:transparent;color:var(--muted);transition:background var(--t) var(--ease),color var(--t) var(--ease);white-space:nowrap}
.seg:hover{color:var(--text);background:var(--surf3)}
.seg-on{background:var(--surf3);color:var(--text);font-weight:500}

.chip{font-family:var(--mono);font-size:10.5px;padding:2px 6px;border-radius:4px;background:var(--surf3);border:1px solid var(--bdr);color:var(--muted);white-space:nowrap}

/* A search field must not read as a chip. Chips are flat --surf3 with a dim
   border; this is inset, brighter-edged and carries a visible magnifier. */
.filter-field input{
  background:var(--bg);border:1px solid var(--bdr2);border-radius:999px;
  box-shadow:inset 0 1px 2px var(--shade)
}
.filter-field input::placeholder{color:var(--dim)}
.filter-field input:focus{border-color:var(--accent);background:var(--bg)}
.filter-field.has-value input{border-color:var(--accent-ring)}

/* Range inputs: the macro sliders live or die on these feeling right */
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:transparent;padding:0;border:none}
input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--bdr2)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:13px;height:13px;border-radius:50%;background:var(--accent);margin-top:-5px;cursor:grab;border:none;transition:transform var(--t) var(--ease)}
input[type=range]:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.15)}
input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:var(--bdr2)}
input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--accent);border:none;cursor:grab}

/* ── The hue slider ──
   The spectrum belongs to the track, not to the input box behind it — a
   gradient on the element itself paints a band around the 3px track and
   reads as a rainbow sitting behind a grey bar.

   The thumb carries the hue it is currently pointing at, so the control
   states its own value. A ring keeps it findable at the yellows, where a
   bare swatch would vanish into the track under it.

   The selectors need the input[type=range] prefix. A bare .hue-slider is
   specificity (0,1,0) and the generic track rule above is (0,1,1) — a type
   selector plus an attribute selector — so the grey won and the spectrum was
   never painted, in either place it had been tried. */
input[type=range].hue-slider::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:var(--spectrum)}
input[type=range].hue-slider::-moz-range-track{height:6px;border-radius:3px;background:var(--spectrum)}
input[type=range].hue-slider::-webkit-slider-thumb{width:14px;height:14px;margin-top:-4px;background:hsl(var(--hue) 70% 55%);box-shadow:0 0 0 2px var(--surf),0 0 0 3px var(--thumb-ring)}
input[type=range].hue-slider::-moz-range-thumb{width:14px;height:14px;background:hsl(var(--hue) 70% 55%);box-shadow:0 0 0 2px var(--surf),0 0 0 3px var(--thumb-ring)}

.num{font-family:var(--mono);font-size:12px;padding:4px 6px;text-align:right}
.num::-webkit-outer-spin-button,.num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.num[type=number]{-moz-appearance:textfield}

.swatch{border-radius:5px;border:1px solid var(--hover-wash);cursor:pointer;position:relative;flex-shrink:0;transition:transform var(--t) var(--ease)}
.swatch:hover{transform:scale(1.06);z-index:1}

.panel-note{font-size:12px;color:var(--muted);line-height:1.55}
.pass{color:var(--success)}
.warn{color:var(--warn)}
.fail{color:var(--danger)}
`
