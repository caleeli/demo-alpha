---
name: pm4-pdf-generator
description: >-
  Configure an existing PM4 PDF Generator Service Task: render a Screen to a
  PDF file with screenRef and a Mustache fileName, using connector-pdf-print.
  Use for PDF output nodes or generate failures. Adding the node to the graph
  uses pm4-process. Not Send Email, screen design, or Output Documents from PM3.
---

# PDF Generator connector

A **PDF Generator** node is a `bpmn:serviceTask` with `implementation="connector-pdf-print/processmaker-communication-pdf-print"`. Config lives in **`pm:config`** (JSON). Package: `connector-pdf-print`. Modeler node id: `processmaker-communication-pdf-print`.

The node renders one Screen with the request data into a PDF file attached to the request.

References: [examples/](examples/) (`pm-config.json`, full BPMN).

## Not this skill

| User wants | Use instead |
|------------|-------------|
| Design the layout Screen (DISPLAY, controls) | [pm4-screen](../pm4-screen/SKILL.md) |
| Email the PDF | [pm4-send-email](../pm4-send-email/SKILL.md) (attach the file variable) |
| Add, place, or connect the node; publish | [pm4-process](../pm4-process/SKILL.md) |
| PM3 Output Document migration | [pm3-pm4-output-documents](../pm3-pm4-output-documents/SKILL.md) |
| Mustache syntax only | [pm4-expressions](../pm4-expressions/SKILL.md) |

## Before changing anything

Ask only if missing:

1. **Process** and the node (existing name or id).
2. **Layout screen** — an existing DISPLAY (or suitable print-layout) screen id.
3. **File name** — static text or Mustache with request variables.

Look up the screen id with the Screens API or Designer. **Never invent a screen id.**

## `pm:config`

```json
{
  "screenRef": 42,
  "fileName": "invoice-{{invoice_id}}"
}
```

| Key | Required | Notes |
|-----|----------|-------|
| `screenRef` | yes | Screen id to render as PDF |
| `fileName` | yes | Characters `A-Za-z0-9_.-` plus `{{vars}}`; no trailing `.` |

A freshly dropped node starts with empty config. Set both keys before saving.

## Rules

1. Exact `implementation` string; the element is a Service Task, not a Script Task.
2. Every `{{var}}` in `fileName` and in the screen must exist in request data when the node runs.
3. Invalid file name characters fail at generate time, not at save time.
4. `connector-pdf-print` must be installed on the instance.
5. This `screenRef` belongs to the connector; it is not a Form Task `pm:screenRef`.

## Check

```
- [ ] bpmn:serviceTask with implementation="connector-pdf-print/processmaker-communication-pdf-print"
- [ ] pm:config valid JSON with screenRef (existing screen) and fileName
- [ ] fileName uses only allowed characters and ends without "."
- [ ] Variables used by the screen and fileName are set upstream
- [ ] Process saved and published
```

Minimal example: [examples/pdf-service-task.bpmn.xml](examples/pdf-service-task.bpmn.xml).
