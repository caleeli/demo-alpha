---
name: pm4-screen
description: >-
  Create, edit, publish, import/export, and debug PM4 FORM, DISPLAY,
  CONVERSATIONAL, and EMAIL screens. FORM/DISPLAY default to Vue Component
  Editor (styles, calcs, watchers inside the SFC); traditional Screen Builder
  controls/CSS/watchers/calcs only when the user explicitly asks. Process-scoped
  refactor must ask the user about subprocess screens and about tenant design-token
  skills (via get-mcp-guidance) before SFC or MCP screen work when Figma/tokens
  were not given. Not task wiring (pm4-form-manual-task), process graphs
  (pm4-process), AI generation, or request execution.
---

# PM4 Screen

A **screen** is a row in `screens`: metadata (`title`, `description`, `type`, category) plus JSON columns the Screen Builder edits: `config` (pages and controls), `watchers`, `computed`, `preview_presets` (named Preview payloads), and a `custom_css` string. Processes and packages point at a screen by **numeric id**.

This skill works on an **existing** instance. Do not create a demo process, start a request, or complete a task unless the user asked.

## Mandatory user gates (blocking)

Agents **violate this skill** if they skip these asks or proceed with styling/SFC/MCP work before the user answers. Applies to **process-scoped screen refactor** (user names a process or “screens of process X”), **multi-screen** Vue refactors, and **new styled** FORM/DISPLAY — not to a single parity-only bugfix on one screen.

**Trigger phrases (non-exhaustive):** “refactoriza los screens del proceso”, “refactor screens of process …”, “restyle all screens in …”, “redesign the workflow UI”, building a **new** solution process with new task screens.

When the user asked to **refactor or optimize the whole process** (not screens alone), load [pm4-process-refactor](../pm4-process-refactor/SKILL.md) first for **Gate 0 delivery mode** (update A, Alternative B, or new process), then return here for Gates A/B/C per screen batch.

### Gate A — Subprocess screen scope

1. Load parent BPMN (`get-process` or equivalent). If there is any embedded `bpmn:subProcess` / `adHocSubProcess` / `transaction` with inner screen refs **or** any `bpmn:callActivity` whose child process has screen refs → **stop**.
2. **Ask the user once** (message or `AskQuestion`): *Do you also want to refactor screens used inside this process's **subprocesses** (embedded phases and Call Activity child processes)?* Options: **Yes** / **No (parent only)**.
3. **Do not continue until answered:** no subprocess inventory walk, no bulk `get-screen`, no Vue SFC edits, no `create-screen` / `update-screen`, no production build of the generated package for the batch.
4. **Skip the ask only if** the user already said include subprocesses / whole solution / parent and children, or the BPMN has **no** subprocess/call-activity children with screens.

### Gate B — Tenant design system / tokens

1. After ProcessMaker Screens MCP `get-mcp-guidance`, read the **skills catalog**. Collect **design token / design system** skills: entries whose **title** or **`when`** clearly target tokens, restyling, or visual styling for screens (e.g. `Design Tokens Byewind Light`, `Design Tokens Byewind Dark`). Do **not** load every skill; filter first.
2. If the user did **not** already give Figma, a named token system, or “parity only / no redesign” in this thread ([design-system.md](design-system.md#skip-the-design-ask)):
   - **≥1 design skill:** **stop and ask** — one skill: *Apply **{title}**?* (yes/no); **2+:** *Use a design system?* then *which?* (list titles). **Never** call `get-mcp-skill` on a token skill or apply token SCSS until the user chooses or declines.
   - **0 design skills:** no ask; parity-first styling only.
3. **Do not continue until answered** (when ≥1 skill): no `get-mcp-skill` for token skills, no `byewind-tokens.scss`-style theming, no “make it nicer” chrome beyond field parity.
4. **After the user picks Light or Dark:** every SFC in the batch (FORM and DISPLAY, including summaries) must follow [design-system.md — SFC theme contract](design-system.md#sfc-theme-contract-light-or-dark). Run the pre-build theme grep before `npm run prod` / MCP `update-screen`.

### Gate C — Refactor completion (blocking)

**Before** the first `update-screen` / publish on a traditional → Vue rewrite, and **again before** marking that screen done in a batch:

1. Complete the per-screen inventory in [refactor-parity.md](refactor-parity.md#inventory-first) and the **parity trace** in [refactor-parity.md](refactor-parity.md#refactor-completion-gate-blocking) (every calc → SFC, every watcher → script/UI trigger, every `conditionalHide` branch → preset).
2. **Do not** call `update-screen` with only fields + submit if the inventory still has unchecked rows (watchers, orphan `custom_css` selectors, nested HTML summaries, help assets).
3. **Do not** declare a screen refactored in handoff / vault until Gate C checklist passes and `preview_presets` cover **each** visible branch (including watcher trigger paths).

Skipping Gate C to “ship the easy screens first” **violates this skill** even when the user asked for a batch or subprocess scope.

**Order:** Gate A → Gate B → **inventory + parity trace per screen** → SFC → catalog/build/publish → validate-screen → `update-screen` → **Gate C verify** → next screen.

References: [vue-component-editor.md](vue-component-editor.md) (**read first for every new or refactored FORM/DISPLAY**), [vue-domain-fields.md](vue-domain-fields.md) (uploads, catalog selects, signatures; calcs/watchers/CSS in the SFC), [refactor-parity.md](refactor-parity.md) (traditional → Vue rewrite; **static `/public-files` assets**; **process subprocess scope**), [design-system.md](design-system.md) (**tenant design skills / tokens** — MCP ask before styled create/refactor), [preview-presets.md](preview-presets.md) (**required** sample Preview data on create/refactor), [architecture.md](architecture.md) (storage, versions, drafts, rendering), [screen-types.md](screen-types.md), [screen-config.md](screen-config.md) (builder-loadable config and completion requirements), [config-schema.md](config-schema.md), [controls.md](controls.md), [watchers.md](watchers.md) (traditional SB watchers only), [templates.md](templates.md), [asset-map.md](asset-map.md) (API, files), [verify.md](verify.md) (checks, failures). Examples: [examples/](examples/).

User docs: [Screens](https://docs.processmaker.com/docs/screens). Where they disagree with these files, trust these files: they were checked against the code and a running instance. Known differences:

- Screen names: the docs allow letters, digits, apostrophes, and spaces. The `alpha_spaces` rule also accepts `-`, `_`, and `.` (see Asset schema).
- Submit Button: the docs say it is only on FORM screens. EMAIL screens offer it too (`connector-send-email` `typeEmail.js`), and it renders as an Actions by Email link ([screen-types.md](screen-types.md#email)).
- "Do Not Submit, Set Value" (Regular Button) doesn't just set the value. Each click toggles it between the value and `null` ([controls.md](controls.md#buttons)).

## When to use

- Create, edit, duplicate, publish, or delete a screen of any type.
- Add or change UI, nested screens, or (on the Vue path) component-level styles / calcs / script calls.
- Save a screen as a template, create a screen from a template, or apply a template.
- Export or import screens, or check what travels with them.
- A screen that won't open in Screen Builder, loses its changes on save, or renders empty.

## Vue Component Editor rule (default)

**Every new FORM/DISPLAY screen, and every rewrite/refactor of an existing FORM/DISPLAY, must use the Vue component Editor** (`VueComponentRenderTemplate`) with a thin `contentVue` mount of a registered Vue component. Do not build the main layout from native controls. A dashboard DISPLAY screen may add native `SavedSearchChart` controls beside the Vue mount. Rules, core and legacy control shapes, component availability, and domain fields (uploads, catalog selects, signatures): [vue-component-editor.md](vue-component-editor.md). The Vue control on DISPLAY screens depends on a core change that may not be on every instance; check the palette before building one (same file, DISPLAY prerequisite).

Put **CSS, calculated properties, and watcher-equivalent logic inside the Vue SFC**. On the screen row send `computed: []`, `watchers: []`, and prefer `custom_css: null` (optional full-height renderer stub only). Domain fields (upload, catalog select, signature): [vue-domain-fields.md](vue-domain-fields.md). Control shape and registration: [vue-component-editor.md](vue-component-editor.md).

A rewrite must keep the original's fields, behavior, calcs, watchers, nested screens, and help content: [refactor-parity.md](refactor-parity.md).

**Preview presets (hard rule).** On every create and every Vue refactor, ship `preview_presets` that cover empty/start, happy path, and each major UI branch. Each preset's `data` is a **JSON string**. See [preview-presets.md](preview-presets.md).

**No hybrids. No silent native fallback.** `page.items` for a Vue FORM/DISPLAY is **only** one `VueComponentRenderTemplate` (plus a thin Submit `FormButton` only when the SFC does not own submit). Never ship `FormInput` / `FormSelectList` / `FormHtmlViewer` / etc. beside or instead of the Vue mount because `validate-screen` warned `prefer_vue_component_editor`, because Figma was unavailable, or because the SFC was not registered yet. If the component key does not exist yet: create/register/build/publish the SFC (or `custom://`) **first**, then create/update the screen. Stop and tell the user if the generated package / Vue Component Editor is missing — do not invent a native layout.

### ProcessMaker Screens MCP (hard rule)

When creating or updating FORM/DISPLAY screens through the **ProcessMaker Screens MCP** (`create-screen`, `update-screen`, `validate-screen`) — including as part of building a process — agents **must**:

0. Complete **[Mandatory user gates](#mandatory-user-gates-blocking)** (subprocess scope, then design system via `get-mcp-guidance` + user choice per [design-system.md](design-system.md)).
1. **Create the Vue SFC first in the generated package you are working in** (created from `package-skeleton`), under its project folder: `resources/js/projects/{camelSlug}/{screenFolder}/{ScreenName}.vue`, with project-shared pieces in `resources/js/projects/{camelSlug}/shared/` and package-wide pieces in `resources/js/projects/shared/` ([layout](vue-component-editor.md#generated-package-components-where-sfcs-live)). `shared` and `components` are literal names — never a folder called `{components}` (zsh `mkdir {components}` keeps the braces). Create `components/` only when a child `.vue` exists. Add `{ name, key }` to that package's `public-screen-components.json`, build (`npm run prod`), and `php artisan vendor:publish --tag={package-name} --force` (or use a valid `custom://` component) **before** calling create/update.
2. Send `config` with **only** `VueComponentRenderTemplate` (optional thin Submit `FormButton` if the SFC does not own submit). `computed: []`, `watchers: []`.
3. Send `preview_presets` covering the screen's UI cases ([preview-presets.md](preview-presets.md)); `data` values must be JSON strings.
4. Treat a `prefer_vue_component_editor` warning as a **failed screen** unless the user **explicitly** opted into traditional Screen Builder in this turn.

**Forbidden without an explicit traditional opt-in from the user:** posting native `FormInput` / `FormSelectList` / `FormTextArea` / `FormHtmlViewer` / `FormDatePicker` trees via MCP to “finish faster,” to unblock DocuSign/email, or because Vue registration felt heavy. Speed is not an exception.

If MCP `get-mcp-guidance` / `screen-creation-rules` is unavailable, still follow this skill and [vue-component-editor.md](vue-component-editor.md).

### Traditional Screen Builder (opt-in only)

Build with native Screen Builder controls and screen-level `custom_css` / `watchers` / `computed` **only when the user explicitly asks** for traditional / native Screen Builder (e.g. "use Screen Builder controls", "keep SB watchers and calcs", "traditional SB"). If ambiguous, use Vue. EMAIL and CONVERSATIONAL stay on their native packages ([screen-types.md](screen-types.md)); native-control references ([controls.md](controls.md), [watchers.md](watchers.md), [config-schema.md](config-schema.md)) apply to that opt-in path and to EMAIL / CONVERSATIONAL.

## Not this skill

| User wants | Use instead |
|------------|-------------|
| Wire a screen into a Form/Manual Task: `pm:screenRef`, assignment, due date | [pm4-form-manual-task](../pm4-form-manual-task/SKILL.md) |
| Process graph, BPMN, publish a process | [pm4-process](../pm4-process/SKILL.md) |
| Generate a screen with the AI Assistant | not covered |
| The script a watcher runs | [pm4-script](../pm4-script/SKILL.md) |
| A Data Connector a watcher calls | [pm4-data-connector](../pm4-data-connector/SKILL.md) |
| Signal throw/catch in BPMN | [pm4-signal](../pm4-signal/SKILL.md) |
| Collection CRUD | [pm4-collection](../pm4-collection/SKILL.md) |
| Editing Screen Builder or renderer source | [vue2-pm4-patterns](../vue2-pm4-patterns/SKILL.md) |
| 422 / PMQL / pagination on other endpoints | [pm-api-contracts](../pm-api-contracts/SKILL.md) |
| Local instance down | [setup-processmaker](../setup-processmaker/SKILL.md) |

## Before changing anything

Ask only if missing:

1. **Screen**: existing title or id, or the title for a new one.
2. **Type**: `FORM` (collects data), `DISPLAY` (shows data), `CONVERSATIONAL` (chat-style form), or `EMAIL` (email body). See [screen-types.md](screen-types.md).
3. **Fields**: the request variables to read or write. Do not invent a field list.
4. **Category**: existing screen category, or `Uncategorized`.
5. **Where it is used**: Form Task, Web Entry, Send Email, notification, nested in another screen. Wiring is done by the skill that owns that node.

### Process-scoped screen refactor (hard ask)

When the request is to refactor / redesign / restyle **screens of a process** (not a single named screen), **[Gate A](#gate-a--subprocess-screen-scope)** runs **first** — before inventoring screens or touching SFCs.

After the user answers:

1. **Yes** → inventory every `pm:screenRef` / interstitial (and EMAIL refs only if asked) across parent and all subprocess BPMN, dedupe, then refactor each FORM/DISPLAY with [refactor-parity.md](refactor-parity.md). **Skip system / package-owned child processes and system screens** — never touch them ([refactor-parity.md#exclude-system-processes-and-screens-hard-rule](refactor-parity.md#exclude-system-processes-and-screens-hard-rule)).
2. **No** → parent (and nested screens inside those screens) only; record the exclusion.
3. Nested `FormNestedScreen` children of a screen in scope are **always** inventoried — that is not the subprocess ask.

Full procedure: [refactor-parity.md](refactor-parity.md#process-scoped-refactor-parent--subprocess-screens).

### Design system (process or screen create/refactor)

**[Gate B](#gate-b--tenant-design-system--tokens)** and [design-system.md](design-system.md) apply before SFC styling on create/refactor that changes UI chrome.

Then look up real ids ([asset-map.md](asset-map.md#lookups-never-invent-ids)). **Never invent screen, category, script, or data source ids.**

## Asset schema

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Unique across screens. `alpha_spaces`: Unicode letters, digits, whitespace, `-` `_` `.` `'`; no `()`, `,`, `:`, `/` |
| `description` | yes | Plain text |
| `type` | yes | `FORM`, `DISPLAY`, `CONVERSATIONAL`, `EMAIL`; the last two need their package |
| `screen_category_id` | no | Category id, or a comma-separated list. Stored as a string |
| `config` | no | Array of pages: `[{"name", "order", "items": [...]}]`. Ship at least one page |
| `computed` | no | Calculated properties; `[]` when empty |
| `watchers` | no | Watchers; `[]` when empty |
| `preview_presets` | no | Named Preview payloads; **required in practice** on create/refactor — [preview-presets.md](preview-presets.md) |
| `custom_css` | no | CSS string or `null` |
| `projects` | no | JSON array string, e.g. `"[]"`; matters on update (see Rules) |

`title`, `description`, and `type` are required on **every** `PUT`, not only on create.

## Rules

- **Create** with `POST /api/1.0/screens`. A 201 only proves the row exists, not that Screen Builder can open it. Follow [screen-config.md](screen-config.md) for the `config` itself.
- **Change `config` through a draft**, the way Designer does:
  1. `PUT /api/1.0/screens/{id}/draft` with `title`, `description`, `type`, and the full `config` / `computed` / `watchers` / `preview_presets` / `custom_css`.
  2. `PUT /api/1.0/screens/{id}` with `title`, `description`, `type` to publish the draft.
  3. `POST /api/1.0/screens/{id}/close` discards an unwanted draft.
- **A direct `PUT /screens/{id}` silently drops `config`** (still 204) unless `projects` is sent as a JSON array string (`"[]"`), the category is omitted or sent as the stored string, and title and description are unchanged. Prefer the draft flow. Details: [architecture.md](architecture.md).
- **After an API/MCP rewrite of `config`, discard leftover drafts.** Screen Builder opens the draft when one exists. If a designer (or an earlier save) left a draft with the old native tree, the published Vue mount will not show until `POST /screens/{id}/close` (or the draft is replaced). Confirm with `GET /screens/{id}` **and** that no `screen_versions` row has `draft = 1` for that screen.
- **FORM screens need a Submit action** if a task must be completed with them (prefer `:submit="submit"` / `this.submit()` from the Vue SFC; a thin native `FormButton` only when the component does not own submit). DISPLAY and CONVERSATIONAL have different [completion requirements](screen-config.md#completion-by-screen-type).
- **Vue mount first for every FORM/DISPLAY create or refactor** ([vue-component-editor.md](vue-component-editor.md)). Styles, calcs, and script/connector calls live in the SFC ([vue-domain-fields.md](vue-domain-fields.md)).
- **Traditional opt-in only:** native control trees and screen-level CSS/watchers/calcs only when the user explicitly asks. Then **clone controls; don't hand-type them** — copy items from a Designer screen on this instance, new `uuid`, keep `inspector` / `component` / `editor-*`.
- **Package types and controls need their package on the target instance.** CONVERSATIONAL needs `package-conversational-forms`; EMAIL needs `connector-send-email` (or `package-savedsearch` / `package-actions-by-email`). See [screen-types.md](screen-types.md) and [controls.md](controls.md).
- **Nested screens are referenced by id** in `config.screen` of a `FormNestedScreen` item. A screen must not nest itself or a parent: export fails after 10 levels of nesting.
- **Move screens with the official export**, never a hand-made package. See [asset-map.md](asset-map.md).

## PM3 migration (converter packages)

When fixing or finishing screens produced from a PM3 export (`pm-analyze` / `tools/pm-migrate`):

- **`FormMultiColumn`**: PM3 **`colSpan`** rows (two+ fields in one row, all with `colSpan`). Match column widths in `config.options` to the PM3 spans (bootstrap widths sum to 12). See [config-schema.md](config-schema.md#containers).
- **`FormRecordList`**: PM3 **`type: grid`** control. `config.form` must point at the add/edit **page index** after import (often a second page on the same screen); package export may ship a numeric placeholder — fix so the row form opens. See [controls.md](controls.md).
- **`FormLoop`**: not the default output of the current grid mapping; if you introduce it for repeating in-place rows, follow [config-schema.md](config-schema.md#containers) (`container: true`, valid `items` and `settings`) — see [PM3 migration FormLoop container](../../knowledge/findings/pm3-migration-formloop-missing-container.md).
- **Dependent dropdowns** and other PM3-only behaviors: rebuild with visibility rules, data sources, or watchers as needed ([watchers.md](watchers.md)).

Package import quirks (v2 manifest): see [import-package-rules.md](../pm3-pm4-migration/import-package-rules.md): `config` may ship as a JSON **string** (DB stores an array after import), `validation` arrays, `renderAs` dropdown/checkbox only (Screen Builder inspector), FormLoop / inner `FormMultiColumn` with `container: true`, non-empty `description` (`Process::rules` / `Screen::rules`). **Several screens** with blank Preview after import: start with [pm3-pm4-migration](../pm3-pm4-migration/SKILL.md) checklist; **one named screen** fix stays here. Always verify **Preview**, not only the Design canvas ([findings](../../references/findings-index.md) area `pm3-pm4-migration`).

See also [pm3-dynaform](../pm3-dynaform/SKILL.md) and [pm3-pm4-migration](../pm3-pm4-migration/SKILL.md).

## Links to other assets

| From | Field | Points to |
|------|-------|-----------|
| Form Task (`bpmn:task`) | `pm:screenRef` | FORM or CONVERSATIONAL screen id |
| Manual Task | `pm:screenRef` | DISPLAY screen id |
| End, Signal End, Terminate End Event (Summary Screen) | `pm:screenRef` | DISPLAY screen id |
| Start Event, Form Task (Display Next Assigned Task) | `pm:interstitialScreenRef` | DISPLAY screen id |
| Send Email connector | `pm:config.screenRef` | EMAIL screen id (Mustache-rendered, so it can be `{{var}}`) |
| Task email notifications | `pm:config.email_notifications.notifications[n].screenRef` | EMAIL screen id |
| Actions by Email (`bpmn:callActivity`) | `pm:config.screenRef` | EMAIL screen id when `bodyType` is `screen` — [pm4-action-by-email](../pm4-action-by-email/SKILL.md) |
| Screen `config` | `FormNestedScreen` → `config.screen` | Child screen id |
| Screen `watchers` | `script_id`, `script.id` | Script id, or a data source (`data_source-…`) |
| Screen | `screen_category_id` | Screen category id(s) |
| Collection | `create_screen_id`, `read_screen_id`, `update_screen_id` | FORM screens defining field schema (`pm4-collection`) |

Web Entry, Collections, and Saved Search store their own screen ids; see [asset-map.md](asset-map.md).

## Workflow

```
- [ ] 1. Confirm the type and that its package is installed (screen-types.md)
- [ ] 2. Look up ids: screen, category, child screens, scripts, data sources, collections. Stop if any is missing
- [ ] 3. Design system: design-system.md (MCP guidance + user choice when custom design skills exist). Refactor/create: inventory first (refactor-parity.md). Process-scoped: subprocess ask, then inventory parent ± children before coding
- [ ] 3b. FORM/DISPLAY default path: ensure Vue component exists and is registered (vue-component-editor.md); catalogs for multi-option selects (vue-domain-fields.md)
- [ ] 4. Create/update: POST or draft PUT with VueComponentRenderTemplate mount; computed: [], watchers: []; styles/calcs/script calls in the SFC. Traditional native tree only if the user explicitly asked
- [ ] 5. Build preview_presets for empty/start, happy path, and each major UI branch (preview-presets.md); data as JSON strings
- [ ] 6. PUT /draft then PUT to publish (or MCP create-screen / update-screen) including preview_presets. Prefer validate-screen first when available
- [ ] 7. Open /designer/screen-builder/{id}/edit: preview renders; switch presets and confirm each case
- [ ] 8. Static check (verify.md). Task screen/assignment → pm4-form-manual-task; process graph → pm4-process
```

## Validation

```
- [ ] title unique and alpha_spaces; description present; type is one of the four
- [ ] config has at least one page with name and order
- [ ] FORM/DISPLAY (default): VueComponentRenderTemplate wired per vue-component-editor.md check; computed/watchers are []
- [ ] preview_presets cover UI cases; each data value is a JSON string (preview-presets.md)
- [ ] Refactor: refactor-parity.md check complete (process scope: subprocess ask / inventory if applicable)
- [ ] Traditional opt-in only: every native item cloned from Designer (inspector present, unique uuid)
- [ ] FORM used to complete a task can submit (Vue submit or FormButton); fields match the data contract
- [ ] Every FormNestedScreen / collection / script / data source id exists on this instance
- [ ] Package for the type and the generated package with the Vue control are installed
- [ ] After the last PUT, GET /screens/{id} returns the config and preview_presets you sent (drafts are not live)
- [ ] Screen Builder opens the screen and preview renders for each preset
```

## Minimal example

Default FORM/DISPLAY body: Vue mount ([examples/vue-component-form.json](examples/vue-component-form.json)). Replace `SCREEN_CATEGORY_ID`, the collection id, and the real `{ name, key }` from the catalog.

Empty shell only when you will add the Vue mount next ([examples/form-shell.json](examples/form-shell.json)) — not a finished task screen.

| File | Shows |
|------|-------|
| [examples/vue-component-form.json](examples/vue-component-form.json) | **Default** FORM/DISPLAY: one Vue component Editor mount; replace category and collection id; ensure the component is registered. Includes `preview_presets` |
| [examples/preview-presets.json](examples/preview-presets.json) | Multi-state `preview_presets` only (`data` as JSON strings) |
| [examples/form-minimal.json](examples/form-minimal.json) | Traditional opt-in only: Line Input + Submit |
| [examples/display-minimal.json](examples/display-minimal.json) | Traditional opt-in DISPLAY: Rich Text with `{{variable}}` (prefer Vue DISPLAY for new work) |
| [examples/nested-screen.json](examples/nested-screen.json) | Traditional opt-in nested FORM embedding a DISPLAY screen (prefer shared Vue child SFCs) |
| [examples/watcher-script.json](examples/watcher-script.json) | Traditional opt-in SB script watcher writing `invoiceLookup` (prefer call from Vue SFC) |
| [examples/conversational-minimal.json](examples/conversational-minimal.json) | CONVERSATIONAL: intro, one required question, closing message. Needs `package-conversational-forms` |
| [examples/email-minimal.json](examples/email-minimal.json) | EMAIL: Rich Text + Link Button (`connector-send-email`) |

Replace placeholders before posting: `SCREEN_CATEGORY_ID`, `CHILD_SCREEN_ID` (number), `SCRIPT_ID` / `SCRIPT_TITLE` when using traditional watchers. New `uuid` per item if you reuse an example.
