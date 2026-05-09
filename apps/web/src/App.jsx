import { useState, useRef, useEffect } from "react"

/* ─────────────────────────── API client ─────────────────────────── */
const API_BASE = '/api/v1'
const TOKEN_KEY = 'design-md:tokens'
const DRAFT_KEY = 'design-md:draft'
const getStoredToken = id => {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')[id] || null }
  catch { return null }
}
const setStoredToken = (id, token) => {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')
    t[id] = token
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
  } catch {}
}
const api = {
  create: state => fetch(`${API_BASE}/projects`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ state, schemaVersion: 1 })
  }),
  read: id => fetch(`${API_BASE}/projects/${id}`),
  update: (id, token, state, version) => fetch(`${API_BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json', 'X-Edit-Token': token},
    body: JSON.stringify({ state, version })
  }),
}

/* ─────────────────────────── Color utilities ─────────────────────────── */
const isHex = h => /^#[0-9a-fA-F]{6}$/.test(h)
const hex2rgb = h => {
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : null
}
const rgb2hex = (r,g,b) => '#'+[r,g,b].map(x=>Math.max(0,Math.min(255,~~x)).toString(16).padStart(2,'0')).join('')
const hex2hsl = hex => {
  const rgb = hex2rgb(hex); if(!rgb) return [0,0,0]
  const [rr,gg,bb] = rgb.map(v=>v/255)
  const max=Math.max(rr,gg,bb), min=Math.min(rr,gg,bb)
  let h=0,s=0,l=(max+min)/2
  if(max!==min){
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min)
    if(max===rr) h=((gg-bb)/d+(gg<bb?6:0))/6
    else if(max===gg) h=((bb-rr)/d+2)/6
    else h=((rr-gg)/d+4)/6
  }
  return [Math.round(h*360),Math.round(s*100),Math.round(l*100)]
}
const hsl2hex = (h,s,l) => {
  h/=360;s/=100;l/=100
  if(s===0){ const v=Math.round(l*255); return rgb2hex(v,v,v) }
  const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q
  const hue=(p,q,t)=>{
    if(t<0)t+=1;if(t>1)t-=1
    if(t<1/6)return p+(q-p)*6*t
    if(t<1/2)return q
    if(t<2/3)return p+(q-p)*(2/3-t)*6
    return p
  }
  return rgb2hex(Math.round(hue(p,q,h+1/3)*255),Math.round(hue(p,q,h)*255),Math.round(hue(p,q,h-1/3)*255))
}
const uid = () => Math.random().toString(36).slice(2,8)

/* ─────────────────────────── YAML emitter ─────────────────────────── */
function q(v) {
  const s=String(v??'')
  return /[:#\[\]{},\n"']/.test(s)||s.startsWith(' ')||s.endsWith(' ')
    ? `"${s.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"` : s
}
function emitYaml(s) {
  const L=['---']
  if(s.meta.name)        L.push(`name: ${q(s.meta.name)}`)
  if(s.meta.description) L.push(`description: ${q(s.meta.description)}`)
  if(s.meta.version)     L.push(`version: ${q(s.meta.version)}`)
  if(s.colors.length){ L.push('colors:'); s.colors.forEach(c=>L.push(`  ${c.name}: "${c.value}"`)) }
  if(s.typography.length){
    L.push('typography:')
    s.typography.forEach(t=>{
      L.push(`  ${t.name}:`)
      for(const k of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','fontFeature','fontVariation'])
        if(t[k]) L.push(`    ${k}: ${t[k]}`)
    })
  }
  if(s.rounded.length){ L.push('rounded:'); s.rounded.forEach(r=>L.push(`  ${r.name}: ${r.value}`)) }
  if(s.spacing.length){ L.push('spacing:'); s.spacing.forEach(r=>L.push(`  ${r.name}: ${r.value}`)) }
  if(s.components.length){
    L.push('components:')
    s.components.forEach(c=>{ L.push(`  ${c.name}:`); c.properties.forEach(p=>L.push(`    ${p.key}: ${q(p.value)}`)) })
  }
  L.push('---'); return L.join('\n')
}
function emitMarkdown(s) {
  const { prose, colors } = s; const parts=[]
  if(prose.overview) parts.push(`## Overview\n${prose.overview}`)
  if(prose.colors||colors.length){
    let sec='## Colors\n'
    if(prose.colors) sec+=prose.colors+'\n'
    if(colors.length&&!prose.colors) sec+=colors.map(c=>`- **${c.name} (${c.value})**`).join('\n')
    parts.push(sec.trimEnd())
  }
  if(prose.typography)  parts.push(`## Typography\n${prose.typography}`)
  if(prose.layout)      parts.push(`## Layout\n${prose.layout}`)
  if(prose.elevation)   parts.push(`## Elevation & Depth\n${prose.elevation}`)
  if(prose.shapes)      parts.push(`## Shapes\n${prose.shapes}`)
  if(prose.components)  parts.push(`## Components\n${prose.components}`)
  if(prose.dosDonts)    parts.push(`## Do's and Don'ts\n${prose.dosDonts}`)
  return parts.join('\n\n')
}
function generateFile(s) {
  const yaml=emitYaml(s), md=emitMarkdown(s)
  return md?`${yaml}\n\n${md}`:yaml
}

/* ─────────────────────────── YAML parser ─────────────────────────── */
function parseYaml(text) {
  const r={}; let k1=null,k2=null
  for(const raw of text.split('\n')){
    const sp=raw.length-raw.trimStart().length, line=raw.trim()
    if(!line||line.startsWith('#')) continue
    const ci=line.indexOf(':'); if(ci<0) continue
    const k=line.slice(0,ci).trim(), rawV=line.slice(ci+1).trim(), v=rawV.replace(/^["']|["']$/g,'')
    if(sp===0){
      if(!rawV||rawV==='{}'){ r[k]={};k1=k;k2=null }
      else{ r[k]=v;k1=null;k2=null }
    } else if(sp===2&&k1){
      if(!rawV||rawV==='{}'){ if(typeof r[k1]==='object')r[k1][k]={};k2=k }
      else{ if(typeof r[k1]==='object')r[k1][k]=v;k2=null }
    } else if(sp===4&&k1&&k2){
      if(typeof r[k1]?.[k2]==='object') r[k1][k2][k]=v
    }
  }
  return r
}
function parseFile(text) {
  const s={
    meta:{name:'',description:'',version:''},
    colors:[],typography:[],rounded:[],spacing:[],components:[],
    prose:{overview:'',colors:'',typography:'',layout:'',elevation:'',shapes:'',components:'',dosDonts:''}
  }
  const fm=text.match(/^---\n([\s\S]*?)\n---/); if(!fm) return s
  const y=parseYaml(fm[1])
  s.meta.name=y.name||''; s.meta.description=y.description||''; s.meta.version=y.version||''
  if(y.colors)     s.colors    =Object.entries(y.colors).map(([n,v])=>({id:uid(),name:n,value:String(v)}))
  if(y.typography) s.typography=Object.entries(y.typography).map(([n,p])=>({
    id:uid(),name:n,fontFamily:p.fontFamily||'',fontSize:p.fontSize||'',
    fontWeight:p.fontWeight||'',lineHeight:p.lineHeight||'',letterSpacing:p.letterSpacing||'',
    fontFeature:p.fontFeature||'',fontVariation:p.fontVariation||''
  }))
  if(y.rounded)    s.rounded   =Object.entries(y.rounded).map(([n,v])=>({id:uid(),name:n,value:String(v)}))
  if(y.spacing)    s.spacing   =Object.entries(y.spacing).map(([n,v])=>({id:uid(),name:n,value:String(v)}))
  if(y.components) s.components=Object.entries(y.components).map(([n,p])=>({
    id:uid(),name:n,properties:Object.entries(p||{}).map(([k,v])=>({id:uid(),key:k,value:String(v)}))
  }))
  const body=text.slice(fm[0].length).trim()
  const secs=[...body.matchAll(/^## (.+)$/gm)]
  secs.forEach((m,i)=>{
    const txt=body.slice(m.index+m[0].length,secs[i+1]?.index).trim(), t=m[1].toLowerCase()
    if(t.includes('overview'))  s.prose.overview=txt
    else if(t.includes('color'))      s.prose.colors=txt
    else if(t.includes('typography')) s.prose.typography=txt
    else if(t.includes('layout'))     s.prose.layout=txt
    else if(t.includes('elevation'))  s.prose.elevation=txt
    else if(t.includes('shape'))      s.prose.shapes=txt
    else if(/don'?t|do's/.test(t))    s.prose.dosDonts=txt
    else if(t.includes('component'))  s.prose.components=txt
  })
  return s
}

/* ─────────────────────────── Default state ─────────────────────────── */
const INIT = {
  meta:{name:'My Design System',description:'',version:'alpha'},
  colors:[
    {id:'c1',name:'primary',  value:'#1a1c1e'},
    {id:'c2',name:'secondary',value:'#6c7278'},
    {id:'c3',name:'accent',   value:'#b8422e'},
    {id:'c4',name:'neutral',  value:'#f7f5f2'},
  ],
  typography:[
    {id:'t1',name:'h1',     fontFamily:'Georgia',fontSize:'48px',fontWeight:'700',lineHeight:'1.1',letterSpacing:'-0.02em'},
    {id:'t2',name:'body-md',fontFamily:'Georgia',fontSize:'16px',fontWeight:'400',lineHeight:'1.6',letterSpacing:''},
  ],
  rounded:[
    {id:'r1',name:'sm',  value:'4px'},{id:'r2',name:'md',  value:'8px'},
    {id:'r3',name:'lg',  value:'16px'},{id:'r4',name:'full',value:'9999px'},
  ],
  spacing:[
    {id:'s1',name:'xs',value:'4px'},{id:'s2',name:'sm',value:'8px'},
    {id:'s3',name:'md',value:'16px'},{id:'s4',name:'lg',value:'32px'},{id:'s5',name:'xl',value:'64px'},
  ],
  components:[],
  prose:{overview:'',colors:'',typography:'',layout:'',elevation:'',shapes:'',components:'',dosDonts:''}
}

/* ─────────────────────────── Icons ─────────────────────────── */
const Trash = ({sz=14}) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
const Plus = ({sz=14}) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const Chevron = ({open,sz=11}) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{transform:open?'rotate(180deg)':'none',transition:'transform .15s'}}><polyline points="6 9 12 15 18 9"/></svg>
const CopyIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
const UploadIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const DownloadIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>

/* ─────────────────────────── Shared UI ─────────────────────────── */
function SectionHeader({title,desc,count}) {
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <h2 style={{fontFamily:'var(--display)',fontSize:19,fontWeight:700,letterSpacing:'-0.025em',color:'var(--text)'}}>{title}</h2>
        {count!=null&&<span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)',background:'var(--surf3)',padding:'1px 8px',borderRadius:10,border:'1px solid var(--bdr)'}}>{count}</span>}
      </div>
      {desc&&<p style={{fontSize:13,color:'var(--muted)',marginTop:3,lineHeight:1.5}}>{desc}</p>}
    </div>
  )
}
function Empty({msg='Nothing here yet.'}) {
  return <div style={{textAlign:'center',padding:'28px 16px',color:'var(--dim)',fontSize:13,border:'1px dashed var(--bdr)',borderRadius:10,lineHeight:1.6}}>{msg}</div>
}
function SaveCancelRow({onSave,onCancel,saveLabel='Save'}) {
  return (
    <div style={{display:'flex',gap:8,marginTop:14}}>
      <button onClick={onSave} className="btn-primary">{saveLabel}</button>
      <button onClick={onCancel} className="btn-ghost">Cancel</button>
    </div>
  )
}
function AddRowBtn({label,onClick}) {
  return (
    <button className="btn-add" onClick={onClick} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
      <Plus sz={12}/>{label}
    </button>
  )
}
function DeleteBtn({onClick}) {
  return (
    <button onClick={onClick} className="btn-delete" style={{display:'flex',alignItems:'center',padding:'5px 5px'}}>
      <Trash sz={14}/>
    </button>
  )
}

/* ─────────────────────────── Meta tab ─────────────────────────── */
function MetaTab({state,setState}) {
  const up=(k,v)=>setState(s=>({...s,meta:{...s.meta,[k]:v}}))
  return (
    <div style={{maxWidth:520}}>
      <SectionHeader title="Project Info" desc="Core metadata embedded in the DESIGN.md frontmatter" />
      <div style={{marginBottom:14}}>
        <label>System Name</label>
        <input value={state.meta.name} onChange={e=>up('name',e.target.value)} placeholder="My Design System"/>
      </div>
      <div style={{marginBottom:14}}>
        <label>Description <span style={{color:'var(--dim)',fontWeight:400,textTransform:'none',letterSpacing:'normal',fontSize:11}}>(optional)</span></label>
        <textarea value={state.meta.description} onChange={e=>up('description',e.target.value)} placeholder="A brief description of this design system…" style={{minHeight:72}}/>
      </div>
      <div>
        <label>Spec version <span style={{color:'var(--dim)',fontWeight:400,textTransform:'none',letterSpacing:'normal',fontSize:11}}>(design.md format version, currently "alpha")</span></label>
        <input value={state.meta.version} onChange={e=>up('version',e.target.value)} placeholder="alpha" style={{maxWidth:180}}/>
      </div>
    </div>
  )
}

/* ─────────────────────────── Colors tab ─────────────────────────── */
function ColorPicker({value,onChange,compact=false}) {
  const valid=isHex(value)
  const rgb=valid?hex2rgb(value):null
  const hsl=valid?hex2hsl(value):null
  const safeHex=valid?value:'#000000'
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr',gap:12,alignItems:'end'}}>
        <div>
          <label>Swatch</label>
          <div style={{width:52,height:36,borderRadius:7,background:valid?value:'#555',border:'1px solid var(--bdr)',position:'relative',overflow:'hidden',cursor:'pointer',flexShrink:0}}>
            <input type="color" value={safeHex} onChange={e=>onChange(e.target.value)}
              style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer',border:'none',padding:0,background:'none'}}/>
          </div>
        </div>
        <div>
          <label>Hex</label>
          <input value={value} onChange={e=>onChange(e.target.value)} placeholder="#000000"
            style={{fontFamily:'var(--mono)',fontSize:13,background:valid?`${value}22`:'var(--surf3)',borderColor:valid?`${value}88`:'var(--bdr)'}}/>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {valid&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--success)',flexShrink:0}}/>}
          {!valid&&value&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--danger)',flexShrink:0}}/>}
          <span style={{fontSize:11,color:'var(--dim)',fontFamily:'var(--mono)'}}>{valid&&hsl?`hsl(${hsl[0]},${hsl[1]}%,${hsl[2]}%)`:''}</span>
        </div>
      </div>
      {rgb&&(
        <div style={{marginTop:10}}>
          <div style={{marginBottom:6,fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--dim)'}}>RGB channels</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[['R',0,'#e05e5e'],['G',1,'#5aae7a'],['B',2,'#5e9de0']].map(([lbl,i,col])=>(
              <div key={lbl}>
                <label style={{color:col}}>{lbl}</label>
                <input type="number" min={0} max={255} value={rgb[i]}
                  onChange={e=>{const n=[...rgb];n[i]=Math.max(0,Math.min(255,+e.target.value||0));onChange(rgb2hex(n[0],n[1],n[2]))}}
                  style={{fontFamily:'var(--mono)',fontSize:13}}/>
              </div>
            ))}
          </div>
        </div>
      )}
      {hsl&&(
        <div style={{marginTop:10}}>
          <div style={{marginBottom:6,fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--dim)'}}>HSL</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[['H°',0,360],['S%',1,100],['L%',2,100]].map(([lbl,i,max])=>(
              <div key={lbl}>
                <label>{lbl}</label>
                <input type="number" min={0} max={max} value={hsl[i]}
                  onChange={e=>{const n=[...hsl];n[i]=Math.max(0,Math.min(max,+e.target.value||0));onChange(hsl2hex(n[0],n[1],n[2]))}}
                  style={{fontFamily:'var(--mono)',fontSize:13}}/>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ColorRow({color,upd,del}) {
  const [open,setOpen]=useState(false)
  const valid=isHex(color.value)
  return (
    <div style={{background:'var(--surf)',border:`1px solid ${open?'rgba(220,140,70,.35)':'var(--bdr)'}`,borderRadius:9,overflow:'hidden',transition:'border-color .13s'}}>
      <div style={{display:'grid',gridTemplateColumns:'32px 1fr auto auto auto',gap:10,alignItems:'center',padding:'8px 12px',cursor:'pointer'}}
        onClick={()=>setOpen(o=>!o)}>
        <div style={{width:28,height:28,borderRadius:6,background:valid?color.value:'#555',border:'1px solid rgba(255,255,255,.07)',flexShrink:0}}/>
        <span style={{fontWeight:500,fontSize:14}}>{color.name||<em style={{color:'var(--dim)',fontStyle:'normal'}}>unnamed</em>}</span>
        <code style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--muted)',background:'var(--surf2)',padding:'2px 9px',borderRadius:4}}>{color.value}</code>
        <Chevron open={open}/>
        <DeleteBtn onClick={e=>{e.stopPropagation();del(color.id)}}/>
      </div>
      {open&&(
        <div style={{padding:'14px 16px',borderTop:'1px solid var(--bdr)',background:'var(--surf2)'}}>
          <div style={{marginBottom:10}}>
            <label>Token Name</label>
            <input value={color.name} onChange={e=>upd(color.id,'name',e.target.value)} placeholder="primary, accent…"/>
          </div>
          <ColorPicker value={color.value} onChange={v=>upd(color.id,'value',v)}/>
        </div>
      )}
    </div>
  )
}

function ColorsTab({state,setState}) {
  const [adding,setAdding]=useState(false)
  const [nc,setNc]=useState({name:'',value:'#4f6ef7'})
  const del=id=>setState(s=>({...s,colors:s.colors.filter(c=>c.id!==id)}))
  const upd=(id,k,v)=>setState(s=>({...s,colors:s.colors.map(c=>c.id===id?{...c,[k]:v}:c)}))
  const save=()=>{ if(!nc.name.trim()) return; setState(s=>({...s,colors:[...s.colors,{...nc,id:uid()}]})); setNc({name:'',value:'#4f6ef7'}); setAdding(false) }
  return (
    <div style={{maxWidth:660}}>
      <SectionHeader title="Colors" desc="Color tokens — hex values, with RGB & HSL editing" count={state.colors.length}/>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {!state.colors.length&&<Empty msg="No colors yet. Add your first color below."/>}
        {state.colors.map(c=><ColorRow key={c.id} color={c} upd={upd} del={del}/>)}
      </div>
      {adding ? (
        <div style={{marginTop:8,background:'var(--surf2)',border:'1px solid rgba(220,140,70,.3)',borderRadius:9,padding:16}}>
          <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--accent)',fontWeight:600,marginBottom:12}}>New Color Token</div>
          <div style={{marginBottom:12}}>
            <label>Token Name</label>
            <input value={nc.name} onChange={e=>setNc(n=>({...n,name:e.target.value}))} placeholder="primary, background, accent…" onKeyDown={e=>e.key==='Enter'&&save()}/>
          </div>
          <ColorPicker value={nc.value} onChange={v=>setNc(n=>({...n,value:v}))}/>
          <SaveCancelRow onSave={save} saveLabel="Add Color" onCancel={()=>{setAdding(false);setNc({name:'',value:'#4f6ef7'})}}/>
        </div>
      ) : <AddRowBtn label="Add Color" onClick={()=>setAdding(true)}/>}
    </div>
  )
}

/* ─────────────────────────── Typography tab ─────────────────────────── */
function TypFields({token,onChange}) {
  const fields=[
    {k:'name',      label:'Token Name',     ph:'h1, body-md, label…',   mono:false},
    {k:'fontFamily',label:'Font Family',    ph:'Georgia, Inter, Syne…', mono:true},
    {k:'fontSize',  label:'Font Size',      ph:'48px, 2rem…',           mono:true},
    {k:'fontWeight',label:'Font Weight',    ph:'400, 600, 700…',        mono:true},
    {k:'lineHeight',label:'Line Height',    ph:'1.5, 1.1…',             mono:true},
    {k:'letterSpacing',label:'Letter Spacing',ph:'-0.02em, 0.1em…',    mono:true},
    {k:'fontFeature',  label:'Font Feature',   ph:'"liga" 1, "tnum"…',     mono:true},
    {k:'fontVariation',label:'Font Variation', ph:'"wght" 400, "wdth" 100…', mono:true},
  ]
  const hasPrev=token.fontFamily||token.fontSize
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        {fields.map(f=>(
          <div key={f.k}>
            <label>{f.label}</label>
            <input value={token[f.k]||''} onChange={e=>onChange(f.k,e.target.value)} placeholder={f.ph}
              style={f.mono?{fontFamily:'var(--mono)',fontSize:12}:{}}/>
          </div>
        ))}
      </div>
      {hasPrev&&(
        <div style={{marginTop:12,padding:'12px 14px',background:'var(--surf3)',borderRadius:7,border:'1px solid var(--bdr)'}}>
          <div style={{fontSize:10,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--dim)',marginBottom:6}}>Live Preview</div>
          <div style={{
            fontFamily:token.fontFamily||'inherit',fontSize:token.fontSize||'inherit',
            fontWeight:token.fontWeight||'inherit',lineHeight:token.lineHeight||'inherit',
            letterSpacing:token.letterSpacing||'inherit',
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text)'
          }}>The quick brown fox jumps over the lazy dog</div>
        </div>
      )}
    </div>
  )
}
function TypRow({token,upd,del}) {
  const [open,setOpen]=useState(false)
  const preview=[token.fontFamily,token.fontSize,token.fontWeight].filter(Boolean).join(' · ')||'—'
  return (
    <div style={{background:'var(--surf)',border:`1px solid ${open?'rgba(220,140,70,.35)':'var(--bdr)'}`,borderRadius:9,overflow:'hidden',transition:'border-color .13s'}}>
      <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto auto',gap:10,alignItems:'center',padding:'9px 12px',cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <code style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:'var(--text)',background:'var(--surf3)',padding:'2px 8px',borderRadius:4}}>{token.name}</code>
        <span style={{fontSize:12,color:'var(--muted)',fontFamily:'var(--mono)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{preview}</span>
        {token.fontFamily&&<span style={{fontFamily:token.fontFamily,fontSize:13,color:'var(--text-dim)',fontWeight:token.fontWeight||'inherit'}}>Ag</span>}
        <Chevron open={open}/>
        <DeleteBtn onClick={e=>{e.stopPropagation();del(token.id)}}/>
      </div>
      {open&&(
        <div style={{padding:'14px 16px',borderTop:'1px solid var(--bdr)',background:'var(--surf2)'}}>
          <TypFields token={token} onChange={(k,v)=>upd(token.id,k,v)}/>
        </div>
      )}
    </div>
  )
}
function TypographyTab({state,setState}) {
  const [adding,setAdding]=useState(false)
  const [nt,setNt]=useState({name:'',fontFamily:'',fontSize:'',fontWeight:'',lineHeight:'',letterSpacing:'',fontFeature:'',fontVariation:''})
  const del=id=>setState(s=>({...s,typography:s.typography.filter(t=>t.id!==id)}))
  const upd=(id,k,v)=>setState(s=>({...s,typography:s.typography.map(t=>t.id===id?{...t,[k]:v}:t)}))
  const save=()=>{ if(!nt.name.trim()) return; setState(s=>({...s,typography:[...s.typography,{...nt,id:uid()}]})); setNt({name:'',fontFamily:'',fontSize:'',fontWeight:'',lineHeight:'',letterSpacing:'',fontFeature:'',fontVariation:''}); setAdding(false) }
  return (
    <div style={{maxWidth:760}}>
      <SectionHeader title="Typography" desc="Font tokens — family, size, weight, line height, letter spacing" count={state.typography.length}/>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {!state.typography.length&&<Empty msg="No typography tokens yet."/>}
        {state.typography.map(t=><TypRow key={t.id} token={t} upd={upd} del={del}/>)}
      </div>
      {adding?(
        <div style={{marginTop:8,background:'var(--surf2)',border:'1px solid rgba(220,140,70,.3)',borderRadius:9,padding:16}}>
          <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--accent)',fontWeight:600,marginBottom:12}}>New Typography Token</div>
          <TypFields token={nt} onChange={(k,v)=>setNt(t=>({...t,[k]:v}))}/>
          <SaveCancelRow onSave={save} saveLabel="Add Token" onCancel={()=>setAdding(false)}/>
        </div>
      ):<AddRowBtn label="Add Typography Token" onClick={()=>setAdding(true)}/>}
    </div>
  )
}

/* ─────────────────────────── Key-Value tab (Spacing + Radius) ─────────────────────────── */
function KVTab({section,title,desc,label,valuePh,state,setState}) {
  const [adding,setAdding]=useState(false)
  const [nn,setNn]=useState({name:'',value:''})
  const items=state[section]
  const del=id=>setState(s=>({...s,[section]:s[section].filter(x=>x.id!==id)}))
  const upd=(id,k,v)=>setState(s=>({...s,[section]:s[section].map(x=>x.id===id?{...x,[k]:v}:x)}))
  const save=()=>{ if(!nn.name.trim()) return; setState(s=>({...s,[section]:[...s[section],{...nn,id:uid()}]})); setNn({name:'',value:''}); setAdding(false) }
  return (
    <div style={{maxWidth:520}}>
      <SectionHeader title={title} desc={desc} count={items.length}/>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {!items.length&&<Empty msg={`No ${label.toLowerCase()} tokens yet.`}/>}
        {items.map(item=>(
          <div key={item.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,alignItems:'center',background:'var(--surf)',border:'1px solid var(--bdr)',borderRadius:8,padding:'7px 10px'}}>
            <input value={item.name} onChange={e=>upd(item.id,'name',e.target.value)} placeholder="name" style={{fontWeight:500}}/>
            <input value={item.value} onChange={e=>upd(item.id,'value',e.target.value)} placeholder={valuePh} style={{fontFamily:'var(--mono)',fontSize:13}}/>
            <DeleteBtn onClick={()=>del(item.id)}/>
          </div>
        ))}
      </div>
      {adding?(
        <div style={{marginTop:8,background:'var(--surf2)',border:'1px solid rgba(220,140,70,.3)',borderRadius:9,padding:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,alignItems:'end'}}>
            <div><label>Name</label><input value={nn.name} onChange={e=>setNn(n=>({...n,name:e.target.value}))} placeholder="sm, md, lg…" onKeyDown={e=>e.key==='Enter'&&save()}/></div>
            <div><label>Value</label><input value={nn.value} onChange={e=>setNn(n=>({...n,value:e.target.value}))} placeholder={valuePh} style={{fontFamily:'var(--mono)',fontSize:13}} onKeyDown={e=>e.key==='Enter'&&save()}/></div>
          </div>
          <SaveCancelRow onSave={save} saveLabel={`Add ${label}`} onCancel={()=>setAdding(false)}/>
        </div>
      ):<AddRowBtn label={`Add ${label}`} onClick={()=>setAdding(true)}/>}
    </div>
  )
}

/* ─────────────────────────── Components tab ─────────────────────────── */
function CompBlock({comp,onDel,onAddProp,onDelProp,onUpdProp}) {
  const [open,setOpen]=useState(true)
  return (
    <div style={{border:'1px solid var(--bdr)',borderRadius:10,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--surf2)',cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <code style={{flex:1,fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--text)'}}>{comp.name}</code>
        <span style={{fontSize:11,color:'var(--muted)',background:'var(--surf3)',padding:'1px 7px',borderRadius:8,border:'1px solid var(--bdr)'}}>{comp.properties.length} props</span>
        <Chevron open={open}/>
        <DeleteBtn onClick={e=>{e.stopPropagation();onDel(comp.id)}}/>
      </div>
      {open&&(
        <div style={{padding:14,background:'var(--surf)'}}>
          {!comp.properties.length&&<div style={{fontSize:12,color:'var(--dim)',padding:'4px 0 10px',textAlign:'center'}}>No properties yet.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {comp.properties.map(p=>(
              <div key={p.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,alignItems:'center'}}>
                <input value={p.key} onChange={e=>onUpdProp(comp.id,p.id,'key',e.target.value)} placeholder="property" style={{fontFamily:'var(--mono)',fontSize:12}}/>
                <input value={p.value} onChange={e=>onUpdProp(comp.id,p.id,'value',e.target.value)} placeholder="{colors.accent}" style={{fontFamily:'var(--mono)',fontSize:12}}/>
                <DeleteBtn onClick={()=>onDelProp(comp.id,p.id)}/>
              </div>
            ))}
          </div>
          <button onClick={()=>onAddProp(comp.id)}
            style={{marginTop:10,width:'100%',padding:'7px',background:'var(--surf2)',color:'var(--muted)',border:'1px dashed var(--bdr2)',borderRadius:6,cursor:'pointer',fontFamily:'var(--sans)',fontSize:12,transition:'all .13s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(220,140,70,.35)';e.currentTarget.style.color='var(--accent)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr2)';e.currentTarget.style.color='var(--muted)'}}
          >+ Add Property</button>
        </div>
      )}
    </div>
  )
}
function ComponentsTab({state,setState}) {
  const [adding,setAdding]=useState(false)
  const [nn,setNn]=useState({name:''})
  const delComp=id=>setState(s=>({...s,components:s.components.filter(c=>c.id!==id)}))
  const addComp=()=>{ if(!nn.name.trim()) return; setState(s=>({...s,components:[...s.components,{id:uid(),name:nn.name,properties:[]}]})); setNn({name:''}); setAdding(false) }
  const addProp=cid=>setState(s=>({...s,components:s.components.map(c=>c.id===cid?{...c,properties:[...c.properties,{id:uid(),key:'',value:''}]}:c)}))
  const delProp=(cid,pid)=>setState(s=>({...s,components:s.components.map(c=>c.id===cid?{...c,properties:c.properties.filter(p=>p.id!==pid)}:c)}))
  const updProp=(cid,pid,k,v)=>setState(s=>({...s,components:s.components.map(c=>c.id===cid?{...c,properties:c.properties.map(p=>p.id===pid?{...p,[k]:v}:p)}:c)}))
  return (
    <div style={{maxWidth:700}}>
      <SectionHeader title="Components" desc="Per-component token overrides referencing global tokens via {path.to.token}" count={state.components.length}/>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {!state.components.length&&<Empty msg="No component tokens yet. Add your first component below."/>}
        {state.components.map(c=><CompBlock key={c.id} comp={c} onDel={delComp} onAddProp={addProp} onDelProp={delProp} onUpdProp={updProp}/>)}
      </div>
      {adding?(
        <div style={{marginTop:8,background:'var(--surf2)',border:'1px solid rgba(220,140,70,.3)',borderRadius:9,padding:16}}>
          <label>Component Name</label>
          <input value={nn.name} onChange={e=>setNn({name:e.target.value})} placeholder="button-primary, card, nav-link…" onKeyDown={e=>e.key==='Enter'&&addComp()}/>
          <SaveCancelRow onSave={addComp} saveLabel="Add Component" onCancel={()=>setAdding(false)}/>
        </div>
      ):<AddRowBtn label="Add Component" onClick={()=>setAdding(true)}/>}
    </div>
  )
}

/* ─────────────────────────── Rationale tab ─────────────────────────── */
function RationaleTab({state,setState}) {
  const up=(k,v)=>setState(s=>({...s,prose:{...s.prose,[k]:v}}))
  const secs=[
    {k:'overview',  label:'Overview',         desc:'Brand personality, audience, and emotional tone'},
    {k:'colors',    label:'Colors',           desc:'Color philosophy, usage rules, and meaning'},
    {k:'typography',label:'Typography',       desc:'Font choice rationale and typographic hierarchy'},
    {k:'layout',    label:'Layout',           desc:'Grid, spacing strategy, and layout principles'},
    {k:'elevation', label:'Elevation & Depth',desc:'Shadow system, tonal layers, visual hierarchy'},
    {k:'shapes',    label:'Shapes',           desc:'Corner radii, geometry, shape language'},
    {k:'components',label:'Components',       desc:'Component-level design decisions and guidelines'},
    {k:'dosDonts',  label:`Do's and Don'ts`,  desc:'Things to avoid; explicit anti-patterns'},
  ]
  return (
    <div style={{maxWidth:700}}>
      <SectionHeader title="Design Rationale" desc="Markdown prose explaining the 'why' behind your tokens — this is what makes DESIGN.md special"/>
      <div style={{display:'flex',flexDirection:'column',gap:20}}>
        {secs.map(s=>(
          <div key={s.k}>
            <div style={{marginBottom:5,display:'flex',alignItems:'baseline',gap:8}}>
              <span style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{s.label}</span>
              <span style={{fontSize:12,color:'var(--muted)'}}>{s.desc}</span>
            </div>
            <textarea value={state.prose[s.k]} onChange={e=>up(s.k,e.target.value)}
              placeholder={`Explain your ${s.label.toLowerCase()} decisions here…`}
              style={{minHeight:88}}/>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── Preview modal ─────────────────────────── */
function PreviewModal({state,onClose}) {
  const content=generateFile(state)
  const [copied,setCopied]=useState(false)
  const copy=()=>{ navigator.clipboard.writeText(content).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)}) }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
      onClick={onClose}>
      <div style={{background:'var(--surf)',border:'1px solid var(--bdr)',borderRadius:12,width:'100%',maxWidth:680,maxHeight:'80vh',display:'flex',flexDirection:'column',overflow:'hidden'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid var(--bdr)',gap:10}}>
          <span style={{fontFamily:'var(--display)',fontWeight:700,fontSize:15,flex:1}}>DESIGN.md Preview</span>
          <button onClick={copy} className="btn-ghost" style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px'}}>
            <CopyIcon/>{copied?'Copied!':'Copy'}
          </button>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:18,padding:'2px 6px',lineHeight:1}}>×</button>
        </div>
        <pre style={{flex:1,overflow:'auto',padding:18,fontFamily:'var(--mono)',fontSize:12,lineHeight:1.7,color:'var(--text)',margin:0,background:'var(--bg)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{content}</pre>
      </div>
    </div>
  )
}

/* ─────────────────────────── Sync UI ─────────────────────────── */
function SyncBadge({status}) {
  const cfg = ({
    local:    {bg:'var(--surf2)',          fg:'var(--muted)',  txt:'Local only'},
    saving:   {bg:'var(--surf2)',          fg:'var(--accent)', txt:'Saving…'},
    saved:    {bg:'rgba(90,173,128,.13)',  fg:'var(--success)',txt:'Saved'},
    readonly: {bg:'var(--surf2)',          fg:'var(--muted)',  txt:'Read-only'},
    conflict: {bg:'rgba(222,92,92,.13)',   fg:'var(--danger)', txt:'Conflict'},
    error:    {bg:'rgba(222,92,92,.13)',   fg:'var(--danger)', txt:'Sync error'},
    offline:  {bg:'var(--surf2)',          fg:'var(--muted)',  txt:'Offline'},
  })[status] || {bg:'var(--surf2)',fg:'var(--muted)',txt:status}
  return <span style={{
    fontSize:11,fontFamily:'var(--mono)',background:cfg.bg,color:cfg.fg,
    padding:'4px 9px',borderRadius:5,border:'1px solid var(--bdr)',whiteSpace:'nowrap'
  }}>{cfg.txt}</span>
}

/* ─────────────────────────── Main App ─────────────────────────── */
export default function App() {
  const [state,setState]=useState(INIT)
  const [tab,setTab]=useState('colors')
  const [preview,setPreview]=useState(false)
  const [copied,setCopied]=useState(false)
  const [linkCopied,setLinkCopied]=useState(false)
  const [projectId,setProjectId]   = useState(null)
  const [editToken,setEditToken]   = useState(null)
  const [serverVersion,setSrvVer]  = useState(null)
  const [syncStatus,setSyncStatus] = useState('local')
  const isInitialSync = useRef(true)
  const fileRef=useRef()

  // Load /p/:id from URL on mount
  useEffect(() => {
    const m = window.location.pathname.match(/^\/p\/([^/]+)/)
    if (!m) return
    const id = m[1]
    const token = getStoredToken(id)
    setSyncStatus('saving')
    api.read(id).then(async r => {
      if (!r.ok) { setSyncStatus('local'); return }
      const data = await r.json()
      setState(data.state)
      setProjectId(id)
      setSrvVer(data.version)
      if (token) { setEditToken(token); setSyncStatus('saved') }
      else { setSyncStatus('readonly') }
    }).catch(() => setSyncStatus('offline'))
  }, [])

  // Debounced auto-save when project + editToken exist
  useEffect(() => {
    if (!projectId || !editToken) return
    if (syncStatus === 'readonly' || syncStatus === 'conflict') return
    if (isInitialSync.current) { isInitialSync.current = false; return }
    setSyncStatus('saving')
    const t = setTimeout(async () => {
      try {
        const r = await api.update(projectId, editToken, state, serverVersion)
        if (r.status === 409) { setSyncStatus('conflict'); return }
        if (!r.ok) { setSyncStatus('error'); return }
        const { version } = await r.json()
        setSrvVer(version)
        setSyncStatus('saved')
      } catch { setSyncStatus('offline') }
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, projectId, editToken])

  // Local draft load on mount (only when not opening a /p/:id link)
  useEffect(() => {
    if (window.location.pathname.startsWith('/p/')) return
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        const parsed = JSON.parse(draft)
        if (parsed && typeof parsed === 'object') setState(parsed)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Local draft autosave (debounced) — pauses when synced to a cloud project
  useEffect(() => {
    if (projectId) return
    if (window.location.pathname.startsWith('/p/')) return
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)) } catch {}
    }, 500)
    return () => clearTimeout(t)
  }, [state, projectId])

  const saveToCloud = async () => {
    if (projectId) return
    setSyncStatus('saving')
    try {
      const r = await api.create(state)
      if (!r.ok) throw new Error('Save failed')
      const { id, editToken: tk, version } = await r.json()
      isInitialSync.current = true
      setProjectId(id); setEditToken(tk); setSrvVer(version)
      setStoredToken(id, tk)
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      window.history.pushState({}, '', `/p/${id}`)
      setSyncStatus('saved')
    } catch {
      setSyncStatus('error')
      alert('Could not save to cloud. Is the API running on localhost:8787?')
    }
  }
  const copyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000)
  }
  const reloadFromServer = async () => {
    if (!projectId) return
    const r = await api.read(projectId)
    if (!r.ok) return
    const data = await r.json()
    isInitialSync.current = true
    setState(data.state); setSrvVer(data.version); setSyncStatus('saved')
  }

  const tabs=[
    {id:'meta',       label:'Meta'},
    {id:'colors',     label:'Colors'},
    {id:'typography', label:'Typography'},
    {id:'spacing',    label:'Spacing'},
    {id:'rounded',    label:'Radius'},
    {id:'components', label:'Components'},
    {id:'rationale',  label:'Rationale'},
  ]

  const download=()=>{
    const b=new Blob([generateFile(state)],{type:'text/markdown'})
    const u=URL.createObjectURL(b), a=document.createElement('a')
    a.href=u;a.download='DESIGN.md';a.click();URL.revokeObjectURL(u)
  }
  const copy=()=>{ navigator.clipboard.writeText(generateFile(state)).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200)}) }
  const importFile=e=>{
    const f=e.target.files[0]; if(!f) return
    const r=new FileReader()
    r.onload=ev=>{try{setState(parseFile(ev.target.result))}catch{alert('Could not parse this file as DESIGN.md')}}
    r.readAsText(f)
    e.target.value=''
  }

  const paletteColors=state.colors.filter(c=>isHex(c.value)).slice(0,8)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#0b0b0e;--surf:#131318;--surf2:#191920;--surf3:#20202a;
          --bdr:#24242e;--bdr2:#2e2e3a;
          --text:#e0dedd;--muted:#74727a;--dim:#3e3e4a;
          --text-dim:#c0bebb;
          --accent:#dc9055;--success:#5aad80;--danger:#de5c5c;
          --display:'Syne',sans-serif;--sans:'DM Sans',sans-serif;--mono:'JetBrains Mono',monospace;
        }
        body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.5;min-height:100vh}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:var(--bg)}
        ::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:3px}
        input,textarea{font-family:var(--sans);font-size:14px;color:var(--text);background:var(--surf3);border:1px solid var(--bdr);border-radius:6px;padding:8px 11px;outline:none;transition:border-color .13s,background .13s;width:100%}
        input:focus,textarea:focus{border-color:var(--accent);background:var(--surf2)}
        textarea{resize:vertical;min-height:90px}
        label{display:block;font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:5px}
        .btn-primary{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;border:none;border-radius:6px;padding:7px 15px;background:var(--accent);color:#0b0b0e;transition:filter .12s}
        .btn-primary:hover{filter:brightness(1.1)}
        .btn-ghost{font-family:var(--sans);font-size:13px;font-weight:400;cursor:pointer;border:1px solid var(--bdr);border-radius:6px;padding:7px 13px;background:transparent;color:var(--muted);transition:all .12s;display:inline-flex;align-items:center;gap:5px}
        .btn-ghost:hover{background:var(--surf2);color:var(--text);border-color:var(--bdr2)}
        .btn-add{margin-top:8px;width:100%;padding:10px;background:rgba(220,144,85,.07);color:var(--accent);border:1px dashed rgba(220,144,85,.28);border-radius:8px;cursor:pointer;font-size:13px;font-family:var(--sans);transition:background .13s}
        .btn-add:hover{background:rgba(220,144,85,.13)}
        .btn-delete{background:none;border:none;cursor:pointer;color:var(--dim);border-radius:4px;transition:color .1s;display:flex;align-items:center;justify-content:center}
        .btn-delete:hover{color:var(--danger)}
      `}</style>

      <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
        {/* ── Header ── */}
        <header style={{display:'flex',alignItems:'center',gap:14,padding:'0 20px',height:52,borderBottom:'1px solid var(--bdr)',background:'var(--surf)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:9,flex:1,overflow:'hidden',minWidth:0}}>
            <div style={{width:28,height:28,borderRadius:7,background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--display)',fontWeight:800,fontSize:13,color:'#0b0b0e',flexShrink:0}}>D</div>
            <span style={{fontFamily:'var(--display)',fontWeight:700,fontSize:15,letterSpacing:'-0.025em',whiteSpace:'nowrap'}}>
              design<span style={{color:'var(--muted)',fontWeight:400}}>.md</span>
            </span>
            <code style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)',background:'var(--surf2)',border:'1px solid var(--bdr)',padding:'2px 9px',borderRadius:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}}>{state.meta.name||'untitled'}</code>
            {/* Palette preview */}
            {paletteColors.length>0&&(
              <div style={{display:'flex',gap:3,alignItems:'center',marginLeft:4}}>
                {paletteColors.map(c=>(
                  <div key={c.id} title={`${c.name}: ${c.value}`} style={{width:13,height:13,borderRadius:3,background:c.value,border:'1px solid rgba(255,255,255,.07)',flexShrink:0}}/>
                ))}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:7,flexShrink:0,alignItems:'center'}}>
            <SyncBadge status={syncStatus}/>
            {syncStatus==='conflict' && (
              <button className="btn-ghost" onClick={reloadFromServer} style={{padding:'6px 10px',color:'var(--danger)',borderColor:'rgba(222,92,92,.4)'}}>Reload</button>
            )}
            {!projectId ? (
              <button className="btn-ghost" onClick={saveToCloud} style={{padding:'6px 12px'}}>☁ Save to cloud</button>
            ) : (
              <button className="btn-ghost" onClick={copyShareUrl} style={{padding:'6px 12px',color:linkCopied?'var(--success)':'var(--muted)',borderColor:linkCopied?'rgba(90,173,128,.4)':'var(--bdr)'}}>{linkCopied?'Link copied!':'Copy share URL'}</button>
            )}
            <input ref={fileRef} type="file" accept=".md,.txt" onChange={importFile} style={{display:'none'}}/>
            <button className="btn-ghost" onClick={()=>fileRef.current.click()} style={{padding:'6px 12px'}}><UploadIcon/>Import</button>
            <button className="btn-ghost" onClick={()=>setPreview(true)} style={{padding:'6px 12px'}}><CopyIcon/>Preview</button>
            <button className="btn-ghost" onClick={copy} style={{padding:'6px 12px',color:copied?'var(--success)':'var(--muted)',borderColor:copied?'rgba(90,173,128,.4)':'var(--bdr)'}}>{copied?'Copied!':'Copy YAML'}</button>
            <button className="btn-primary" onClick={download} style={{display:'inline-flex',alignItems:'center',gap:5}}><DownloadIcon/>Export .md</button>
          </div>
        </header>

        {/* ── Tabs ── */}
        <nav style={{display:'flex',padding:'0 20px',borderBottom:'1px solid var(--bdr)',background:'var(--surf)',flexShrink:0,overflowX:'auto'}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{
                background:'none',border:'none',borderRadius:0,cursor:'pointer',
                padding:'11px 14px',fontFamily:'var(--sans)',fontSize:13,whiteSpace:'nowrap',
                color:tab===t.id?'var(--text)':'var(--muted)',fontWeight:tab===t.id?500:400,
                borderBottom:tab===t.id?'2px solid var(--accent)':'2px solid transparent',
                transition:'all .12s',marginBottom:-1
              }}
            >{t.label}
              {t.id==='colors'&&state.colors.length>0&&<span style={{marginLeft:5,fontSize:10,color:'var(--dim)',fontFamily:'var(--mono)'}}>{state.colors.length}</span>}
              {t.id==='typography'&&state.typography.length>0&&<span style={{marginLeft:5,fontSize:10,color:'var(--dim)',fontFamily:'var(--mono)'}}>{state.typography.length}</span>}
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <main style={{flex:1,overflow:'auto',padding:'24px 24px 48px'}}>
          {tab==='meta'       && <MetaTab state={state} setState={setState}/>}
          {tab==='colors'     && <ColorsTab state={state} setState={setState}/>}
          {tab==='typography' && <TypographyTab state={state} setState={setState}/>}
          {tab==='spacing'    && <KVTab section="spacing"  title="Spacing"       desc="Spacing scale tokens for layout, padding, and margin"  label="Spacing Token" valuePh="8px, 1rem…"   state={state} setState={setState}/>}
          {tab==='rounded'    && <KVTab section="rounded"  title="Border Radius" desc="Corner radius scale tokens"                             label="Radius Token"  valuePh="4px, 0.5rem…" state={state} setState={setState}/>}
          {tab==='components' && <ComponentsTab state={state} setState={setState}/>}
          {tab==='rationale'  && <RationaleTab state={state} setState={setState}/>}
        </main>
      </div>

      {preview&&<PreviewModal state={state} onClose={()=>setPreview(false)}/>}
    </>
  )
}
