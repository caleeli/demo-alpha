import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import ELK from 'elkjs/lib/elk.bundled.js';
import { lanePlan, arrangeLanes, collaborationPlan } from './swimlanes.mjs';
import { route, placeLabel, encloses } from './routing.mjs';

export const NS = {
  bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
  bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
  dc: 'http://www.omg.org/spec/DD/20100524/DC',
  di: 'http://www.omg.org/spec/DD/20100524/DI',
  bioc: 'http://bpmn.io/schema/bpmn/biocolor/1.0',
  color: 'http://www.omg.org/spec/BPMN/non-normative/color/1.0',
};
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const serializer = new XMLSerializer();
const children = n => Array.from(n.childNodes || []).filter(c => c.nodeType === 1);
const all = (n, ns, name) => Array.from(n.getElementsByTagNameNS(ns, name));
const id = n => n.getAttribute('id');
const ref = (n, attr) => n.getAttribute(attr);
const subTypes = new Set(['subProcess', 'adHocSubProcess', 'transaction']);
const nodeTypes = new Set(['task', 'userTask', 'manualTask', 'serviceTask', 'scriptTask',
  'sendTask', 'receiveTask', 'businessRuleTask', 'callActivity', ...subTypes,
  'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
  'exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway', 'complexGateway']);
const flowNodes = n => children(n).filter(c => c.namespaceURI === NS.bpmn && nodeTypes.has(c.localName));
const flows = n => children(n).filter(c => c.namespaceURI === NS.bpmn && c.localName === 'sequenceFlow');

// Muted fills, dark outlines: color reinforces notation rather than replacing it.
export const themes = {
  professional: { task: ['#EFF6FF', '#334E68'], automation: ['#F0FDFA', '#0F766E'],
    phase: ['#EEF2FF', '#4338CA'], gateway: ['#FFFBEB', '#92400E'],
    start: ['#ECFDF5', '#166534'], end: ['#FFF1F2', '#9F1239'],
    event: ['#F8FAFC', '#475569'], container: ['#F8FAFC', '#64748B'], edge: '#475569' },
  monochrome: { task: ['#FFFFFF', '#334155'], automation: ['#F1F5F9', '#334155'],
    phase: ['#E2E8F0', '#1E293B'], gateway: ['#F8FAFC', '#334155'],
    start: ['#FFFFFF', '#334155'], end: ['#E2E8F0', '#0F172A'],
    event: ['#FFFFFF', '#475569'], container: ['#F8FAFC', '#64748B'], edge: '#475569' },
};

export function parse(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD/entities are not supported.');
  const errors = [];
  const doc = new DOMParser({ onError: (level, message) => errors.push(`${level}: ${message}`) })
    .parseFromString(xml, 'application/xml');
  if (errors.length) throw new Error(`Invalid XML: ${errors.join('; ')}`);
  if (doc.documentElement.namespaceURI !== NS.bpmn || doc.documentElement.localName !== 'definitions') {
    throw new Error('Expected BPMN 2.0 definitions XML (extract the bpmn field from JSON first).');
  }
  const ids = new Set();
  for (const n of all(doc, '*', '*')) {
    if (!id(n)) continue;
    if (ids.has(id(n))) throw new Error(`Duplicate XML id: ${id(n)}`);
    ids.add(id(n));
  }
  return doc;
}

// Compare the actual DOM, excluding DI and namespace declarations. Unknown extensions,
// comments, CDATA, conditions and PM attributes remain part of this invariant.
export function semantics(doc) {
  function walk(n) {
    if (n.nodeType === 1) {
      if (n.namespaceURI === NS.bpmndi) return null;
      return [n.namespaceURI, n.localName,
        Array.from(n.attributes).filter(a => a.namespaceURI !== XMLNS)
          .map(a => [a.namespaceURI, a.localName, a.value]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        Array.from(n.childNodes).map(walk).filter(v => v !== null)];
    }
    if (n.nodeType === 3 && !n.data.trim()) return null;
    return [n.nodeType, n.nodeValue];
  }
  return JSON.stringify(walk(doc.documentElement));
}

function rect(n) {
  const b = all(n, NS.dc, 'Bounds')[0];
  if (!b) return null;
  const r = Object.fromEntries(['x', 'y', 'width', 'height'].map(k => [k, b.hasAttribute(k) ? Number(b.getAttribute(k)) : NaN]));
  return Object.values(r).every(Number.isFinite) && r.width > 0 && r.height > 0 ? r : null;
}
function overlap(a, b) {
  return a.x < b.x + b.width - 0.1 && a.x + a.width > b.x + 0.1 &&
    a.y < b.y + b.height - 0.1 && a.y + a.height > b.y + 0.1;
}
function modelIndex(doc) {
  return new Map(all(doc, NS.bpmn, '*').filter(n => id(n)).map(n => [id(n), n]));
}
function hidden(n, collapsed) {
  for (let p = n?.parentNode; p?.nodeType === 1; p = p.parentNode) {
    if (collapsed.has(id(p))) return true;
  }
  return false;
}
function contains(a, b) {
  for (let p = b?.parentNode; p?.nodeType === 1; p = p.parentNode) if (p === a) return true;
  return false;
}

export function inspect(doc) {
  const model = modelIndex(doc);
  const shapes = all(doc, NS.bpmndi, 'BPMNShape');
  const collapsed = new Set(shapes.filter(s => subTypes.has(model.get(ref(s, 'bpmnElement'))?.localName) &&
    ref(s, 'isExpanded') !== 'true').map(s => ref(s, 'bpmnElement')));
  const visible = shapes.filter(s => !hidden(model.get(ref(s, 'bpmnElement')), collapsed));
  const issues = [];
  const containerOf = (a,b) => {
    if (!a || !b) return false;
    if (a.localName==='lane' && b.localName==='boundaryEvent') return containerOf(a,model.get(ref(b,'attachedToRef')));
    if (a.localName === 'participant') { const process = model.get(ref(a,'processRef')); return process && (b === process || contains(process,b)); }
    if (a.localName === 'lane') return contains(a,b) || all(a,NS.bpmn,'flowNodeRef').some(r=> {const node=model.get(r.textContent.trim());return node===b || contains(node,b);});
    return contains(a,b);
  };
  const bounds = visible.map(s => ({ id: ref(s, 'bpmnElement'), box: rect(s) }));
  for (const a of bounds) if (!a.box) issues.push({ code: 'invalid-bounds', element: a.id });
  for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
    const a = bounds[i], b = bounds[j], ma = model.get(a.id), mb = model.get(b.id);
    // Containment follows processRef/flowNodeRef as well as XML nesting.
    if (a.box && b.box) {
      if (containerOf(ma,mb) && !encloses(a.box,b.box)) issues.push({code:'outside-container',element:b.id,container:a.id});
      if (containerOf(mb,ma) && !encloses(b.box,a.box)) issues.push({code:'outside-container',element:a.id,container:b.id});
    }
    if (containerOf(ma,mb) || containerOf(mb,ma) ||
      ref(ma || doc.documentElement, 'attachedToRef') === b.id || ref(mb || doc.documentElement, 'attachedToRef') === a.id) continue;
    if (a.box && b.box && overlap(a.box, b.box)) issues.push({ code: 'shape-overlap', elements: [a.id, b.id] });
  }
  const shapeIds = new Set(shapes.map(s => ref(s, 'bpmnElement')));
  for (const [key, n] of model) if ([...nodeTypes, 'lane', 'participant'].includes(n.localName) && !hidden(n, collapsed) && !shapeIds.has(key)) {
    issues.push({ code: 'missing-shape', element: key });
  }
  const edges = all(doc, NS.bpmndi, 'BPMNEdge');
  const edgeIds = new Set(edges.map(e => ref(e, 'bpmnElement')));
  let bends = 0, length = 0;
  for (const [key, n] of model) if (['sequenceFlow', 'messageFlow'].includes(n.localName) && !hidden(n, collapsed) && !edgeIds.has(key)) {
    issues.push({ code: 'missing-edge', element: key });
  }
  for (const e of edges) {
    if (hidden(model.get(ref(e, 'bpmnElement')), collapsed)) continue;
    const points = all(e, NS.di, 'waypoint').map(p => ({ x: p.hasAttribute('x') ? Number(ref(p, 'x')) : NaN,
      y: p.hasAttribute('y') ? Number(ref(p, 'y')) : NaN }));
    if (points.length < 2 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      issues.push({ code: 'invalid-waypoints', element: ref(e, 'bpmnElement') }); continue;
    }
    bends += Math.max(0, points.length - 2);
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const boxes = bounds.map(s => s.box).filter(Boolean);
  const width = boxes.length ? Math.max(...boxes.map(b => b.x + b.width)) - Math.min(...boxes.map(b => b.x)) : 0;
  const height = boxes.length ? Math.max(...boxes.map(b => b.y + b.height)) - Math.min(...boxes.map(b => b.y)) : 0;
  return { visibleShapes: visible.length, collapsedSubprocesses: collapsed.size, width, height,
    area: Math.round(width * height), bends, edgeLength: Math.round(length), issues };
}

function size(n) {
  if (n.localName.endsWith('Event')) return { width: 36, height: 36 };
  if (n.localName.endsWith('Gateway')) return { width: 50, height: 50 };
  const length = Array.from(ref(n, 'name') || '').length;
  const width = Math.max(150, Math.min(240, Math.ceil(Math.sqrt(length * 140) / 10) * 10));
  return { width, height: Math.max(80, Math.ceil(length * 7 / (width - 28)) * 18 + 30) };
}
function category(n) {
  const t = n?.localName || '';
  if (subTypes.has(t) || t === 'callActivity') return 'phase';
  if (t.endsWith('Gateway')) return 'gateway';
  if (t === 'startEvent') return 'start';
  if (t === 'endEvent') return 'end';
  if (t.endsWith('Event')) return 'event';
  if (['serviceTask', 'scriptTask', 'businessRuleTask', 'sendTask', 'receiveTask'].includes(t)) return 'automation';
  if (['participant', 'lane'].includes(t)) return 'container';
  return 'task';
}

function namespaces(doc) {
  const prefixes = {};
  for (const [preferred, uri] of Object.entries(NS)) {
    let p = preferred, i = 1;
    while (doc.documentElement.lookupNamespaceURI(p) && doc.documentElement.lookupNamespaceURI(p) !== uri) p = `${preferred}${i++}`;
    doc.documentElement.setAttributeNS(XMLNS, `xmlns:${p}`, uri);
    prefixes[preferred] = p;
  }
  return prefixes;
}
function factory(doc, prefixes) {
  return (ns, name, attrs = {}, parent) => {
    const el = doc.createElementNS(NS[ns], `${prefixes[ns]}:${name}`);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    if (parent) parent.appendChild(el);
    return el;
  };
}
function paint(doc, theme, prefixes) {
  if (theme === 'preserve') return;
  const palette = themes[theme], model = modelIndex(doc);
  for (const s of all(doc, NS.bpmndi, 'BPMNShape')) {
    const [fill, stroke] = palette[category(model.get(ref(s, 'bpmnElement')))];
    s.setAttributeNS(NS.bioc, `${prefixes.bioc}:fill`, fill);
    s.setAttributeNS(NS.bioc, `${prefixes.bioc}:stroke`, stroke);
    s.setAttributeNS(NS.color, `${prefixes.color}:background-color`, fill);
    s.setAttributeNS(NS.color, `${prefixes.color}:border-color`, stroke);
  }
  for (const e of all(doc, NS.bpmndi, 'BPMNEdge')) {
    e.setAttributeNS(NS.bioc, `${prefixes.bioc}:stroke`, palette.edge);
    e.setAttributeNS(NS.color, `${prefixes.color}:border-color`, palette.edge);
  }
}

function validateLayout(doc) {
  const unsupported = all(doc, NS.bpmn, '*').filter(n => ['dataObjectReference', 'dataStoreReference', 'textAnnotation', 'association', 'group',
    'choreography', 'conversation'].includes(n.localName));
  if (unsupported.length) throw new Error(`Full layout does not yet support ${[...new Set(unsupported.map(n => n.localName))].join(', ')}. Use --layout preserve to retain their DI and apply colors only.`);
  const processes = children(doc.documentElement).filter(n => n.namespaceURI === NS.bpmn && n.localName === 'process');
  const collaboration = collaborationPlan(doc, processes);
  const model = modelIndex(doc);
  for (const n of all(doc, NS.bpmn, '*')) {
    if ((nodeTypes.has(n.localName) || n.localName === 'sequenceFlow') && !id(n)) throw new Error(`Missing id on ${n.localName}`);
    if (n.localName === 'sequenceFlow') {
      const source = model.get(ref(n, 'sourceRef')), target = model.get(ref(n, 'targetRef'));
      if (!source || !target || !nodeTypes.has(source.localName) || !nodeTypes.has(target.localName) ||
        source.parentNode !== n.parentNode || target.parentNode !== n.parentNode || target.localName === 'boundaryEvent') {
        throw new Error(`Invalid or cross-scope sequence flow: ${id(n)}`);
      }
    }
    if (n.localName === 'boundaryEvent') {
      const host = model.get(ref(n, 'attachedToRef'));
      if (!host || host.parentNode !== n.parentNode || !/(Task|task|Activity|Process|transaction)$/.test(host.localName)) {
        throw new Error(`Invalid boundary attachment: ${id(n)}`);
      }
    }
  }
  // Never silently discard a diagram element for a construct this adapter cannot lay out.
  for (const s of all(doc, NS.bpmndi, 'BPMNShape')) {
    if (![...nodeTypes, 'lane', 'participant'].includes(model.get(ref(s, 'bpmnElement'))?.localName)) throw new Error(`Unsupported DI shape ${ref(s, 'bpmnElement')}; use --layout preserve.`);
  }
  for (const e of all(doc, NS.bpmndi, 'BPMNEdge')) {
    if (!['sequenceFlow', 'messageFlow'].includes(model.get(ref(e, 'bpmnElement'))?.localName)) throw new Error(`Unsupported DI edge ${ref(e, 'bpmnElement')}; use --layout preserve.`);
  }
  if (processes.some(p => !id(p))) throw new Error('Process requires an id.');
  return { processes, collaboration };
}

async function layout(doc, options, prefixes, warnings) {
  const { processes, collaboration } = validateLayout(doc), elk = new ELK();
  const mustExpand = new Set();
  for (const message of collaboration.messages) for (const endpoint of ['sourceRef', 'targetRef']) {
    for (let p = collaboration.model.get(ref(message, endpoint))?.parentNode; p?.nodeType === 1; p = p.parentNode) {
      if (subTypes.has(p.localName)) mustExpand.add(id(p));
    }
  }
  if (mustExpand.size) warnings.push(`Kept subprocesses expanded to expose message endpoints: ${[...mustExpand].join(', ')}.`);
  const oldShapes = new Map(all(doc, NS.bpmndi, 'BPMNShape').map(s => [ref(s, 'bpmnElement'), s]));
  const oldEdges = new Map(all(doc, NS.bpmndi, 'BPMNEdge').map(e => [ref(e, 'bpmnElement'), e]));
  const expanded = n => mustExpand.has(id(n)) || options.subprocesses === 'expanded' || (options.subprocesses === 'preserve' && ref(oldShapes.get(id(n)) || n, 'isExpanded') === 'true');
  const spacing = options.spacing === 'compact' ? 40 : 70;
  const layouts = new Map();
  async function scope(parent) {
    const nodes = flowNodes(parent), lanes = lanePlan(parent, nodes), ordinary = nodes.filter(n => n.localName !== 'boundaryEvent');
    for (const n of ordinary.filter(n => subTypes.has(n.localName))) await scope(n);
    const graph = { id: id(parent), layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': options.direction === 'TB' ? 'DOWN' : 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL', 'elk.randomSeed': '1',
      'elk.spacing.nodeNode': String(spacing), 'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing + 30),
      'elk.padding': '[top=50,left=40,bottom=50,right=40]',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    }, children: ordinary.map(n => {
      const detail = layouts.get(id(n));
      const dimensions = detail && expanded(n) ? { width: Math.max(180, detail.width), height: Math.max(120, detail.height) } : size(n);
      const boundaries = nodes.filter(b => b.localName === 'boundaryEvent' && ref(b, 'attachedToRef') === id(n));
      return { id: id(n), ...dimensions,
        layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
        ports: boundaries.map(b => ({ id: id(b), width: 36, height: 36,
          labelText: ref(b,'name'),
          layoutOptions: { 'elk.port.side': 'SOUTH', 'elk.port.borderOffset': '-18' } })),
        labels: n.localName.endsWith('Event') || n.localName.endsWith('Gateway') ? externalLabel(n) : [] };
    }), edges: flows(parent).map(f => ({ id: id(f), sources: [ref(f, 'sourceRef')], targets: [ref(f, 'targetRef')],
      labels: ref(f, 'name') ? [{ id: `${id(f)}_label`, text: ref(f, 'name'), width: Math.min(240, Math.max(40, ref(f, 'name').length * 7)),
        height: Math.ceil(ref(f, 'name').length * 7 / 240) * 16, layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' } }] : [] })) };
    const result = await elk.layout(graph);
    layouts.set(id(parent), arrangeLanes(result, lanes, options.direction, spacing));
    const unassigned = ordinary.filter(n => !lanes.owners.has(id(n)));
    if (lanes.roots.length && unassigned.length) warnings.push(`Unassigned nodes in ${id(parent)} use an unlabelled band; lane membership was not invented: ${unassigned.map(id).join(', ')}.`);
  }
  function externalLabel(n) {
    const name = ref(n, 'name');
    return name ? [{ text: name, width: Math.min(200, Math.max(40, name.length * 7)), height: Math.ceil(name.length * 7 / 200) * 16,
      layoutOptions: { 'elk.nodeLabels.placement': '[H_CENTER, V_BOTTOM, OUTSIDE]' } }] : [];
  }
  for (const process of processes) await scope(process);
  const create = factory(doc, prefixes);
  for (const diagram of all(doc, NS.bpmndi, 'BPMNDiagram')) diagram.parentNode.removeChild(diagram);
  const ids = new Set([...all(doc, '*', '*'), ...oldShapes.values(), ...oldEdges.values()].map(id).filter(Boolean));
  function fresh(base) { let value = base, i = 1; while (ids.has(value)) value = `${base}_${i++}`; ids.add(value); return value; }
  const diagram = create('bpmndi', 'BPMNDiagram', { id: fresh('BeautifyDiagram') }, doc.documentElement);
  const plane = create('bpmndi', 'BPMNPlane', { id: fresh('BeautifyPlane'), bpmnElement: id(collaboration.root) }, diagram);
  const absoluteBoxes = new Map(), absoluteLabels = [];
  function label(parent, box, ox, oy) {
    const l = create('bpmndi', 'BPMNLabel', {}, parent);
    const bounds = { x: ox + box.x, y: oy + box.y, width: box.width, height: box.height };
    create('dc', 'Bounds', bounds, l); absoluteLabels.push({ ...bounds, owner: ref(parent,'bpmnElement') });
  }
  function shape(key, box, attributes = {}) {
    // Clone DI so renderer-specific visual attributes survive; replace only geometry/labels.
    const s = oldShapes.has(key) ? oldShapes.get(key).cloneNode(true) : create('bpmndi', 'BPMNShape', { id: fresh(`${key}_di`), bpmnElement: key });
    for (const c of children(s)) if ([NS.dc, NS.bpmndi].includes(c.namespaceURI)) s.removeChild(c);
    for (const [k, v] of Object.entries(attributes)) s.setAttribute(k, String(v));
    create('dc', 'Bounds', box, s); plane.appendChild(s); absoluteBoxes.set(key, { ...box, id: key }); return s;
  }
  function emit(parent, ox, oy) {
    const graph = layouts.get(id(parent)), model = new Map(flowNodes(parent).map(n => [id(n), n]));
    const boxes = new Map();
    for (const lane of graph.lanes || []) shape(lane.id, { x: ox + lane.x, y: oy + lane.y, width: lane.width, height: lane.height }, { isHorizontal: options.direction === 'LR' });
    for (const n of graph.children) {
      const original = model.get(n.id), isSub = subTypes.has(original.localName);
      boxes.set(n.id, { x: n.x, y: n.y, width: n.width, height: n.height });
      const s = shape(n.id, { x: ox + n.x, y: oy + n.y, width: n.width, height: n.height }, isSub ? { isExpanded: expanded(original) } : {});
      for (const l of n.labels || []) label(s, l, ox + n.x, oy + n.y);
      for (const p of n.ports || []) {
        boxes.set(p.id, { x: n.x + p.x, y: n.y + p.y, width: 36, height: 36 });
        const b = shape(p.id, { x: ox + n.x + p.x, y: oy + n.y + p.y, width: 36, height: 36 });
        const name = ref(model.get(p.id), 'name');
        if (name) label(b, { x: 44, y: 40, width: 116, height: Math.ceil(name.length / 16) * 16 }, ox + n.x + p.x, oy + n.y + p.y);
      }
      // Keep child DI on the same plane for PM4's single-diagram contract. Descendants
      // remain present even when their ancestor is collapsed (hidden by the renderer).
      if (isSub) emit(original, ox + n.x, oy + n.y);
    }
    for (const e of graph.edges) {
      if (e.sections?.length !== 1) throw new Error(`Cannot serialize route ${e.id}: expected one ELK section.`);
      const edge = oldEdges.has(e.id) ? oldEdges.get(e.id).cloneNode(true) : create('bpmndi', 'BPMNEdge', { id: fresh(`${e.id}_di`), bpmnElement: e.id });
      for (const c of children(edge)) if ([NS.di, NS.bpmndi].includes(c.namespaceURI)) edge.removeChild(c);
      const section = e.sections[0];
      // ELK routes rectangles. Dock to BPMN circles/diamonds along the same axis
      // so gateway branches do not float outside their actual outline.
      function dock(point, key) {
        const b = boxes.get(key), type = model.get(key)?.localName;
        if (!b || !(type.endsWith('Event') || type.endsWith('Gateway'))) return point;
        const cx = b.x + b.width / 2, cy = b.y + b.height / 2, rx = b.width / 2, ry = b.height / 2;
        const factor = t => type.endsWith('Gateway') ? 1 - Math.min(1, Math.abs(t)) : Math.sqrt(Math.max(0, 1 - t * t));
        if (Math.abs(point.x - b.x) < 0.1 || Math.abs(point.x - b.x - b.width) < 0.1) {
          return { x: cx + (point.x < cx ? -1 : 1) * rx * factor((point.y - cy) / ry), y: point.y };
        }
        return { x: point.x, y: cy + (point.y < cy ? -1 : 1) * ry * factor((point.x - cx) / rx) };
      }
      for (const p of [dock(section.startPoint, e.sources[0]), ...(section.bendPoints || []), dock(section.endPoint, e.targets[0])]) create('di', 'waypoint', { x: ox + p.x, y: oy + p.y }, edge);
      for (const l of e.labels || []) label(edge, l, ox, oy);
      plane.appendChild(edge);
    }
  }
  if (!collaboration.participants.length) emit(processes[0], 0, 0);
  else {
    const horizontal = options.direction === 'LR', gap = 120 + collaboration.messages.length * 16;
    const mainSize = horizontal ? 'width' : 'height', crossSize = horizontal ? 'height' : 'width';
    const common = Math.max(400, ...processes.map(p => layouts.get(id(p))[mainSize] + 80));
    let cursor = 40;
    for (const participant of collaboration.participants) {
      const process = processes.find(p => id(p) === ref(participant, 'processRef'));
      const graph = process && layouts.get(id(process));
      const cross = graph ? Math.max(180, graph[crossSize] + 60) : 100;
      const box = horizontal ? { x:40, y:cursor, width:common, height:cross } : { x:cursor, y:40, width:cross, height:common };
      shape(id(participant), box, { isHorizontal: horizontal });
      if (process) emit(process, box.x + (horizontal ? 40 : 30), box.y + (horizontal ? 30 : 40));
      cursor += cross + gap;
    }
    const allBoxes = [...absoluteBoxes.values()], labelBoxes = [];
    const previous = all(plane,NS.bpmndi,'BPMNEdge').map(e => all(e,NS.di,'waypoint').map(p => ({x:Number(ref(p,'x')),y:Number(ref(p,'y'))})));
    const pools = collaboration.participants.map(p => absoluteBoxes.get(id(p)));
    const bounds = { x: 0, y: 0, width: Math.max(...pools.map(b=>b.x+b.width)) + gap, height: Math.max(...pools.map(b=>b.y+b.height)) + gap };
    for (const message of collaboration.messages) {
      const source = absoluteBoxes.get(ref(message, 'sourceRef')), target = absoluteBoxes.get(ref(message, 'targetRef'));
      const sourceModel = collaboration.model.get(ref(message,'sourceRef')), targetModel = collaboration.model.get(ref(message,'targetRef'));
      const sourcePool = collaboration.pool(sourceModel), targetPool = collaboration.pool(targetModel);
      const visible = b => {
        for (let p=collaboration.model.get(b.id)?.parentNode;p?.nodeType===1;p=p.parentNode) if(subTypes.has(p.localName) && !expanded(p)) return false;
        return true;
      };
      const obstacles = allBoxes.filter(b => {
        const n=collaboration.model.get(b.id);
        if (n?.localName==='lane') return false;
        if (n?.localName==='participant') return n!==sourcePool && n!==targetPool || b===source || b===target;
        return visible(b) && !contains(n,sourceModel) && !contains(n,targetModel);
      });
      obstacles.push(...absoluteLabels.filter(l => visible({id:l.owner})));
      for (const b of allBoxes) {
        const n=collaboration.model.get(b.id);
        if (['lane','participant'].includes(n?.localName) && b!==source && b!==target && visible(b)) {
          obstacles.push(horizontal ? {...b,width:32} : {...b,height:32});
        }
      }
      const points = route(source, target, obstacles, bounds, { direction: horizontal ? 'TB' : 'LR', previous,
        sourceSides: sourceModel.localName==='boundaryEvent' ? ['S'] : undefined });
      const edge = oldEdges.has(id(message)) ? oldEdges.get(id(message)).cloneNode(true) : create('bpmndi','BPMNEdge',{id:fresh(`${id(message)}_di`),bpmnElement:id(message)});
      for (const c of children(edge)) if ([NS.di,NS.bpmndi].includes(c.namespaceURI)) edge.removeChild(c);
      for (const p of points) create('di','waypoint',p,edge);
      if (ref(message,'name')) {
        const text=ref(message,'name'), dimensions={width:Math.min(240,Math.max(50,text.length*7)),height:Math.ceil(text.length*7/240)*16};
        const box=placeLabel(dimensions,points,[...allBoxes.filter(visible),...absoluteLabels.filter(l=>visible({id:l.owner}))],labelBoxes,bounds);
        label(edge,box,0,0);labelBoxes.push(box);
      }
      plane.appendChild(edge);previous.push(points);
    }
  }
}

export async function beautify(xml, inputOptions = {}) {
  const options = { layout: 'auto', theme: 'professional', subprocesses: 'collapsed', direction: 'LR', spacing: 'comfortable', ...inputOptions };
  for (const [key, choices] of Object.entries({ layout: ['auto', 'preserve'], theme: [...Object.keys(themes), 'preserve'],
    subprocesses: ['collapsed', 'expanded', 'preserve'], direction: ['LR', 'TB'], spacing: ['compact', 'comfortable'] })) {
    if (!choices.includes(options[key])) throw new Error(`Invalid ${key}: ${options[key]}. Expected ${choices.join(', ')}.`);
  }
  const doc = parse(xml), before = inspect(doc), original = semantics(doc), prefixes = namespaces(doc);
  const warnings = [];
  if (options.layout === 'auto') await layout(doc, options, prefixes, warnings);
  paint(doc, options.theme, prefixes);
  const result = serializer.serializeToString(doc);
  if (semantics(parse(result)) !== original) throw new Error('Semantic preservation check failed; no output written.');
  if (options.layout === 'preserve') warnings.push('Preserved all geometry and expansion states; only colors were changed.');
  warnings.push('Review in the target PM4 Modeler: renderer support for colors and hidden child DI varies.');
  return { xml: result, report: { options, semanticPreservation: true, before, after: inspect(doc), warnings } };
}
