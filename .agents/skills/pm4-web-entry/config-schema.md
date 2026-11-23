# `web_entry` schema

Nested in the node's `pm:config` JSON. Defaults below are the package defaults for keys that are omitted.

## Fields

| Field | Applies to | Default | Notes |
|-------|-----------|---------|-------|
| `screen_id` | Start | `null` | FORM screen id shown at the URL. Required for a Start |
| `completed_action` | Start, Task | `SCREEN` | `SCREEN` or `URL` |
| `completed_screen_id` | when `SCREEN` | `null` | DISPLAY screen id shown after submit |
| `completed_url` | when `URL` | `null` | Redirect target; Mustache allowed (`{{_request.id}}`) |
| `enable_query_params` | Start | `false` | Seeds request data from the query string |
| `require_valid_session` | Task, anonymous | `false` | Only the browser session that created the request can open the task (checked through `_session_id` in request data). Ignored for logged-in users |
| `enable_password_protect` | anonymous | `false` | Gate the entry with a password |
| `password` | anonymous | `null` | Mustache is rendered against request data. Sent by the page in the `webentry-password` header. Clear it when protection is off |
| `exclude_data` | Task | `[]` | Top-level request variable names removed from the payload sent to the browser |
| `embed` | Start, Task | see below | Embed snippet look |
| `webentryRouteConfig` | Start, Task | see below | URL and route settings |

`embed`:

```json
{ "position": "full", "title": "Form", "icon": "question-circle", "color": ["#1f83b4"] }
```

`webentryRouteConfig`:

```json
{
  "nodeId": "node_1",
  "nodeType": null,
  "processId": 1,
  "parameters": [],
  "firstUrlSegment": null,
  "urlType": "standard-url",
  "entryUrl": "https://HOST/webentry/1/node_1"
}
```

| Key | Notes |
|-----|-------|
| `nodeId` | Must equal the BPMN node id. Preserve it exactly |
| `processId` | Instance-specific; the Designer sets it from the open process |
| `urlType` | `standard-url` or `custom-url` |
| `firstUrlSegment` | Custom URL only. Spaces become `-`, lower-cased by the Designer. Must be unique |
| `parameters` | Custom URL only: `[{ "label": "id", "name": "id" }]`; each becomes a `/{name}` path segment |
| `entryUrl` | Derived. `standard-url`: `{app}/webentry/{processId}/{nodeId}`. `custom-url`: `{app}/webentry/{firstUrlSegment}/{param}...` |

Switching `urlType` back to `standard-url` clears `firstUrlSegment` and `parameters`.

## Custom URL uniqueness

The Designer checks a segment with `GET /webentry/custom_route/check/{url}/{process_id}/{node_id}` (HTTP 422 with an `error` message on conflict) and registers it with `PUT /webentry/custom_route/{process_id}/{node_id}/{url}`. An empty segment is invalid. Two nodes in one process also cannot share a segment.

## Disabled and multi-instance

- Disabled: `"web_entry": null`.
- A node with a **parallel** multi-instance loop forces the mode to disabled. Sequential multi-instance is allowed.

## Examples

- [examples/pm-config-start.json](examples/pm-config-start.json): Start, completion screen
- [examples/pm-config-task.json](examples/pm-config-task.json): Form Task, completion URL, hidden variable
- [examples/web-entry-start.bpmn.xml](examples/web-entry-start.bpmn.xml): anonymous Start in a full process (replace `ANONYMOUS_USER_ID`, screen ids, host)
