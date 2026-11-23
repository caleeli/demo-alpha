---
name: pm4-slack
description: >-
  Configure an existing PM4 Slack Notification Service Task: post a Mustache
  message to a Slack channel with channel and textBody, using connector-slack.
  Use for Slack nodes or channel/post failures. Adding the node to the graph
  uses pm4-process. Not Send Email, REST calls, or Slack app administration.
---

# Slack Notification connector

A **Slack Notification** node is a `bpmn:serviceTask` with `implementation="connector-slack/processmaker-communication-slack"`. Config lives in **`pm:config`** (JSON). Package: `connector-slack`. Modeler node id: `processmaker-communication-slack`.

References: [examples/](examples/) (`pm-config.json`, full BPMN).

## Not this skill

| User wants | Use instead |
|------------|-------------|
| Email notification | [pm4-send-email](../pm4-send-email/SKILL.md) |
| Call any other REST API | [pm4-data-connector](../pm4-data-connector/SKILL.md) |
| Add, place, or connect the node; publish | [pm4-process](../pm4-process/SKILL.md) |
| Mustache syntax only | [pm4-expressions](../pm4-expressions/SKILL.md) |
| Create the Slack app / connect the workspace | Platform admin (Admin → Integrations) |

## Before changing anything

Ask only if missing:

1. **Process** and the node (existing name or id).
2. **Channel** — which Slack channel receives the message.
3. **Message** — text, with `{{var}}` placeholders.

Look up channels from the instance (`GET /connector-slack/get-channels`, needs the Slack integration configured). **Never invent a channel id.**

## `pm:config`

```json
{
  "channel": { "id": "C0123456789", "name": "general" },
  "textBody": "Case {{case_number}} is done"
}
```

| Key | Required | Notes |
|-----|----------|-------|
| `channel` | yes | The **object** returned by the channels API (`id`, `name`, ...), not a bare id string |
| `textBody` | yes | Message text; Mustache allowed |

## Rules

1. `channel` must be the selected object. A plain `"C012..."` string is invalid.
2. Exact `implementation` string; the element is a Service Task.
3. Every `{{var}}` in `textBody` must exist in request data when the node runs.
4. `connector-slack` must be installed and the Slack workspace connected, or the node fails at runtime.

## Check

```
- [ ] bpmn:serviceTask with implementation="connector-slack/processmaker-communication-slack"
- [ ] pm:config valid JSON; channel is an object with id and name
- [ ] textBody non-empty; its variables exist upstream
- [ ] Channel id came from the channels API on this instance
- [ ] Process saved and published
```

Minimal example: [examples/slack-service-task.bpmn.xml](examples/slack-service-task.bpmn.xml).
