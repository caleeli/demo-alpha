---
name: pm4-idp
description: >-
  Configure an existing PM4 IDP (Intelligent Document Processing) Service Task:
  send an uploaded file to the ProcessMaker IDP server with a document type and
  destination folder, using connector-idp. Use for IDP nodes, fileId, document
  type, folder, split document, or idp_errors. Adding the node to the graph
  uses pm4-process. Not File Upload controls, Send Email, or generic REST calls.
---

# IDP connector

An **IDP** node is a `bpmn:serviceTask` with `implementation="connector-idp/processmaker-communication-idp"`. It uploads a file from the request to a ProcessMaker IDP server, waits for extraction, and returns the extracted data. Config lives in **`pm:config`** (JSON). Package: `processmaker/connector-idp`. Modeler node id: `processmaker-communication-idp`, label **IDP**, default name `Intelligent Document Processing`. The node supports the standard Loop Activity panel.

This skill wires the node. It does not connect the IDP account. **Settings → Integrations → IDP** (host, token URL, client id/secret, folders, **Authorize Account**) must be done first.

References: [examples/](examples/) (`pm-config.json`, `pm-config-variables.json`, full BPMN).

## Not this skill

| User wants | Use instead |
|------------|-------------|
| A File Upload control on a screen | [pm4-screen](../pm4-screen/SKILL.md) |
| Add, place, or connect the node; publish | [pm4-process](../pm4-process/SKILL.md) |
| Call another REST API | [pm4-data-connector](../pm4-data-connector/SKILL.md) |
| Email the extracted result | [pm4-send-email](../pm4-send-email/SKILL.md) |
| AI agent reasoning over text | [pm4-flow-genie](../pm4-flow-genie/SKILL.md) |
| Mustache / variable syntax only | [pm4-expressions](../pm4-expressions/SKILL.md) |
| Connect the IDP account | Platform admin (Settings → Integrations → IDP) |

## Before changing anything

Ask only if missing:

1. **Process** and the node (existing name or id).
2. **Input file** — the request variable that holds the uploaded file (a File Upload variable populated by an earlier task).
3. **Document type** — fixed (from the IDP list) or taken from a request variable.
4. **Destination folder** — fixed (from the folders configured in Settings) or taken from a request variable.
5. **Split** — whether to split the document into individual pages.

Look up document types and folders on the instance (below). **Never invent document type or folder ids.**

## `pm:config`

Fixed document type and folder (picked from the inspector lists):

```json
{
  "fileId": "idp_file",
  "document_type": { "id": "…", "name": "INVOICE" },
  "destination": { "id": "…", "name": "TRAINING" },
  "useDocumentTypeRequestVariable": false,
  "useDestinationRequestVariable": false,
  "splitDocument": false
}
```

Document type and folder from request data: [examples/pm-config-variables.json](examples/pm-config-variables.json).

| Key | Required | Notes |
|-----|----------|-------|
| `fileId` | yes | **Request variable name** (dot path allowed, e.g. `uploads.invoice`), **not** Mustache. Holds the file id of one upload, or an array of `{ "file": <id> }` objects for several files |
| `document_type` | yes | Flag `false`: an **object** `{ id, name }`; the runtime sends `name`. Flag `true`: a Mustache string (`{{document_type}}`) rendered against request data |
| `useDocumentTypeRequestVariable` | yes | `true` when `document_type` is a Mustache string |
| `destination` | yes | Flag `false`: an **object** `{ id, name }`; the runtime sends `id`. Flag `true`: a Mustache string that is a folder **name** |
| `useDestinationRequestVariable` | yes | `true` when `destination` is a Mustache string |
| `splitDocument` | no | `true` splits the upload into single pages (sent only when truthy) |

Folder by name: the runtime looks the name up (case-insensitive) in the folders configured in Settings (`idp.folder_ids`). If none matches, it **creates** a `DOSSIER` folder on the IDP server with that name.

A freshly dropped node has `fileId`, `document_type` and `destination` set to `null`. The Designer shows both pickers as required.

## Look up ids

```
GET /api/1.0/connector-idp/get-document-types      -> [{ "name": "INVOICE", "id": "…" }]
GET /api/1.0/connector-idp/get-settings-folders    -> folders configured in Settings [{ "name", "id" }]
```

Both need the account authorized (the call fails with missing/invalid configuration otherwise).

## Result and errors

- The node returns the IDP file record (extracted data under `data.attributes`, e.g. `fullText`). With several files the result is an array with one entry per file.
- The runtime polls for the extraction up to 5 times, 10 seconds apart. The task blocks while polling.
- Failures do **not** raise an error: the node returns `{ "idp_errors": "<message>" }` and the process continues. A duplicate file name on the IDP server is reported this way. Route on `idp_errors` downstream if the process must not continue.

## Rules

1. Exact `implementation` string; the element is a Service Task.
2. `fileId` is a variable name. Do not wrap it in `{{ }}`.
3. With a flag `false`, `document_type` and `destination` must be objects, not strings. A string with a flag `false` fails at runtime.
4. The file variable must be populated before the node runs ([pm4-screen](../pm4-screen/SKILL.md) File Upload on an earlier Form Task).
5. Importing a process with this node into an instance that has no IDP settings fails with an IDP configuration error. Configure the IDP integration on the target first. Re-check folder ids after import.
6. `connector-idp` must be installed (`php artisan connector-idp:install`), the account authorized, and a websocket/queue environment running for the progress notifications.

## Check

```
- [ ] bpmn:serviceTask with implementation="connector-idp/processmaker-communication-idp"
- [ ] pm:config valid JSON; fileId is a plain variable name that exists upstream
- [ ] document_type / destination are objects (flag false) or Mustache strings (flag true)
- [ ] Ids came from get-document-types / get-settings-folders on this instance
- [ ] Downstream steps read the extracted data or check idp_errors
- [ ] Process saved and published
```

Minimal example: [examples/idp-service-task.bpmn.xml](examples/idp-service-task.bpmn.xml).
