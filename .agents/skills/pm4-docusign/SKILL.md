---
name: pm4-docusign
description: >-
  Configure an existing PM4 DocuSign template node: a Call Activity that sends
  an envelope from a DocuSign template, maps roles to recipients, and can wait
  for signing, using connector-docusign. Use for DocuSign nodes, templateRoles,
  or envelope failures. Adding the node to the graph uses pm4-process. Not
  Send Email or DocuSign account setup.
---

# DocuSign connector

A **DocuSign** node is a **`bpmn:callActivity`**, not a Service Task. It calls the seeded sub-process `DocuSignSendEnvelope` and shows a wait screen while the envelope is signed. Config lives in **`pm:config`** (JSON). Package: `connector-docusign`. Modeler node id: `docusign-template`.

References: [examples/](examples/) (`pm-config.json`, full BPMN).

## Not this skill

| User wants | Use instead |
|------------|-------------|
| Email notification or attachment | [pm4-send-email](../pm4-send-email/SKILL.md) |
| Email reply decision | [pm4-action-by-email](../pm4-action-by-email/SKILL.md) |
| Generic Call Activity / sub-process wiring | [pm4-sub-process](../pm4-sub-process/SKILL.md) |
| Add, place, or connect the node; publish | [pm4-process](../pm4-process/SKILL.md) |
| Connect the DocuSign account (OAuth consent) | Platform admin |

## Before changing anything

Ask only if missing:

1. **Process** and the node (existing name or id).
2. **Template** — the DocuSign template to send.
3. **Recipients** — who fills each template role.
4. **Wait** — whether the process waits until the envelope is completed, and which variable stores the result.

Fetch templates and roles from the instance (`GET /api/1.0/docusign/templates`, `GET /api/1.0/docusign/templates/{templateId}`). **Never invent template or role ids.**

## Node attributes

| Attribute | Value |
|-----------|-------|
| element | `bpmn:callActivity` |
| `calledElement` | `ProcessId-{id}` of the seeded `DocuSignSendEnvelope` sub-process on this instance |
| `pm:allowInterstitial` | `"true"` |
| `pm:interstitialScreenRef` | `DocuSignWait` (the seeded wait screen) |
| `pm:config` | JSON, below |

Modeler recognizes the node only when `calledElement` is the DocuSign sub-process **and** `config.contentType` is `template`.

## `pm:config`

```json
{
  "contentType": "template",
  "templateId": "<docusign-template-id>",
  "documentName": "Contract",
  "templateRoles": [{ "recipientId": "1", "roleName": "Signer", "type": "requester" }],
  "waitCompleted": true,
  "outputVariable": "envelope"
}
```

| Key | Required | Notes |
|-----|----------|-------|
| `contentType` | yes | Must be `template` |
| `templateId` | yes | DocuSign template id |
| `templateRoles` | yes | One entry per template role; empty means nothing to sign |
| `documentName` | no | Default `Document` |
| `waitCompleted` | no | `true` waits for the completed signature |
| `outputVariable` | no | Request variable for the envelope result |
| `content`, `screenId` | legacy | Leave empty; the template defines the document |

### `templateRoles[]`

Start from the role objects the template endpoint returns (they carry `recipientId`, `roleName`, `routingOrder`, ...), then set how the recipient is resolved:

| `type` | Extra field |
|--------|-------------|
| `user` | `selectedRecipient` (user object) and `selectedRecipientId` |
| `requester` | none |
| `userId` | `selectedRecipientId` (may be a Mustache expression) |
| `email` | `email` (and `name`), Mustache allowed |
| `manager` | none (the Process Manager) |

Roles with recipient type `witness`, `inpersonsigner` (including notary) are **not configurable** here: set them inside the DocuSign template.

When a role is `type: "user"`, export/import carries the user as a dependency of the process.

## Rules

1. Keep the three node attributes together: `calledElement`, `pm:allowInterstitial`, `pm:interstitialScreenRef`. Without the interstitial pair the wait UI can hang.
2. `calledElement` is instance-specific (`ProcessId-{id}`); re-check it after import on another instance.
3. `connector-docusign` must be installed and the DocuSign account connected (`GET /api/1.0/docusign/check-token`).
4. Do not remove template-provided role fields when editing one role; replace only `type` and its extra field.

## Check

```
- [ ] bpmn:callActivity with calledElement of the DocuSign sub-process on this instance
- [ ] pm:allowInterstitial="true" and pm:interstitialScreenRef="DocuSignWait"
- [ ] pm:config valid JSON: contentType "template", templateId, templateRoles
- [ ] Every configurable role has a type and its extra field
- [ ] outputVariable set when later steps read the envelope result
- [ ] Process saved and published
```

Minimal example: [examples/docusign-call-activity.bpmn.xml](examples/docusign-call-activity.bpmn.xml).
