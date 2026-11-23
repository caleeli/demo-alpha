---
name: pm4-bpmn-beautify
description: >-
  BPMN XML layout CLI (lanes, colors, collapsed subprocesses, report, SVG).
  Not Modeler edits, import, or publish.
---

# PM4 BPMN Beautify

Improve presentation while preserving execution semantics. The CLI operates on
local BPMN 2.0 XML; it never calls ProcessMaker or an AI service. “Intelligent”
here means graph layout and BPMN-specific rules, not an LLM or a guarantee of an
optimal drawing.

## Run

Requires Node.js 20+ (repository CI uses Node 24). In this checkout, run `npm ci`
at the repository root. For a separately installed skill, run `npm ci --prefix
<skill-directory>` instead. Dependencies and the standalone lockfile ship with
the skill. Resolve `scripts/cli.mjs` relative to this skill directory, not the
user's project directory.

```bash
node skills/pm4-bpmn-beautify/scripts/cli.mjs report input.bpmn
node skills/pm4-bpmn-beautify/scripts/cli.mjs beautify input.bpmn \
  --output elegant.bpmn --report layout-report.json --preview elegant.svg
```

All output paths must be new and distinct from the input. Parent directories
must exist. Exit status is 0 on success, 1 on invalid input, unsupported full
layout, or I/O failure. `report` writes JSON to stdout unless `--output` is given;
`beautify` also writes its comparison report to stderr.

| Option | Values / default |
|---|---|
| `--layout` | `auto` (default), `preserve` (colors only; keeps all geometry and expansion states) |
| `--theme` | `professional` (default), `monochrome`, `preserve` (retain existing colors) |
| `--subprocesses` | `collapsed` (default), `expanded`, `preserve` (existing DI states; missing state means collapsed) |
| `--direction` | `LR` (default), `TB` |
| `--spacing` | `comfortable` (default), `compact` |
| `--report` | Before/after JSON file (beautify only) |
| `--preview` | Offline schematic SVG file (beautify only) |

## Apply the result

1. Obtain the existing XML. If given an official export or `process_package`,
   extract the intended process's `bpmn` string and replace only that field after
   review; the CLI does not traverse JSON or rebuild packages. For remote reads
   or authorized saves, use [pm4-process](../pm4-process/SKILL.md).
2. Inspect the report and run beautify to new files. Use compact spacing when
   footprint matters; use monochrome for restrained or print-oriented diagrams.
   Respect an explicit request to keep current colors or expansion states.
3. Compare before/after issues, visible area, bends, and length. A larger drawing
   can be more legible; a smaller one is not automatically better. Inspect the
   SVG and then the target PM4 Modeler, especially labels, loops and boundaries.
4. Return the BPMN, report and preview with the remaining limitations. Save or
   publish remotely only within the user's requested scope, using pm4-process.

## Invariants and coverage

- Never change task types, names, ids, flows, conditions, defaults, assignments,
  references, scripts, `pm:config`, or extension elements for aesthetics. A DOM
  comparison verifies all non-DI content after serialization; XML whitespace,
  escaping and attribute formatting may change. DTD/entity declarations are
  rejected. This is not BPMN XSD validation or a runtime correctness audit.
- Keep standard BPMN shapes: events are circles, gateways diamonds, activities
  rounded rectangles. Resize activities for their labels; do not decorate them
  with shapes that change their meaning. Both `bioc` and BPMN-in-Color attributes
  are emitted on DI. Actual color rendering depends on the target Modeler.
- Full layout supports **one process or one collaboration with multiple pools**,
  branches, joins, cycles, self-loops,
  disconnected nodes, boundary events and nested embedded/ad-hoc/transaction
  subprocesses. Call Activities stay atomic. Existing subprocesses default to
  collapsed; child semantics and child DI remain on the same plane, preserving
  PM4's single-diagram contract. Check hiding and re-expansion in the target
  Modeler; use `--subprocesses expanded` if that renderer needs expanded DI.
- Pools are aligned and separated by routing corridors. Black-box participants
  (no `processRef`) retain their own empty pool. With a collaboration, every
  process must have exactly one participant and the DI plane references that
  collaboration. Multiple collaborations or alternative laneSets are rejected.
- Lanes and nested lanes become contiguous bands, preserving `flowNodeRef`
  membership and declaration order. `LR` uses horizontal lanes and vertically
  stacked pools; `TB` uses vertical lanes and side-by-side pools. Boundary events
  follow their host's lane. Nodes without membership get an unlabelled band and
  a warning; the CLI does not invent semantic assignments. Conflicting lane
  memberships, cross-scope sequence flows and invalid pool references are errors.
- Message flows are routed between different participants, including endpoints
  on tasks/events or directly on a pool. Routes avoid unrelated pools, visible
  nodes and headers; labels are placed outside pools. The preview uses dashed
  lines, open arrowheads and start circles. Subprocess ancestors of a message
  endpoint remain **expanded**, with a warning, so messages do not terminate on
  hidden children. Other subprocesses still default to collapsed.
- Annotations, groups, data objects/stores, visible data-association edges,
  choreography and conversations still require `--layout preserve`. Semantic
  data associations without DI (such as message payload mappings) are preserved.
  Missing DI is not repaired by preserve mode. If routing or label placement
  cannot find free space, auto mode fails without writing output; try comfortable
  spacing or preserve the input layout.
- Collapsing an existing subprocess is visual. Do not wrap a flat graph in new
  subprocesses automatically: that changes execution scope. If structural phase
  grouping is requested, use [pm4-sub-process](../pm4-sub-process/SKILL.md) and
  [pm4-process](../pm4-process/SKILL.md) before beautifying.
- Reports detect missing shapes/sequence/message edges, invalid geometry,
  nodes outside their containers and visible shape overlaps (excluding valid
  containment and boundary attachment). They measure
  bounds, route length and bends. They do not certify label clearance, edge
  crossings, or obstacle-free routing. SVG previews simplify task/event symbols;
  they are review aids, not authoritative BPMN renderings.

Read [engine-notes.md](references/engine-notes.md) for the engine comparison,
algorithm, palette rationale and extension points. Run the executable tests with
`npm test --prefix skills/pm4-bpmn-beautify` from this checkout, or `npm test` in
the separately installed skill directory.

For a runnable multi-pool example with nested lanes, a boundary event, a retry
loop, a collapsed subprocess and an external participant, use
[collaboration.bpmn](tests/fixtures/collaboration.bpmn) as the input to `beautify`.
