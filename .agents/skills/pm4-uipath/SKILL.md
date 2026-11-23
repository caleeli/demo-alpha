---
name: pm4-uipath
description: >-
  Configure an existing PM4 UiPath (RPA) Service Task: folder, process,
  machine, bot, input arguments, and response mapping, using package-rpa.
  Use for UiPath/RPA nodes or run failures. Adding the node to the graph uses
  pm4-process. Not REST connectors, Script Tasks, or UiPath Orchestrator setup.
---

# UiPath (RPA) connector

A **UiPath** node is a `bpmn:serviceTask` with `implementation="package-rpa/processmaker-communication-rpa"`. Config lives in **`pm:config`** (JSON). The package is **`package-rpa`**; there is no separate UiPath package. Modeler node id: `processmaker-communication-rpa`.

References: [examples/](examples/) (`pm-config.json`, full BPMN).

## Not this skill

| User wants | Use instead |
|------------|-------------|
| Call a REST API | [pm4-data-connector](../pm4-data-connector/SKILL.md) |
| Run PHP/Lua/JS in the engine | [pm4-script](../pm4-script/SKILL.md) |
| Add, place, or connect the node; publish | [pm4-process](../pm4-process/SKILL.md) |
| Mustache / variable syntax only | [pm4-expressions](../pm4-expressions/SKILL.md) |
| Configure Orchestrator credentials | Platform admin |

## Before changing anything

Ask only if missing:

1. **Process** and the node (existing name or id).
2. **UiPath target** — folder, process, machine, and bot to run.
3. **Inputs** — which request variables feed which process input arguments.
4. **Outputs** — which response fields go to which request variables.

Pick the four target objects from the UiPath integration of the package on this instance. **Never invent folder, process, machine, or bot ids.**

## `pm:config`

```json
{
  "selectedFolder": { "id": 1, "name": "Default" },
  "selectedProcess": { "Id": "proc-1", "Name": "InvoiceBot" },
  "selectedMachine": { "Id": "m1", "Name": "Host" },
  "selectedBot": { "Id": "b1", "Name": "Bot" },
  "inboundConfig": [{ "key": "orderId", "value": "order_id" }],
  "dataMapping": [{ "key": "rpa_status", "value": "status", "format": "dotNotation" }]
}
```

| Key | Required | Notes |
|-----|----------|-------|
| `selectedFolder` | yes | Object from the folder select |
| `selectedProcess` | yes | UiPath process object (`Id`, `Name`) |
| `selectedMachine` | yes | Machine object |
| `selectedBot` | yes | Bot object |
| `inboundConfig` | no | `{ key, value }`: `key` is the UiPath input argument, `value` the request variable |
| `dataMapping` | no | `{ key, value, format }`: `key` is the request variable, `value` the response path |

Optional on the node: `pm:errorHandling` (`timeout`, `retry_attempts`, `retry_wait_time`; see [pm4-script](../pm4-script/SKILL.md#script-task-node) for the key format).

## Rules

1. The `implementation` string is `package-rpa/...`. Never write `connector-uipath/...`.
2. The four `selected*` values are **objects** from the API, not plain name strings.
3. `package-rpa` must be installed and the Orchestrator credentials configured.
4. Variables named in `inboundConfig` must exist in request data when the node runs.

## Check

```
- [ ] bpmn:serviceTask with implementation="package-rpa/processmaker-communication-rpa"
- [ ] pm:config valid JSON with selectedFolder, selectedProcess, selectedMachine, selectedBot as objects
- [ ] inboundConfig keys match the bot's input arguments; values exist upstream
- [ ] dataMapping keys are the request variables downstream steps read
- [ ] Process saved and published
```

Minimal example: [examples/uipath-service-task.bpmn.xml](examples/uipath-service-task.bpmn.xml).
