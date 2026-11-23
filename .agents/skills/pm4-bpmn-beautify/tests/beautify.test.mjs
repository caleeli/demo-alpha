import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { beautify, inspect, NS, parse, semantics } from '../scripts/beautify.mjs';
import { preview } from '../scripts/preview.mjs';

const cli = fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url));
const wrap = body => `<b:definitions xmlns:b="${NS.bpmn}" xmlns:v="${NS.bpmndi}" xmlns:dc="${NS.dc}" xmlns:di="${NS.di}" xmlns:pm="http://processmaker.com/BPMN/2.0/Schema.xsd" xmlns:custom="urn:custom" id="Defs" targetNamespace="urn:test">${body}</b:definitions>`;
const flow = (key, a, b, extra = '') => `<b:sequenceFlow id="${key}" sourceRef="${a}" targetRef="${b}" ${extra}/>`;
const inner = `<b:startEvent id="innerStart"/><b:task id="innerTask" name="Check documents"/><b:endEvent id="innerEnd"/>${flow('i1', 'innerStart', 'innerTask')}${flow('i2', 'innerTask', 'innerEnd')}`;
const source = wrap(`<b:process id="Process" isExecutable="true"><b:extensionElements><custom:setting value="keep"><![CDATA[<raw>&]]></custom:setting></b:extensionElements>
  <b:startEvent id="start" name="Start"/><b:task id="capture" name="Capture application &amp; supporting information" pm:screenRef="42" pm:config="{&quot;assignedUsers&quot;:[3]}"><b:incoming>f1</b:incoming><b:outgoing>f2</b:outgoing></b:task>
  <b:boundaryEvent id="timeout" name="Deadline" attachedToRef="capture" cancelActivity="false"><b:timerEventDefinition><b:timeDuration>PT1H</b:timeDuration></b:timerEventDefinition></b:boundaryEvent>
  <b:exclusiveGateway id="decision" name="Complete?" default="retry"/><b:subProcess id="review" name="Review application">${inner}</b:subProcess>
  <b:endEvent id="end" name="Completed"/><b:endEvent id="expired" name="Expired"/>
  ${flow('f1', 'start', 'capture')}${flow('f2', 'capture', 'decision')}
  <b:sequenceFlow id="accept" sourceRef="decision" targetRef="review" name="Yes"><b:conditionExpression><![CDATA[approved === true && amount < 500]]></b:conditionExpression></b:sequenceFlow>
  ${flow('retry', 'decision', 'capture', 'name="No"')}${flow('f4', 'review', 'end')}${flow('f5', 'timeout', 'expired')}
  </b:process>`);

test('layout preserves PM extensions, conditions, ids, scope and execution text exactly at DOM level', async () => {
  const result = await beautify(source);
  assert.equal(semantics(parse(result.xml)), semantics(parse(source)));
  assert.equal(result.report.semanticPreservation, true);
  assert.equal(result.report.after.collapsedSubprocesses, 1);
  assert.deepEqual(result.report.after.issues, []);
  const doc = parse(result.xml);
  assert.equal(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNDiagram').length, 1);
  assert.equal(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNShape').length, 10);
  assert.equal(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNEdge').length, 8);
  assert.match(result.xml, /isExpanded="false"/);
  assert.match(result.xml, /bioc:fill="#EEF2FF"/);
  assert.match(result.xml, /background-color=/);
});

test('expanded subprocess contains every child, collapsed has smaller visible area', async () => {
  const collapsed = await beautify(source), expanded = await beautify(source, { subprocesses: 'expanded' });
  assert.ok(expanded.report.after.area > collapsed.report.after.area);
  const doc = parse(expanded.xml);
  const boxes = new Map(Array.from(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNShape')).map(s => {
    const b = s.getElementsByTagNameNS(NS.dc, 'Bounds')[0];
    return [s.getAttribute('bpmnElement'), Object.fromEntries(['x','y','width','height'].map(k => [k, Number(b.getAttribute(k))]))];
  }));
  const p = boxes.get('review');
  for (const key of ['innerStart', 'innerTask', 'innerEnd']) {
    const c = boxes.get(key);
    assert.ok(c.x >= p.x && c.y >= p.y && c.x + c.width <= p.x + p.width && c.y + c.height <= p.y + p.height);
  }
  assert.deepEqual(expanded.report.after.issues, []);
});

test('geometry is deterministic; TB, compact, preserved colors and self-loops work', async () => {
  const a = await beautify(source), b = await beautify(source);
  assert.equal(a.xml, b.xml);
  const repeat = await beautify(a.xml);
  assert.deepEqual(repeat.report.after, a.report.after);
  assert.equal(repeat.xml, a.xml);
  const tb = await beautify(wrap(`<b:process id="p"><b:task id="a"/><b:task id="z"/>${flow('f', 'a', 'z')}${flow('loop', 'z', 'z')}</b:process>`), { direction: 'TB', spacing: 'compact', theme: 'monochrome' });
  assert.equal(tb.report.after.issues.length, 0);
  assert.ok(tb.report.after.bends > 0);
  const preserved = await beautify(a.xml, { theme: 'preserve' });
  assert.match(preserved.xml, /bioc:fill="#EEF2FF"/);
});

test('boundary event stays attached to host and edge starts on boundary perimeter', async () => {
  const result = await beautify(source), doc = parse(result.xml);
  const shapes = Array.from(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNShape'));
  const bounds = key => {
    const b = shapes.find(s => s.getAttribute('bpmnElement') === key).getElementsByTagNameNS(NS.dc, 'Bounds')[0];
    return Object.fromEntries(['x','y','width','height'].map(k => [k, Number(b.getAttribute(k))]));
  };
  const host = bounds('capture'), boundary = bounds('timeout');
  assert.equal(boundary.y + 18, host.y + host.height);
  assert.ok(boundary.x >= host.x && boundary.x + 36 <= host.x + host.width);
  const edge = Array.from(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNEdge')).find(e => e.getAttribute('bpmnElement') === 'f5');
  const point = edge.getElementsByTagNameNS(NS.di, 'waypoint')[0];
  assert.equal(Number(point.getAttribute('y')), boundary.y + 36);
});

test('gateway endpoints meet the diamond and every route stays orthogonal', async () => {
  const doc = parse((await beautify(source)).xml);
  const gateway = Array.from(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNShape')).find(s => s.getAttribute('bpmnElement') === 'decision');
  const b = gateway.getElementsByTagNameNS(NS.dc, 'Bounds')[0];
  const cx = Number(b.getAttribute('x')) + 25, cy = Number(b.getAttribute('y')) + 25;
  for (const edge of Array.from(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNEdge'))) {
    const points = Array.from(edge.getElementsByTagNameNS(NS.di, 'waypoint')).map(p => ({ x: Number(p.getAttribute('x')), y: Number(p.getAttribute('y')) }));
    for (let i = 1; i < points.length; i++) assert.ok(Math.abs(points[i].x - points[i-1].x) < 0.001 || Math.abs(points[i].y - points[i-1].y) < 0.001);
    if (['accept', 'retry'].includes(edge.getAttribute('bpmnElement'))) assert.ok(Math.abs(Math.abs(points[0].x - cx) + Math.abs(points[0].y - cy) - 25) < 0.001);
  }
});

test('nested scopes and conflicting namespace prefixes preserve semantics', async () => {
  const xml = wrap(`<b:process id="p"><b:subProcess id="outer"><b:subProcess id="middle">${inner}</b:subProcess></b:subProcess></b:process>`).replace('id="Defs"', 'xmlns:bioc="urn:vendor" bioc:flag="keep" id="Defs"');
  const result = await beautify(xml);
  assert.equal(semantics(parse(xml)), semantics(parse(result.xml)));
  assert.equal(result.report.after.visibleShapes, 1);
  assert.equal(result.report.after.collapsedSubprocesses, 2);
  assert.match(result.xml, /bioc1:fill=/);
});

test('preserve layout supports lanes/artifacts without dropping geometry or extensions', async () => {
  const xml = wrap(`<b:process id="p"><b:laneSet id="ls"><b:lane id="lane"/></b:laneSet><b:task id="a"/></b:process><v:BPMNDiagram id="d"><v:BPMNPlane id="plane" bpmnElement="p"><v:BPMNShape id="sd" bpmnElement="a"><dc:Bounds x="10" y="20" width="100" height="80"/></v:BPMNShape></v:BPMNPlane></v:BPMNDiagram>`);
  assert.deepEqual((await beautify(xml)).report.after.issues, []);
  const result = await beautify(xml, { layout: 'preserve' });
  assert.deepEqual(result.report.before, result.report.after);
  assert.equal(semantics(parse(xml)), semantics(parse(result.xml)));
});

test('rejects malformed XML, duplicate ids, dangling flows, DTD, unknown options and cross-scope flows', async () => {
  assert.throws(() => parse('<broken>'), /XML|unclosed/);
  assert.throws(() => parse(wrap('<b:process id="p"/><b:process id="p"/>')), /Duplicate/);
  assert.throws(() => parse('<!DOCTYPE x>' + source), /DTD/);
  await assert.rejects(beautify(source, { direction: 'sideways' }), /Invalid direction/);
  await assert.rejects(beautify(wrap(`<b:process id="p"><b:task id="a"/>${flow('f', 'a', 'missing')}</b:process>`)), /sequence flow/);
  await assert.rejects(beautify(wrap(`<b:process id="p"><b:task id="a"/><b:subProcess id="s">${inner}</b:subProcess>${flow('f', 'a', 'innerTask')}</b:process>`)), /cross-scope/);
});

test('report detects missing DI, overlap and malformed waypoints', () => {
  const result = inspect(parse(wrap(`<b:process id="p"><b:task id="a"/><b:task id="b"/><b:task id="c"/>${flow('f', 'a', 'b')}</b:process><v:BPMNDiagram id="d"><v:BPMNPlane id="plane" bpmnElement="p"><v:BPMNShape id="ad" bpmnElement="a"><dc:Bounds x="0" y="0" width="100" height="80"/></v:BPMNShape><v:BPMNShape id="bd" bpmnElement="b"><dc:Bounds x="20" y="0" width="100" height="80"/></v:BPMNShape><v:BPMNEdge id="fd" bpmnElement="f"><di:waypoint x="bad" y="0"/></v:BPMNEdge></v:BPMNPlane></v:BPMNDiagram>`)));
  assert.deepEqual(new Set(result.issues.map(i => i.code)), new Set(['shape-overlap', 'missing-shape', 'invalid-waypoints']));
});

test('SVG is offline, escapes names and excludes collapsed children', async () => {
  const result = await beautify(source), svg = preview(result.xml);
  assert.match(svg, /Capture application/);
  assert.doesNotMatch(svg, /Check documents|<script|https?:\/\/[^w]/);
  assert.match(svg, /&amp;/);
});

test('CLI writes artifacts, refuses overwrite and aliased destinations, reports without writing input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pm4-beautify-test-')), input = join(dir, 'input.bpmn');
  await writeFile(input, source);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env });
  const output = join(dir, 'result.bpmn'), report = join(dir, 'report.json'), svg = join(dir, 'preview.svg');
  let result = run(['beautify', input, '-o', output, '--report', report, '--preview', svg]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(await readFile(report, 'utf8')).semanticPreservation, true);
  assert.match(await readFile(svg, 'utf8'), /<svg/);
  assert.equal(await readFile(input, 'utf8'), source);
  assert.equal(run(['beautify', input, '-o', output]).status, 1);
  await symlink(dir, join(dir, 'alias'));
  result = run(['beautify', input, '-o', join(dir, 'same'), '--report', join(dir, 'alias', 'same')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /distinct/);
  assert.equal(run(['report', input]).status, 0);
  assert.equal(run(['beautify', input, '--unknown']).status, 1);
});
