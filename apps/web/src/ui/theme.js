/* The editor's own chrome — deliberately separate from the preview stylesheet.
   The app is dark and fixed; the thing being designed sits inside it and must
   never inherit any of this. */
export const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0b0e;--surf:#131318;--surf2:#191920;--surf3:#20202a;
  --bdr:#24242e;--bdr2:#2e2e3a;
  --text:#e0dedd;--muted:#74727a;--dim:#3e3e4a;
  --text-dim:#c0bebb;
  --accent:#dc9055;--success:#5aad80;--danger:#de5c5c;--warn:#d8a441;
  --display:'Plus Jakarta Sans',system-ui,sans-serif;--sans:'Plus Jakarta Sans',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;
  /* One duration for the whole editor. Snappier than this reads as jumpy. */
  --t:125ms;--ease:cubic-bezier(0.2,0,0,1);
  /* Preview surfaces sit below the page, so a live sample never reads as
     another input. Deliberately darker than --surf3, which is input fill. */
  --preview:#08080b;--preview-bdr:#1b1b23;
}
/* Toggled from the header. Kills editor chrome motion without touching the
   preview pane, which is showing the user's own motion tokens. */
html.no-anim *,html.no-anim *::before,html.no-anim *::after{
  transition:none!important;animation:none!important;scroll-behavior:auto!important
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.5;min-height:100vh}
/* Wide enough to grab and dark enough to see. A 6px thumb on a transparent
   track reads as "no scrollbar", which is worse than no styling at all. */
*{scrollbar-width:thin;scrollbar-color:#3a3a48 transparent}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-track{background:rgba(0,0,0,.22)}
::-webkit-scrollbar-thumb{background:#3a3a48;border-radius:6px;border:2px solid transparent;background-clip:content-box;min-height:32px}
::-webkit-scrollbar-thumb:hover{background:#4d4d5e;background-clip:content-box}
::-webkit-scrollbar-corner{background:transparent}

input,textarea,select{font-family:var(--sans);font-size:14px;color:var(--text);background:var(--surf3);border:1px solid var(--bdr);border-radius:6px;padding:8px 11px;outline:none;transition:border-color var(--t) var(--ease),background var(--t) var(--ease);width:100%}
input:focus,textarea:focus,select:focus{border-color:var(--accent);background:var(--surf2)}
textarea{resize:vertical;min-height:90px;font-size:13px;line-height:1.6}
label{display:block;font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:5px}

.btn-primary{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;border:none;border-radius:6px;padding:7px 15px;background:var(--accent);color:#0b0b0e;transition:filter var(--t) var(--ease)}
.btn-primary:hover{filter:brightness(1.1)}
/* The accent in outline form. Sits beside the filled Export as its quieter
   sibling — same colour, same weight in the eye's hierarchy minus one step. */
.btn-outline{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--accent);border-radius:6px;padding:6px 14px;background:transparent;color:var(--accent);transition:background var(--t) var(--ease),color var(--t) var(--ease)}
.btn-outline:hover{background:rgba(220,144,85,.13)}
.btn-outline:disabled{opacity:.5;cursor:progress}
.btn-outline:disabled:hover{background:transparent}
/* An unlocked seed shows its open padlock only on hover — the affordance is
   discoverable without all five swatches shouting at once. */
.seed-lock:hover > span{opacity:1!important}
.btn-ghost{font-family:var(--sans);font-size:13px;font-weight:400;cursor:pointer;border:1px solid var(--bdr);border-radius:6px;padding:7px 13px;background:transparent;color:var(--muted);transition:background var(--t) var(--ease),color var(--t) var(--ease),border-color var(--t) var(--ease);display:inline-flex;align-items:center;gap:5px}
.btn-ghost:hover{background:var(--surf2);color:var(--text);border-color:var(--bdr2)}
.btn-ghost:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost:disabled:hover{background:transparent;color:var(--muted);border-color:var(--bdr)}
.btn-add{margin-top:8px;width:100%;padding:10px;background:rgba(220,144,85,.07);color:var(--accent);border:1px dashed rgba(220,144,85,.28);border-radius:8px;cursor:pointer;font-size:13px;font-family:var(--sans);transition:background var(--t) var(--ease)}
.btn-add:hover{background:rgba(220,144,85,.13)}
.btn-delete{background:none;border:none;cursor:pointer;color:var(--dim);border-radius:4px;transition:color var(--t) var(--ease);display:flex;align-items:center;justify-content:center;padding:5px}
.btn-delete:hover{color:var(--danger)}

/* Inline delete confirmation: red tick commits, grey cross backs out. */
.btn-confirm{background:none;border:none;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;padding:5px;transition:color var(--t) var(--ease),background var(--t) var(--ease)}
.btn-confirm-yes{color:var(--danger)}
.btn-confirm-yes:hover{background:rgba(222,92,92,.15)}
.btn-confirm-no{color:var(--muted)}
.btn-confirm-no:hover{color:var(--success);background:rgba(90,173,128,.13)}

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
.anim-fade{animation:dmd-fade var(--t) var(--ease) both}
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

.seg,.seg-on{font-family:var(--sans);font-size:12px;cursor:pointer;border:none;border-radius:5px;padding:5px 11px;background:transparent;color:var(--muted);transition:background var(--t) var(--ease),color var(--t) var(--ease);white-space:nowrap}
.seg:hover{color:var(--text);background:var(--surf3)}
.seg-on{background:var(--surf3);color:var(--text);font-weight:500}

.chip{font-family:var(--mono);font-size:10.5px;padding:2px 7px;border-radius:4px;background:var(--surf3);border:1px solid var(--bdr);color:var(--muted);white-space:nowrap}

/* A search field must not read as a chip. Chips are flat --surf3 with a dim
   border; this is inset, brighter-edged and carries a visible magnifier. */
.filter-field input{
  background:var(--bg);border:1px solid var(--bdr2);border-radius:999px;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.35)
}
.filter-field input::placeholder{color:var(--dim)}
.filter-field input:focus{border-color:var(--accent);background:var(--bg)}
.filter-field.has-value input{border-color:rgba(220,144,85,.55)}

/* Range inputs: the macro sliders live or die on these feeling right */
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:transparent;padding:0;border:none}
input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--bdr2)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:13px;height:13px;border-radius:50%;background:var(--accent);margin-top:-5px;cursor:grab;border:none;transition:transform var(--t) var(--ease)}
input[type=range]:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.15)}
input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:var(--bdr2)}
input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--accent);border:none;cursor:grab}

.num{font-family:var(--mono);font-size:12px;padding:5px 7px;text-align:right}
.num::-webkit-outer-spin-button,.num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.num[type=number]{-moz-appearance:textfield}

.swatch{border-radius:5px;border:1px solid rgba(255,255,255,.08);cursor:pointer;position:relative;flex-shrink:0;transition:transform var(--t) var(--ease)}
.swatch:hover{transform:scale(1.06);z-index:1}

.panel-note{font-size:12px;color:var(--muted);line-height:1.55}
.pass{color:var(--success)}
.warn{color:var(--warn)}
.fail{color:var(--danger)}
`
