/* Preview icons.

   Sized and stroked from the token values, so changing the icon settings moves
   every icon in every surface at once — which is the point of having them as
   tokens rather than as fixed SVGs. */

export const Ico = ({ d, size = 'md' }) => (
  <svg className="icon" width={`var(--icon-${size}, 16px)`} height={`var(--icon-${size}, 16px)`}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

export const IconPlus = <path d="M12 5v14M5 12h14" />
export const IconChevron = <polyline points="6 9 12 15 18 9" />
export const IconArrow = <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>
export const IconSearch = <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
export const IconTrash = <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></>
export const IconCheck = <polyline points="20 6 9 17 4 12" />
export const IconInfo = <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>
export const IconStar = <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8z" />
export const IconFolder = <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
export const IconDownload = <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>
export const IconSend = <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>
export const IconFilter = <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
export const IconBell = <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>
export const IconUser = <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>
export const IconLock = <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>
export const IconMore = <><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>
export const IconX = <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
export const IconAlert = <><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>
export const IconCalendar = <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
export const IconChart = <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>

/* Form controls drawn from tokens rather than native widgets, so radius,
   colour and size all follow the system. */
export const Check = ({ on }) => (
  <span style={{
    width: 'var(--cmp-checkbox-size, 16px)', height: 'var(--cmp-checkbox-size, 16px)',
    borderRadius: 'var(--cmp-checkbox-rounded, var(--radius-sm, 4px))',
    border: `1px solid ${on ? 'var(--cmp-checkbox-checked-border-color, var(--c-accent, #333))' : 'var(--cmp-checkbox-border-color, var(--c-border, #ccc))'}`,
    background: on ? 'var(--cmp-checkbox-checked-background-color, var(--c-accent, #333))' : 'var(--cmp-checkbox-background-color, var(--c-surface, #fff))',
    color: 'var(--cmp-checkbox-checked-text-color, var(--c-accent-fg, #fff))',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }}>
    {on && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
  </span>
)

export const Switch = ({ on }) => (
  <span style={{
    width: 'var(--cmp-switch-width, 36px)', height: 'var(--cmp-switch-height, 20px)',
    borderRadius: 'var(--cmp-switch-rounded, 9999px)',
    background: on ? 'var(--cmp-switch-checked-background-color, var(--c-accent, #333))' : 'var(--cmp-switch-background-color, var(--c-border, #ccc))',
    display: 'inline-flex', alignItems: 'center', padding: 2, flexShrink: 0,
    justifyContent: on ? 'flex-end' : 'flex-start',
    transition: 'background var(--duration-fast, 120ms) var(--ease-standard, ease)',
  }}>
    <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--c-surface, #fff)' }} />
  </span>
)
