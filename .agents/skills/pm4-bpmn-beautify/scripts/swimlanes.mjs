import { route, placeLabel } from './routing.mjs';
const BPMN='http://www.omg.org/spec/BPMN/20100524/MODEL';
const kids=n=>Array.from(n.childNodes || []).filter(c=>c.nodeType===1 && c.namespaceURI===BPMN);
const key=n=>n.getAttribute('id');
const attr=(n,k)=>n.getAttribute(k);

export function lanePlan(scope, nodes) {
  const roots=[], lanes=[], memberships=new Map(), byNode=new Map(nodes.map(n=>[key(n),n]));
  const sets=kids(scope).filter(n=>n.localName==='laneSet');
  if (sets.length>1) throw new Error(`Multiple alternative laneSets in ${key(scope)} are ambiguous; use --layout preserve.`);
  function visit(lane,parent,depth) {
    if (!key(lane)) throw new Error('Lane requires an id.');
    const record={id:key(lane),parent,depth,children:[],members:[]}; lanes.push(record);
    for (const r of kids(lane).filter(n=>n.localName==='flowNodeRef')) {
      const value=r.textContent.trim();
      if (!byNode.has(value)) throw new Error(`Lane ${key(lane)} references unknown or cross-scope node ${value}.`);
      if (!memberships.has(value)) memberships.set(value,[]);
      memberships.get(value).push(record);
    }
    for (const set of kids(lane).filter(n=>n.localName==='childLaneSet')) for (const child of kids(set).filter(n=>n.localName==='lane')) record.children.push(visit(child,record,depth+1));
    return record;
  }
  for (const set of sets) for (const lane of kids(set).filter(n=>n.localName==='lane')) roots.push(visit(lane,null,1));
  const owners=new Map();
  const ancestor=(a,b)=>{for(let p=b;p;p=p.parent) if(p===a)return true; return false;};
  for (const [node, refs] of memberships) {
    const deepest=[...refs].sort((a,b)=>b.depth-a.depth)[0];
    if (refs.some(r=>!ancestor(r,deepest))) throw new Error(`Node ${node} belongs to incompatible lanes.`);
    owners.set(node,deepest);
  }
  for (const node of nodes.filter(n=>n.localName==='boundaryEvent')) {
    const host=owners.get(attr(node,'attachedToRef')), assigned=owners.get(key(node));
    if (assigned && assigned!==host) throw new Error(`Boundary event ${key(node)} must share its host's deepest lane.`);
    if(host)owners.set(key(node),host);
  }
  for (const node of nodes.filter(n=>n.localName!=='boundaryEvent')) owners.get(key(node))?.members.push(key(node));
  return {roots,lanes,owners};
}

// ELK decides ranks. Repack only the cross axis into semantic swimlane bands,
// then route again: moving nodes without rerouting their edges is incorrect.
export function arrangeLanes(graph, plan, direction, spacing) {
  if (!plan.roots.length) return graph;
  const horizontal=direction==='LR', main=horizontal?'x':'y', cross=horizontal?'y':'x', mainSize=horizontal?'width':'height', crossSize=horizontal?'height':'width';
  const maxDepth=Math.max(...plan.lanes.map(l=>l.depth)), header=32, pad=spacing;
  const index=new Map(graph.children.map(n=>[n.id,n]));
  // Reserve header columns/rows outside all nodes and labels.
  for(const n of graph.children)n[main]+=maxDepth*header+pad;
  let cursor=pad;
  function occupied(n) {
    const boxes=[{x:0,y:0,width:n.width,height:n.height},...(n.labels||[]),...(n.ports||[]).flatMap(p=>[p,...(p.labelText?[{x:p.x+44,y:p.y+40,width:116,height:Math.ceil(p.labelText.length/16)*16}]:[])])];
    return {min:Math.min(...boxes.map(b=>b[cross])), max:Math.max(...boxes.map(b=>b[cross]+b[crossSize]))};
  }
  function band(ids) {
    const nodes=ids.map(k=>index.get(k)).filter(Boolean);
    const min=nodes.length?Math.min(...nodes.map(n=>n[cross]+occupied(n).min)):0;
    const max=nodes.length?Math.max(...nodes.map(n=>n[cross]+occupied(n).max)):0;
    const start=cursor;
    for(const n of nodes)n[cross]+=cursor+pad-min;
    cursor+=Math.max(130,max-min+2*pad);
    return start;
  }
  function visit(lane) {
    const start=cursor;
    if(lane.members.length || !lane.children.length)band(lane.members);
    lane.children.forEach(visit);
    lane.start=start;lane.extent=cursor-start;
  }
  plan.roots.forEach(visit);
  const unassigned=graph.children.filter(n=>!plan.owners.has(n.id)).map(n=>n.id);
  if(unassigned.length)band(unassigned);
  const mainExtent=Math.max(300,...graph.children.map(n=>n[main]+n[mainSize]+pad+60));
  graph[mainSize]=mainExtent+pad;graph[crossSize]=cursor+pad;
  graph.lanes=plan.lanes.map(l=>({id:l.id,[main]:pad+(l.depth-1)*header,[cross]:l.start,[mainSize]:mainExtent-pad-(l.depth-1)*header,[crossSize]:l.extent}));
  const boxes=new Map();
  for(const n of graph.children){boxes.set(n.id,{id:n.id,x:n.x,y:n.y,width:n.width,height:n.height}); for(const p of n.ports||[])boxes.set(p.id,{id:p.id,x:n.x+p.x,y:n.y+p.y,width:p.width,height:p.height,host:n.id});}
  const labels=graph.children.flatMap(n=>(n.labels||[]).map(l=>({...l,x:n.x+l.x,y:n.y+l.y})));
  labels.push(...graph.children.flatMap(n=>(n.ports||[]).filter(p=>p.labelText).map(p=>({x:n.x+p.x+44,y:n.y+p.y+40,width:116,height:Math.ceil(p.labelText.length/16)*16}))));
  const headers=graph.lanes.map(l=>({...l,[mainSize]:header}));
  const previous=[],placed=[];
  const bounds={x:pad+maxDepth*header+8,y:8,width:graph.width-pad-maxDepth*header-16,height:graph.height-16};
  if(!horizontal)Object.assign(bounds,{x:8,y:pad+maxDepth*header+8,width:graph.width-16,height:graph.height-pad-maxDepth*header-16});
  for(const e of graph.edges){
    const source=boxes.get(e.sources[0]),target=boxes.get(e.targets[0]);
    const obstacles=[...boxes.values(),...labels,...headers];
    const points=route(source,target,obstacles,bounds,{direction,previous,self:source===target,sourceSides:source.host?['S']:undefined});
    e.sections=[{startPoint:points[0],bendPoints:points.slice(1,-1),endPoint:points.at(-1)}];
    e.labels=(e.labels||[]).map(l=>{const placedLabel=placeLabel(l,points,obstacles,placed,bounds);placed.push(placedLabel);return placedLabel;});
    previous.push(points);
  }
  return graph;
}

export function collaborationPlan(doc, processes) {
  const collaborations=kids(doc.documentElement).filter(n=>n.localName==='collaboration');
  if(collaborations.length>1)throw new Error('Full layout supports one collaboration per document.');
  const collaboration=collaborations[0];
  if(!collaboration){if(processes.length!==1)throw new Error('Multiple processes require a collaboration with explicit participants.');return {root:processes[0],participants:[],messages:[],owner:new Map()};}
  if(!key(collaboration))throw new Error('Collaboration requires an id.');
  const participants=kids(collaboration).filter(n=>n.localName==='participant');
  if(!participants.length)throw new Error('Collaboration requires participants.');
  const byProcess=new Map(processes.map(p=>[key(p),p])),owner=new Map();
  for(const participant of participants){
    if(!key(participant))throw new Error('Participant requires an id.');
    const processRef=attr(participant,'processRef');
    if(processRef){
      if(!byProcess.has(processRef))throw new Error(`Unresolved participant processRef: ${processRef}`);
      if(owner.has(processRef))throw new Error(`Process ${processRef} belongs to multiple participants; use --layout preserve.`);
      owner.set(processRef,participant);
    }
  }
  if(processes.some(p=>!owner.has(key(p))))throw new Error('Every process must belong to a participant; refusing to drop unreferenced processes.');
  const model=new Map(Array.from(doc.getElementsByTagNameNS(BPMN,'*')).filter(n=>key(n)).map(n=>[key(n),n]));
  function pool(node){if(node?.localName==='participant')return participants.includes(node)?node:null;for(let p=node;p?.nodeType===1;p=p.parentNode)if(p.localName==='process')return owner.get(key(p));return null;}
  const messages=kids(collaboration).filter(n=>n.localName==='messageFlow');
  for(const m of messages){
    if(!key(m))throw new Error('Message flow requires an id.');
    const a=model.get(attr(m,'sourceRef')),b=model.get(attr(m,'targetRef'));
    const interaction=n=>n && (n.localName==='participant'||/Task$|^task$|Event$|Activity$|Process$|^transaction$/.test(n.localName));
    if(!interaction(a)||!interaction(b)||!pool(a)||!pool(b)||pool(a)===pool(b))throw new Error(`Invalid message flow ${key(m)}: endpoints must belong to different participants.`);
  }
  return {root:collaboration,participants,messages,owner,pool,model};
}
