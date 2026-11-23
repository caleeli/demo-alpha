// Orthogonal visibility-grid router. Containers are supplied as obstacles only
// when the route must not enter them. All coordinates are in the caller's scope.
const EPS = 1e-6;
export const intersects = (a, b) => a.x < b.x + b.width - EPS && a.x + a.width > b.x + EPS && a.y < b.y + b.height - EPS && a.y + a.height > b.y + EPS;
export const encloses = (a, b) => b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.width <= a.x + a.width + EPS && b.y + b.height <= a.y + a.height + EPS;
export function hits(a, b, r) {
  if (Math.abs(a.x - b.x) < EPS) return a.x > r.x + EPS && a.x < r.x + r.width - EPS && Math.max(a.y, b.y) > r.y + EPS && Math.min(a.y, b.y) < r.y + r.height - EPS;
  if (Math.abs(a.y - b.y) < EPS) return a.y > r.y + EPS && a.y < r.y + r.height - EPS && Math.max(a.x, b.x) > r.x + EPS && Math.min(a.x, b.x) < r.x + r.width - EPS;
  throw new Error('Router received a non-orthogonal segment.');
}
const inflate = (r, d) => ({ x: r.x - d, y: r.y - d, width: r.width + 2*d, height: r.height + 2*d });
const simplify = points => points.filter((p, i) => !i || p.x !== points[i-1].x || p.y !== points[i-1].y)
  .filter((p, i, a) => !i || i === a.length-1 || !((a[i-1].x === p.x && p.x === a[i+1].x) || (a[i-1].y === p.y && p.y === a[i+1].y)));

class Heap {
  data = [];
  push(v) { let i = this.data.length; this.data.push(v); while (i) { const p = (i-1)>>1; if (this.data[p].score <= v.score) break; this.data[i] = this.data[p]; i = p; } this.data[i] = v; }
  pop() { const result = this.data[0], v = this.data.pop(); if (this.data.length) { let i = 0; while (i*2+1 < this.data.length) { let c = i*2+1; if (c+1 < this.data.length && this.data[c+1].score < this.data[c].score) c++; if (this.data[c].score >= v.score) break; this.data[i] = this.data[c]; i = c; } this.data[i] = v; } return result; }
}
function search(start, end, obstacles, bounds, previous) {
  // Alternative tracks let later routes separate from earlier connections.
  const tracks = previous.flat();
  const xs = [...new Set([bounds.x, bounds.x+bounds.width, start.x, end.x, ...obstacles.flatMap(r => [r.x, r.x+r.width]), ...tracks.flatMap(p=>[p.x-12,p.x+12])])].filter(x => x >= bounds.x && x <= bounds.x+bounds.width).sort((a,b)=>a-b);
  const ys = [...new Set([bounds.y, bounds.y+bounds.height, start.y, end.y, ...obstacles.flatMap(r => [r.y, r.y+r.height]), ...tracks.flatMap(p=>[p.y-12,p.y+12])])].filter(y => y >= bounds.y && y <= bounds.y+bounds.height).sort((a,b)=>a-b);
  if (xs.length * ys.length > 250000) throw new Error('Routing grid too large; split this diagram into smaller scopes.');
  const nx = xs.length, startIndex = ys.indexOf(start.y)*nx + xs.indexOf(start.x), endIndex = ys.indexOf(end.y)*nx + xs.indexOf(end.x);
  if (xs.indexOf(start.x) < 0 || ys.indexOf(start.y) < 0 || xs.indexOf(end.x) < 0 || ys.indexOf(end.y) < 0) return null;
  const point = i => ({x:xs[i%nx], y:ys[Math.floor(i/nx)]});
  const heap = new Heap(), distance = new Map(), parents = new Map(), cache = new Map();
  const initial = startIndex*3; distance.set(initial, 0); heap.push({key:initial, cost:0, score:0});
  while (heap.data.length) {
    const current = heap.pop(); if (distance.get(current.key) !== current.cost) continue;
    const index = Math.floor(current.key/3), axis = current.key%3;
    if (index === endIndex) { const path = []; for (let k = current.key; k !== undefined; k = parents.get(k)) path.push(point(Math.floor(k/3))); return path.reverse(); }
    const a = point(index), ix = index%nx, iy = Math.floor(index/nx);
    for (const [next, direction] of [[ix>0 ? index-1 : -1,1],[ix+1<nx ? index+1 : -1,1],[iy>0 ? index-nx : -1,2],[iy+1<ys.length ? index+nx : -1,2]]) {
      if (next < 0) continue;
      const b = point(next), segmentKey = `${Math.min(index,next)}:${Math.max(index,next)}`;
      if (!cache.has(segmentKey)) cache.set(segmentKey, obstacles.some(r=>hits(a,b,r)));
      if (cache.get(segmentKey)) continue;
      let penalty = axis && axis !== direction ? 24 : 0;
      for (const line of previous) for (let i=1;i<line.length;i++) {
        const c=line[i-1], d=line[i];
        if (direction===1 && c.x===d.x && c.x>Math.min(a.x,b.x) && c.x<Math.max(a.x,b.x) && a.y>Math.min(c.y,d.y) && a.y<Math.max(c.y,d.y) ||
          direction===2 && c.y===d.y && c.y>Math.min(a.y,b.y) && c.y<Math.max(a.y,b.y) && a.x>Math.min(c.x,d.x) && a.x<Math.max(c.x,d.x)) penalty += 40;
        if (direction===1 && c.y===d.y && a.y===c.y && Math.max(a.x,b.x)>Math.min(c.x,d.x) && Math.min(a.x,b.x)<Math.max(c.x,d.x) ||
          direction===2 && c.x===d.x && a.x===c.x && Math.max(a.y,b.y)>Math.min(c.y,d.y) && Math.min(a.y,b.y)<Math.max(c.y,d.y)) penalty += 8;
      }
      const cost = current.cost + Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+penalty, key=next*3+direction;
      if (cost >= (distance.get(key) ?? Infinity)) continue;
      distance.set(key,cost); parents.set(key,current.key);
      heap.push({key,cost,score:cost+Math.abs(b.x-end.x)+Math.abs(b.y-end.y)});
    }
  }
  return null;
}
function port(r, side, distance=0) {
  return { E:{x:r.x+r.width+distance,y:r.y+r.height/2}, W:{x:r.x-distance,y:r.y+r.height/2},
    N:{x:r.x+r.width/2,y:r.y-distance}, S:{x:r.x+r.width/2,y:r.y+r.height+distance} }[side];
}
export function route(source, target, obstacles, bounds, {direction='LR', previous=[], sourceSides, targetSides, self=false}={}) {
  const forward = direction==='LR' ? target.x >= source.x+source.width : target.y >= source.y+source.height;
  const first = self ? ['E','S'] : direction==='LR' ? (forward ? ['E','W'] : ['N','N']) : (forward ? ['S','N'] : ['W','W']);
  const sides = ['E','S','W','N'];
  const starts = sourceSides || [first[0],...sides.filter(s=>s!==first[0])], ends = targetSides || [first[1],...sides.filter(s=>s!==first[1])];
  const padded = obstacles.map(r=>inflate(r,8));
  for (const s of starts) for (const t of ends) {
    if (self && s===t) continue;
    const a=port(source,s), start=port(source,s,12), end=port(target,t,12), b=port(target,t);
    // Own obstacle padding is intentionally traversed only by the terminal stub.
    if (obstacles.some(r=>r!==source && hits(a,start,r)) || obstacles.some(r=>r!==target && hits(end,b,r))) continue;
    const path=search(start,end,padded,bounds,previous);
    if (path) return simplify([a,...path,b]);
  }
  throw new Error('No obstacle-free orthogonal route found; retain the input layout or increase spacing.');
}

export function placeLabel(label, points, obstacles, previousLabels=[], bounds) {
  const candidates=[];
  for (let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    if (a.y===b.y) {
      const centers=[cx,...obstacles.flatMap(r=>[r.x-label.width/2-8,r.x+r.width+label.width/2+8])].filter(x=>x>=Math.min(a.x,b.x) && x<=Math.max(a.x,b.x));
      for(const x of centers)candidates.push({x:x-label.width/2,y:cy-label.height-6},{x:x-label.width/2,y:cy+6});
    } else {
      const centers=[cy,...obstacles.flatMap(r=>[r.y-label.height/2-8,r.y+r.height+label.height/2+8])].filter(y=>y>=Math.min(a.y,b.y) && y<=Math.max(a.y,b.y));
      for(const y of centers)candidates.push({x:cx+6,y:y-label.height/2},{x:cx-label.width-6,y:y-label.height/2});
    }
  }
  const boxes=candidates.map(p=>({...p,width:label.width,height:label.height}));
  const chosen=boxes.find(b=>(!bounds || encloses(bounds,b)) && ![...obstacles,...previousLabels].some(o=>intersects(b,o)));
  if (!chosen) throw new Error('No free space for a flow label; increase spacing or retain the input layout.');
  return {...label,...chosen};
}
