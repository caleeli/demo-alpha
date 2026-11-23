import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {beautify,inspect,parse,semantics,NS} from '../scripts/beautify.mjs';
import {encloses,hits,intersects} from '../scripts/routing.mjs';
import {preview} from '../scripts/preview.mjs';
const source=await readFile(new URL('./fixtures/collaboration.bpmn',import.meta.url),'utf8');
const all=(d,ns,name)=>Array.from(d.getElementsByTagNameNS(ns,name));
function geometry(xml){
  const doc=parse(xml),boxes=new Map(all(doc,NS.bpmndi,'BPMNShape').map(s=>{
    const b=all(s,NS.dc,'Bounds')[0];return [s.getAttribute('bpmnElement'),Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(b.getAttribute(k))]))];
  }));
  const edges=new Map(all(doc,NS.bpmndi,'BPMNEdge').map(e=>[e.getAttribute('bpmnElement'),all(e,NS.di,'waypoint').map(p=>({x:Number(p.getAttribute('x')),y:Number(p.getAttribute('y'))}))]));
  return {doc,boxes,edges};
}
for(const direction of ['LR','TB'])test(`${direction}: nested lanes, boundary attachments, black-box pool, loops and messages preserve the model`,async()=>{
  const result=await beautify(source,{direction,spacing:'compact'}),{doc,boxes,edges}=geometry(result.xml);
  assert.equal(semantics(doc),semantics(parse(source)));
  assert.deepEqual(result.report.after.issues,[]);
  assert.equal(all(doc,NS.bpmndi,'BPMNPlane')[0].getAttribute('bpmnElement'),'Collaboration');
  assert.equal(all(doc,NS.bpmndi,'BPMNDiagram').length,1);
  for(const child of ['captureLane','correctionLane'])assert.ok(encloses(boxes.get('intake'),boxes.get(child)));
  for(const [lane,nodes] of [['captureLane',['start','capture','decision','timeout']],['correctionLane',['fix']],['reviewLane',['review','done','expired']]]){
    for(const node of nodes)assert.ok(encloses(boxes.get(lane),boxes.get(node)),`${lane} contains ${node}`);
  }
  for(const lane of ['intake','reviewLane','emptyLane'])assert.ok(encloses(boxes.get('Applicant'),boxes.get(lane)));
  assert.ok(!intersects(boxes.get('intake'),boxes.get('reviewLane')));
  assert.ok(!intersects(boxes.get('Applicant'),boxes.get('Office')));
  assert.ok(!intersects(boxes.get('Office'),boxes.get('Archive')));
  const host=boxes.get('capture'),boundary=boxes.get('timeout');assert.equal(boundary.y+18,host.y+host.height);
  for(const [id,points] of edges)for(let i=1;i<points.length;i++)assert.ok(points[i].x===points[i-1].x || points[i].y===points[i-1].y,`${id} orthogonal`);
  for(const key of ['f1','f2','f3','f4','f5','f6','f7'])for(const p of edges.get(key))assert.ok(encloses(boxes.get('Applicant'),{...p,width:0,height:0}),`${key} stays in its pool`);
  for(const key of ['archive','receipt']){
    const points=edges.get(key);for(let i=1;i<points.length;i++)assert.ok(!hits(points[i-1],points[i],boxes.get('Office')),`${key} avoids unrelated pool`);
  }
  // Every top-level sequence avoids unrelated task/event/gateway rectangles.
  const model=new Map(all(doc,NS.bpmn,'*').map(n=>[n.getAttribute('id'),n]));
  for(const key of ['f1','f2','f3','f4','f5','f6','f7']){
    const f=model.get(key),excluded=[f.getAttribute('sourceRef'),f.getAttribute('targetRef')];
    if(excluded.includes('timeout'))excluded.push('capture');
    for(const obstacle of ['start','capture','decision','fix','review','done','expired','timeout'].filter(k=>!excluded.includes(k))){
      const points=edges.get(key);for(let i=1;i<points.length;i++)assert.ok(!hits(points[i-1],points[i],boxes.get(obstacle)),`${key} avoids ${obstacle}`);
    }
  }
  const svg=preview(result.xml);assert.match(svg,/stroke-dasharray="7 5"/);assert.match(svg,/marker-start="url\(#messageStart\)"/);
});

test('collaboration layout is idempotent including lane geometry and message routing',async()=>{
  const first=await beautify(source);const second=await beautify(first.xml);
  assert.equal(second.xml,first.xml);
});

test('messages to children expose only necessary subprocesses without changing endpoint references',async()=>{
  const xml=source.replace('targetRef="review"','targetRef="reviewTask"');
  const result=await beautify(xml),{doc,boxes}=geometry(result.xml);
  assert.equal(result.report.after.collapsedSubprocesses,0);
  assert.ok(result.report.warnings.some(w=>w.includes('message endpoints')));
  assert.equal(semantics(doc),semantics(parse(xml)));
  assert.ok(encloses(boxes.get('review'),boxes.get('reviewTask')));
  assert.ok(encloses(boxes.get('reviewLane'),boxes.get('review')));
  assert.deepEqual(result.report.after.issues,[]);
});

test('empty collaborations, unassigned lane nodes and direct pool endpoints have geometry',async()=>{
  const xml=`<b:definitions xmlns:b="${NS.bpmn}" id="d" targetNamespace="urn:t"><b:collaboration id="c"><b:participant id="a"/><b:participant id="b"/><b:messageFlow id="m" sourceRef="a" targetRef="b" name="Hello"/></b:collaboration></b:definitions>`;
  const result=await beautify(xml);assert.equal(result.report.after.visibleShapes,2);assert.deepEqual(result.report.after.issues,[]);
  const unassigned=await beautify(source.replace('<b:flowNodeRef>review</b:flowNodeRef>',''));
  assert.ok(unassigned.report.warnings.some(w=>w.includes('Unassigned nodes')));
  assert.deepEqual(unassigned.report.after.issues,[]);
});

test('invalid ownership, ambiguous lanes and same-pool messages fail before output',async()=>{
  const cases=[
    [source.replace('processRef="Verification"','processRef="Unknown"'),/processRef/],
    [source.replace('processRef="Verification"','processRef="Application"'),/multiple participants/],
    [source.replace('targetRef="receive"','targetRef="fix"'),/different participants/],
    [source.replace('<b:flowNodeRef>fix</b:flowNodeRef></b:lane>','<b:flowNodeRef>capture</b:flowNodeRef></b:lane>'),/incompatible lanes/],
    [source.replace('<b:flowNodeRef>fix</b:flowNodeRef></b:lane>','<b:flowNodeRef>receive</b:flowNodeRef></b:lane>'),/cross-scope node/],
    [source.replace('targetRef="decision"','targetRef="receive"'),/cross-scope sequence flow/],
  ];
  for(const [xml,message] of cases)await assert.rejects(beautify(xml),message);
});

test('inspection detects nodes outside lanes and overlapping pools',async()=>{
  const {doc}=geometry((await beautify(source)).xml);
  const shapes=new Map(all(doc,NS.bpmndi,'BPMNShape').map(s=>[s.getAttribute('bpmnElement'),s]));
  all(shapes.get('capture'),NS.dc,'Bounds')[0].setAttribute('x','-1000');
  const a=all(shapes.get('Applicant'),NS.dc,'Bounds')[0],b=all(shapes.get('Office'),NS.dc,'Bounds')[0];
  b.setAttribute('x',a.getAttribute('x'));b.setAttribute('y',a.getAttribute('y'));
  const report=inspect(doc);
  assert.ok(report.issues.some(i=>i.code==='outside-container' && i.element==='capture' && i.container==='captureLane'));
  assert.ok(report.issues.some(i=>i.code==='shape-overlap' && i.elements.includes('Applicant') && i.elements.includes('Office')));
});

test('self-loops in lanes and lane sets inside expanded subprocesses retain contained orthogonal routes',async()=>{
  const xml=`<b:definitions xmlns:b="${NS.bpmn}" id="d" targetNamespace="urn:t"><b:process id="p">
    <b:subProcess id="sub"><b:laneSet id="ls"><b:lane id="lane"><b:flowNodeRef>task</b:flowNodeRef></b:lane></b:laneSet>
      <b:task id="task" name="Work"/><b:sequenceFlow id="loop" sourceRef="task" targetRef="task" name="Retry"/>
    </b:subProcess></b:process></b:definitions>`;
  for(const direction of ['LR','TB']){
    const result=await beautify(xml,{direction,subprocesses:'expanded'}),{boxes,edges}=geometry(result.xml);
    assert.deepEqual(result.report.after.issues,[]);
    assert.ok(encloses(boxes.get('sub'),boxes.get('lane')));
    assert.ok(encloses(boxes.get('lane'),boxes.get('task')));
    assert.ok(edges.get('loop').length>=4);
    for(const point of edges.get('loop'))assert.ok(encloses(boxes.get('sub'),{...point,width:0,height:0}));
  }
});

test('message labels occupy free space outside pools and preserve mode retains all collaboration DI',async()=>{
  const result=await beautify(source),{doc,boxes}=geometry(result.xml);
  for(const edge of all(doc,NS.bpmndi,'BPMNEdge').filter(e=>['request','response','archive'].includes(e.getAttribute('bpmnElement')))){
    const b=all(edge,NS.dc,'Bounds')[0];
    const label=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(b.getAttribute(k))]));
    for(const pool of ['Applicant','Office','Archive'])assert.ok(!intersects(label,boxes.get(pool)));
  }
  const preserved=await beautify(result.xml,{layout:'preserve',theme:'monochrome'});
  assert.deepEqual(geometry(preserved.xml).boxes,boxes);
  assert.deepEqual(geometry(preserved.xml).edges,geometry(result.xml).edges);
});

test('message payload mapping without a visual association survives collaboration layout',async()=>{
  const xml=source.replace('<b:incoming>v1</b:incoming>',`<b:incoming>v1</b:incoming><b:dataInput id="payload"/><b:dataInputAssociation id="mapping"><b:targetRef>payload</b:targetRef><b:assignment id="map"><b:from>paymentId</b:from><b:to>payment_id</b:to></b:assignment></b:dataInputAssociation>`);
  const result=await beautify(xml);assert.equal(semantics(parse(result.xml)),semantics(parse(xml)));
});
