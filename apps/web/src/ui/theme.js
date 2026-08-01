/* The editor's own chrome — deliberately separate from the preview stylesheet.
   The app is dark and fixed; the thing being designed sits inside it and must
   never inherit any of this. */
export const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0b0e;--surf:#131318;--surf2:#191920;--surf3:#20202a;
  --bdr:#24242e;--bdr2:#2e2e3a;
  --text:#e0dedd;--muted:#74727a;--dim:#3e3e4a;
  --text-dim:#c0bebb;
  --accent:#dc9055;--success:#5aad80;--danger:#de5c5c;--warn:#d8a441;
  --display:'Syne',sans-serif;--sans:'DM Sans',sans-serif;--mono:'JetBrains Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.5;min-height:100vh}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dim)}

input,textarea,select{font-family:var(--sans);font-size:14px;color:var(--text);background:var(--surf3);border:1px solid var(--bdr);border-radius:6px;padding:8px 11px;outline:none;transition:border-color .13s,background .13s;width:100%}
input:focus,textarea:focus,select:focus{border-color:var(--accent);background:var(--surf2)}
textarea{resize:vertical;min-height:90px;font-size:13px;line-height:1.6}
label{display:block;font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:5px}

.btn-primary{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;border:none;border-radius:6px;padding:7px 15px;background:var(--accent);color:#0b0b0e;transition:filter .12s}
.btn-primary:hover{filter:brightness(1.1)}
.btn-ghost{font-family:var(--sans);font-size:13px;font-weight:400;cursor:pointer;border:1px solid var(--bdr);border-radius:6px;padding:7px 13px;background:transparent;color:var(--muted);transition:all .12s;display:inline-flex;align-items:center;gap:5px}
.btn-ghost:hover{background:var(--surf2);color:var(--text);border-color:var(--bdr2)}
.btn-ghost:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost:disabled:hover{background:transparent;color:var(--muted);border-color:var(--bdr)}
.btn-add{margin-top:8px;width:100%;padding:10px;background:rgba(220,144,85,.07);color:var(--accent);border:1px dashed rgba(220,144,85,.28);border-radius:8px;cursor:pointer;font-size:13px;font-family:var(--sans);transition:background .13s}
.btn-add:hover{background:rgba(220,144,85,.13)}
.btn-delete{background:none;border:none;cursor:pointer;color:var(--dim);border-radius:4px;transition:color .1s;display:flex;align-items:center;justify-content:center;padding:5px}
.btn-delete:hover{color:var(--danger)}

.seg,.seg-on{font-family:var(--sans);font-size:12px;cursor:pointer;border:none;border-radius:5px;padding:5px 11px;background:transparent;color:var(--muted);transition:all .12s;white-space:nowrap}
.seg:hover{color:var(--text);background:var(--surf3)}
.seg-on{background:var(--surf3);color:var(--text);font-weight:500}

.chip{font-family:var(--mono);font-size:10.5px;padding:2px 7px;border-radius:4px;background:var(--surf3);border:1px solid var(--bdr);color:var(--muted);white-space:nowrap}

/* Range inputs: the macro sliders live or die on these feeling right */
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:transparent;padding:0;border:none}
input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--bdr2)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:13px;height:13px;border-radius:50%;background:var(--accent);margin-top:-5px;cursor:grab;border:none;transition:transform .1s}
input[type=range]:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.15)}
input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:var(--bdr2)}
input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--accent);border:none;cursor:grab}

.num{font-family:var(--mono);font-size:12px;padding:5px 7px;text-align:right}
.num::-webkit-outer-spin-button,.num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.num[type=number]{-moz-appearance:textfield}

.swatch{border-radius:5px;border:1px solid rgba(255,255,255,.08);cursor:pointer;position:relative;flex-shrink:0;transition:transform .1s}
.swatch:hover{transform:scale(1.06);z-index:1}

.panel-note{font-size:12px;color:var(--muted);line-height:1.55}
.pass{color:var(--success)}
.warn{color:var(--warn)}
.fail{color:var(--danger)}
`
