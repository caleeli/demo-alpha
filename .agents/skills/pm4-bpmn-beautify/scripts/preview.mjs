import { NS, parse } from './beautify.mjs';

// Offline review artifact, not a replacement for the target BPMN renderer.
const elements = (n, ns, tag) => Array.from(n.getElementsByTagNameNS(ns, tag));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const attr = (n, key) => n.getAttribute(key);
const box = n => Object.fromEntries(['x', 'y', 'width', 'height'].map(k => [k, Number(attr(n, k))]));
export function preview(xml) {
  const doc = parse(xml), model = new Map(elements(doc, NS.bpmn, '*').map(n => [attr(n, 'id'), n]));
  const shapes = elements(doc, NS.bpmndi, 'BPMNShape');
  const collapsed = new Set(shapes.filter(s => ['subProcess', 'adHocSubProcess', 'transaction'].includes(model.get(attr(s, 'bpmnElement'))?.localName) && attr(s, 'isExpanded') !== 'true').map(s => attr(s, 'bpmnElement')));
  function visible(s) {
    for (let n = model.get(attr(s, 'bpmnElement'))?.parentNode; n?.nodeType === 1; n = n.parentNode) if (collapsed.has(attr(n, 'id'))) return false;
    return true;
  }
  const parts = [], boxes = [];
  function text(name, b, padding = 12) {
    if (!name) return '';
    const width = Math.max(1, Math.floor((b.width - padding) / 7));
    const words = name.split(/\s+/), lines = [''];
    for (const word of words) {
      for (let start = 0; start < word.length; start += width) {
        const piece = word.slice(start, start + width);
        if ((lines.at(-1) + ' ' + piece).trim().length > width) lines.push('');
        lines[lines.length - 1] = (lines.at(-1) + ' ' + piece).trim();
      }
    }
    return `<text x="${b.x + b.width / 2}" y="${b.y + b.height / 2 - (lines.length - 1) * 8}" text-anchor="middle" dominant-baseline="middle" fill="#0F172A" font-family="Arial,sans-serif" font-size="12">${lines.map((line, i) => `<tspan x="${b.x + b.width / 2}" dy="${i ? 16 : 0}">${escape(line)}</tspan>`).join('')}</text>`;
  }
  // Paint containers first, edges second, leaf nodes last.
  const containers = [], leaves = [], edges = [];
  for (const s of shapes.filter(visible)) {
    const bounds = elements(s, NS.dc, 'Bounds')[0];
    if (!bounds) continue;
    const b = box(bounds); boxes.push(b);
    const n = model.get(attr(s, 'bpmnElement')), type = n?.localName || '';
    const fill = escape(s.getAttributeNS(NS.bioc, 'fill') || '#FFFFFF');
    const stroke = escape(s.getAttributeNS(NS.bioc, 'stroke') || '#475569');
    const style = `fill="${fill}" stroke="${stroke}" stroke-width="${type === 'endEvent' || type === 'callActivity' ? 3 : 1.5}"`;
    let shape;
    if (type.endsWith('Event')) shape = `<ellipse cx="${b.x + b.width / 2}" cy="${b.y + b.height / 2}" rx="${b.width / 2}" ry="${b.height / 2}" ${style}/>`;
    else if (type.endsWith('Gateway')) shape = `<polygon points="${b.x + b.width / 2},${b.y} ${b.x + b.width},${b.y + b.height / 2} ${b.x + b.width / 2},${b.y + b.height} ${b.x},${b.y + b.height / 2}" ${style}/>`;
    else if (['participant','lane'].includes(type)) shape = `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" ${style}/>`;
    else shape = `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="8" ${style}/>`;
    const label = elements(s, NS.bpmndi, 'BPMNLabel')[0];
    const labelBounds = label && elements(label, NS.dc, 'Bounds')[0];
    const isContainer = attr(s, 'isExpanded') === 'true' || ['lane', 'participant'].includes(type);
    const lb = labelBounds ? box(labelBounds) : isContainer ? { ...b, height: 30 } : b;
    if (labelBounds) boxes.push(lb);
    if (['participant','lane'].includes(type)) {
      const horizontal = attr(s,'isHorizontal') !== 'false';
      if (horizontal) {
        shape += `<path d="M ${b.x+32} ${b.y} V ${b.y+b.height}" fill="none" stroke="${stroke}"/>`;
        shape += `<g transform="translate(${b.x+16} ${b.y+b.height/2}) rotate(-90)">${text(n && attr(n,'name'),{x:-b.height/2,y:-16,width:b.height,height:32})}</g>`;
      } else {
        shape += `<path d="M ${b.x} ${b.y+32} H ${b.x+b.width}" fill="none" stroke="${stroke}"/>`;
        shape += text(n && attr(n,'name'),{...b,height:32});
      }
    } else if (!type.endsWith('Event') && !type.endsWith('Gateway') || labelBounds) shape += text(n && attr(n, 'name'), lb, labelBounds ? 0 : 12);
    if (type.endsWith('Gateway')) shape += text({ exclusiveGateway: '×', parallelGateway: '+', inclusiveGateway: '○', eventBasedGateway: '◇' }[type] || '*', b);
    if (collapsed.has(attr(s, 'bpmnElement'))) shape += `<rect x="${b.x + b.width / 2 - 7}" y="${b.y + b.height - 18}" width="14" height="14" fill="white" stroke="${stroke}"/>` + text('+', { x: b.x + b.width / 2 - 7, y: b.y + b.height - 18, width: 14, height: 14 });
    (isContainer ? containers : leaves).push(shape);
  }
  for (const e of elements(doc, NS.bpmndi, 'BPMNEdge').filter(visible)) {
    const points = elements(e, NS.di, 'waypoint').map(p => ({ x: Number(attr(p, 'x')), y: Number(attr(p, 'y')) }));
    points.forEach(p => boxes.push({ ...p, width: 0, height: 0 }));
    const message = model.get(attr(e,'bpmnElement'))?.localName === 'messageFlow';
    edges.push(`<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${escape(e.getAttributeNS(NS.bioc, 'stroke') || '#475569')}" stroke-width="1.5" marker-end="url(#${message ? 'messageArrow' : 'arrow'})" ${message ? 'stroke-dasharray="7 5" marker-start="url(#messageStart)"' : ''}/>`);
    const label = elements(e, NS.bpmndi, 'BPMNLabel')[0], bounds = label && elements(label, NS.dc, 'Bounds')[0];
    if (bounds) { const b = box(bounds); boxes.push(b); leaves.push(text(attr(model.get(attr(e, 'bpmnElement')) || e, 'name'), b, 0)); }
  }
  const valid = boxes.filter(b => Object.values(b).every(Number.isFinite));
  const x = Math.min(0, ...valid.map(b => b.x)) - 24, y = Math.min(0, ...valid.map(b => b.y)) - 24;
  const width = Math.max(200, ...valid.map(b => b.x + b.width)) - x + 24;
  const height = Math.max(100, ...valid.map(b => b.y + b.height)) - y + 24;
  parts.push(...containers, ...edges, ...leaves);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" role="img"><title>BPMN layout preview (schematic)</title><desc>Review geometry and colors. Event definitions and task icons are simplified; verify in ProcessMaker Modeler.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker><marker id="messageArrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M 1 1 L 11 6 L 1 11 z" fill="white" stroke="#475569"/></marker><marker id="messageStart" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6"><circle cx="5" cy="5" r="3" fill="white" stroke="#475569"/></marker></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>${parts.join('\n')}</svg>\n`;
}
