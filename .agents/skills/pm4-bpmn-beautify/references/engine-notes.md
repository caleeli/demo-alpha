# Engine choice and implementation notes

Research checked 2026-11-16. Check installed versions before relying on upstream
`main` documentation; it may describe unreleased APIs.

| Tool | Strength | Decision |
|---|---|---|
| [bpmn-auto-layout](https://github.com/bpmn-io/bpmn-auto-layout) | BPMN-aware DI generation; current main documents dedicated layout rules | npm resolved to 1.3.0 during implementation, while main documents a different return contract. Useful inspiration; not a runtime dependency of this CLI. |
| [ELK / elkjs](https://github.com/kieler/elkjs) | Directed graph layout, orthogonal routing, ports, edge labels, cycles and compound graphs | Use elkjs 0.12.1 with a small explicit BPMN adapter. |
| [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) | Layer assignment, crossing minimization, coordinate assignment, routing | Prefer this to hand-written topological placement; loops and fan-out need routing as well as coordinates. |
| [bpmn-js colors example](https://github.com/bpmn-io/bpmn-js-examples/tree/main/colors) | Colors stored in portable BPMN DI extensions | Emit both bioc and BPMN-in-Color properties; verify the actual PM4 renderer. |

ELK is a general graph engine, not a complete BPMN layout engine. In particular,
compound graph support alone does not provide semantically correct swimlanes,
pool ownership, message routing or BPMN label placement. `swimlanes.mjs` adds
ownership validation and band geometry; `routing.mjs` adds orthogonal routing
after lane placement and between participants.

## Pipeline

1. Parse namespace-aware XML with @xmldom/xmldom 0.9.12. Reject malformed XML,
   DTDs and duplicate ids. Preserve unknown extensions with a DOM rather than
   round-tripping through a BPMN metamodel that may omit vendor properties.
2. Inventory diagram metrics and visible shape issues, ignoring descendants of
   collapsed subprocesses and intentional containment/attachment overlap.
3. Validate full-layout support and sequence-flow scope. Lay out child scopes
   bottom-up, using each expanded child's dimensions in its parent's graph.
4. Treat a boundary event as a fixed-side south port on its host. ELK reserves
   space for that port and routes its outgoing edges. Render it as an attached
   circle. Keep Call Activities atomic; never fetch child processes.
5. Run layered layout with orthogonal edges, fixed random seed, model-order
   hints, measured edge labels and approximate activity text dimensions. Size
   events at 36×36 and gateways at 50×50. Activities start at 150×80 and grow for
   longer labels. Dock rectangular ELK endpoints to actual circles/diamonds.
6. For scopes with lanes, retain ELK's main-axis ranks and repack the cross axis
   into ordered semantic bands. Parent lanes wrap their child bands; empty lanes
   retain space. Reserve header strips, node labels and boundary attachments.
   Reroute sequence flows after moving nodes, keeping routes inside their scope.
7. Align participant bounds and stack them across the flow direction. Leave
   corridors between pools and around the collaboration. Route message flows
   using visible nodes, headers and unrelated pools as obstacles. Explicitly
   expand ancestors of message endpoints so their targets remain visible.
8. Replace DI geometry and label bounds; retain existing shape/edge attributes.
   Child DI remains on the same plane even when hidden by a collapsed parent.
   Apply colors, serialize and compare the non-DI DOM against the original.
9. Emit comparison JSON and optionally an SVG without external resources.

## Swimlane routing

The orthogonal router builds a visibility grid from obstacle boundaries,
terminal ports and scope bounds. A* search uses Manhattan distance plus bend,
crossing and shared-segment penalties. Prior sequence/message routes influence
later message routes; crossings are penalized, not prohibited. Node rectangles
have clearance margins. Terminal stubs dock at side centers, which are valid
for circles and diamonds as well as activities. Boundary events leave south.

Lane routing keeps nodes inside the original process and deepest declared lane.
Redundant membership in a parent lane is allowed; membership in unrelated lanes
is not. Unassigned nodes occupy a separate unlabelled band, with a warning.
Input semantics and membership references are never rewritten.

Message routes may traverse their own source/target pool but cannot traverse a
third pool. Headers and visible labels are obstacles. Labels are fitted beside
route segments with pool bounds reserved. The router does not promise globally
minimal crossings or complete label/edge separation. It fails explicitly when
no supported route/label placement exists or its grid exceeds 250,000 vertices;
there is no fallback that draws through an obstacle. Use smaller scopes or
preserve mode for such inputs.

The layout is deterministic for fixed input/options/dependency versions, but is
not an optimizer over the report metrics. Text sizing is approximate and depends
on font/rendering; large labels and multiple boundary events deserve inspection.
Full layout replaces diagram/plane metadata and label geometry. Preserve mode
retains that metadata as well as geometry. This matters for renderer-specific DI
extensions and hand-tuned diagrams.

## Palette

`professional` uses pale slate/blue for human work, teal for automation, indigo
for subprocesses, amber for decisions, green for start and rose for end. Dark
outlines and dark text remain readable against the pale fills. `monochrome`
retains distinctions with white/slate fills. Colors never encode routing logic
and are not a substitute for labels or BPMN markers. SVG text uses dark slate;
the BPMN viewer controls its own text rendering.

## Extending safely

Keep regression fixtures for nested/empty lanes, cross-lane flows, black-box
pools, reverse messages and messages bypassing an intermediate pool. Check both
orientations. Do not replace semantic bands with freely packed compound nodes;
that can produce misleading swimlane geometry. Multiple alternative laneSets,
shared process references and multiple collaborations require an explicit
selection policy before they can be laid out safely.

For a new palette, add a theme in `scripts/beautify.mjs` with the existing
category keys. For another input envelope, implement explicit JSON field
selection and preserve all other package fields; do not guess which process to
modify. Any new transformation must preserve the semantic DOM invariant.

Testing covers extensions/CDATA/PM attributes, nested DI preservation,
expanded containment, boundary attachment, cycles/self-loops, direction,
determinism, unsupported constructs, malformed input, color-only mode,
offline previews, pool/lane containment, cross-pool routing, invalid ownership,
message endpoint visibility and CLI overwrite protection. Target PM4 import/rendering
remains a separate integration check; this repository test does not start cases.
