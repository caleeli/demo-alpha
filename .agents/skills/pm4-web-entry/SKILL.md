---
name: pm4-web-entry
description: >-
  Configure an existing PM4 web_entry object in pm:config: a public or
  login-gated URL, anonymous or authenticated mode, password, completion
  screen or URL, query parameters, custom URL, embed, and route conflicts.
  Only when the request edits web_entry. An anonymous HTML web entry that
  renders a dynaform is pm3-web-entry. Display Next Assigned Task and the
  interstitial screen are pm4-process.
---

# PM4 Web Entry

**Web Entry** lets someone start a request (or open a task) from a URL outside the Designer. It is not a node. It is a `web_entry` object nested inside the **`pm:config`** JSON of a **Start Event** (`bpmn:startEvent`) or a **Form Task** (`bpmn:task`). Package: `processmaker/package-webentry`; its inspector is registered only on those two node types.

References: [config-schema.md](config-schema.md) (every field, defaults, URLs), [examples/](examples/) (Start BPMN, Start and Task `pm:config`).

## Not this skill

| User wants | Use instead |
|------------|-------------|
| Start Event type, timer/message/signal, start permissions, interstitial | [pm4-process](../pm4-process/SKILL.md) ([events.md](../pm4-process/events.md)) |
| Form Task screen, assignment, due date | [pm4-form-manual-task](../pm4-form-manual-task/SKILL.md) |
| Design the public FORM / completion DISPLAY screen (Captcha, fields) | [pm4-screen](../pm4-screen/SKILL.md) |
| Child process start for a Call Activity | [pm4-sub-process](../pm4-sub-process/SKILL.md) |
| PM3 `WEB_ENTRY` / `webEntryEvent` conversion | [pm3-pm4-web-entry](../pm3-pm4-web-entry/SKILL.md) |
| Generic 422 / pagination | [pm-api-contracts](../pm-api-contracts/SKILL.md) |

## Before changing anything

Ask only if missing:

1. **Process** and **node** (Start Event or Form Task).
2. **Mode** — anonymous (no login) or authenticated (login required).
3. **Screens** — the public start FORM (Start only) and what happens after submit: a completion DISPLAY screen or a redirect URL.
4. **Extras** — password, query-string data, custom URL, embed, variables to hide from the browser.

Look up screen ids; **never invent them**. Show the user the affected node ids and the before/after fields before editing an existing `web_entry`.

## Where it lives

```json
{
  "web_entry": { "...": "object = enabled" },
  "selfService": false
}
```

- `web_entry` **object** = enabled. `web_entry: null` = **disabled**. Never replace `null` with `{}`.
- Keep sibling keys of `pm:config` (`email_notifications`, `selfService`, ...). Decode the escaped JSON, change `web_entry`, re-encode.
- `pm:config` is not a top-level `pm:webEntry` attribute.

## Mode is not a field

There is no `mode` key in `web_entry`. The Designer derives it:

| Mode | How it is stored |
|------|------------------|
| `DISABLED` | `web_entry: null` |
| `ANONYMOUS` | Node assignment is the **anonymous user**: Start Event `pm:assignment="user"`, Form Task `pm:assignment="user_group"`, with `pm:assignedUsers` = the instance's anonymous user id and empty `pm:assignedGroups` |
| `AUTHENTICATED` | `web_entry` is an object and the assignment is anything else |

Consequences:

1. Switching to `ANONYMOUS` **overwrites the node's assignment**. On a Form Task this wipes real assignees. Confirm before doing it.
2. Switching away from anonymous clears that assignment (`assignment` empty), so a task needs a new assignment afterward ([pm4-form-manual-task](../pm4-form-manual-task/SKILL.md)).
3. The anonymous user id is instance-specific. Read it from the instance; never copy it between environments.

## Required (enabled `web_entry`)

1. **Start Event**: `screen_id` is the FORM screen shown at the URL.
2. **Form Task**: the task's own `pm:screenRef` is the primary UI. `web_entry.screen_id` is usually `null`; do not invent one.
3. **After submit**: `completed_action` is `SCREEN` (set `completed_screen_id`, a DISPLAY screen) or `URL` (set `completed_url`, Mustache allowed). The inspector requires a URL when `URL` is chosen; set a screen when `SCREEN`.
4. **Password protect** (anonymous only): `enable_password_protect: true` needs a non-empty `password` (Mustache rendered against request data).
5. **Not for parallel multi-instance tasks**: Web Entry is disabled when the node has a parallel multi-instance loop.

Field details and defaults: [config-schema.md](config-schema.md).

## URLs

| Node | URL |
|------|-----|
| Start (standard) | `/webentry/{processId}/{nodeId}` |
| Start (custom) | `/webentry/{firstUrlSegment}/{param1}/{param2}` |
| Form Task | `/webentry/request/{{ _request.id }}/{nodeId}` |

`entryUrl` and `webentryRouteConfig.processId` are **environment-specific**. Do not copy hosts or process ids between instances, and do not rewrite them after a pull to "match" the XML. Embed: append `/embed` to the entry URL.

## Workflow

```
- [ ] 1. Confirm package-webentry is installed and the node is a Start Event or Form Task
- [ ] 2. Read the node's pm:config; note whether web_entry is null or an object
- [ ] 3. Decide mode; warn if ANONYMOUS will replace an existing assignment
- [ ] 4. Look up screen ids (Start screen_id, completed_screen_id)
- [ ] 5. Edit only web_entry (and the assignment fields the mode implies); keep other pm:config keys
- [ ] 6. For a custom URL: pick firstUrlSegment and check it is free (config-schema.md)
- [ ] 7. Save + Publish. Test the URL (private window for anonymous) only if asked
```

## Do not

- Point a Call Activity at a Web Entry-only Start Event. A sub-process start must be a plain Start Event ([pm4-sub-process](../pm4-sub-process/SKILL.md)).
- Turn on the interstitial for a Start Event that should go straight to the public form ([pm4-process events](../pm4-process/events.md)).
- Add Web Entry to a Manual Task or other node types.
- Hand-edit numeric screen ids in a git BPMN: with deploy-process use `${screen:title}` for `web_entry.screen_id` and `web_entry.completed_screen_id` only ([bpmn-document.md](../pm4-process/bpmn-document.md#portable-references-deploy-process)); every other nested id stays numeric.

## Check

```
- [ ] web_entry is an object (enabled) or null (disabled) on purpose; JSON valid
- [ ] Other pm:config keys preserved
- [ ] Start: screen_id is an existing FORM screen. Task: pm:screenRef set, screen_id null or valid
- [ ] completed_action matches its target (completed_screen_id or completed_url)
- [ ] Anonymous: assignment equals the anonymous user; password present if enabled
- [ ] No parallel multi-instance loop on the node
- [ ] Custom URL: firstUrlSegment non-empty, lower-case, unique across processes
- [ ] webentryRouteConfig.nodeId equals the BPMN node id
```
