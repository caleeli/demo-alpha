# Screen Vue domain fields

Use with [vue-component-editor.md](vue-component-editor.md) when building or refactoring FORM/DISPLAY screens that need uploads, catalog selects, signatures, or any domain UX. When **refactoring** a traditional screen → Vue, also follow [refactor-parity.md](refactor-parity.md).

Mirrors ProcessMaker core MCP skills `screen-vue-fields` + parts of `screen-creation-rules` (commits `147d7f555`, merge `9214abef2`).

## Hard rule

`page.items` = one core `VueRenderPreview` mounting the screen's Vue component.  
**Do not** add native `FileUpload`, `SignaturePad`, or `FormSelectList` for the main UX.

| Need | Implement in Vue SFC |
|------|----------------------|
| Upload docs | Uploader → `/api/1.0/requests/{id}/files` + `data_name`; store file ids on request data. Request id from `meta[name=request-id]`. Validate before `submit()`. Never fake with a checkbox |
| Catalog selects (**>2 options**) | **Collection + seed + Data Connector** → `ProcessMaker.apiClient.get('collections/{id}/records')` → Vue `<select>`. Pass numeric collection id as mount prop. Map `data.code` → value, `data.label` → label. Never hard-code multi-option arrays. Seed first: [pm4-collection catalogs.md](../pm4-collection/catalogs.md) |
| Binary enums only | Yes/No (and similar fixed pairs) may be hard-coded |
| Signature | Canvas / signature pad → persist data-URL on request data; block submit while empty if mandatory |

## Calcs, watchers, and CSS live in the Vue SFC

Default for every new FORM/DISPLAY screen and every refactor:

| Concern | Where it lives |
|---------|----------------|
| Layout / field styles | Scoped CSS (or design-system classes) **inside the Vue SFC** |
| Calculated properties | Vue `computed` / methods; `$set` onto request `data` when BPMN/emails need the key |
| Script / Data Connector calls | From Vue (`POST /api/1.0/scripts/execute/{id}` with `sync: true`, or Collections / connector APIs). Prefer a shared helper in the generated package (`resources/js/projects/shared/` or `{camelSlug}/shared/`) when one exists. Secrets stay in the script |
| Screen JSON | `computed: []`, `watchers: []`, `custom_css` null or only the optional full-height renderer stub in [vue-component-editor.md](vue-component-editor.md#config-safety) |

Vue-only screens **do not** run Screen Builder `computed` / `watchers` (the compiler never registers FormButton watch keys). Do not copy original SB arrays expecting them to fire.

Screen-level `custom_css`, SB `watchers`, and SB `computed` are allowed **only** when the user explicitly asks for a **traditional** Screen Builder screen ([vue-component-editor.md](vue-component-editor.md#traditional-screen-builder-opt-in)).

## Refactor parity (mandatory)

Do **not** ship a prettier subset of the original form. Details: [refactor-parity.md](refactor-parity.md).

1. Inventory original `GET /screens/{id}`: every control `name`, **full native `config`**, **ancestor `conditionalHide`**, `readonly`, computed `property`, watcher (`script_id` or Data Connector), button `fieldValue`s, and **every nested-screen id** (then `GET` each nest). For a **process-scoped** refactor, ask whether to include subprocess BPMN screens and inventory those ids too ([refactor-parity.md](refactor-parity.md#process-scoped-refactor-parent--subprocess-screens)).
2. Carry **behavior** configs into the Vue SFC (validation, visibility, options/codes, events, defaults that affect data). UI-only keys (colors, CSS, chrome) may change for redesign.
3. Nested screens → **shared** child Vue SFC; parents that nested the same id mount that same component.
4. Initialize **all** variables on `data`. Editable UI **only** for originally visible interactive controls. Literal `conditionalHide: "false"` → data-only, no selector/input.
5. Reimplement every calc and invoke every backend/connector watcher from Vue; set screen `computed` / `watchers` to `[]`.
6. Still set legacy trigger keys on `data` when needed (`search: "1"`, …); never wipe domain values with timestamps.

## Order of work

1. **Catalogs first** — for every multi-option select: list/create Collection + seed records; confirm Data Connector.
2. If refactoring: finish the parity inventory first.
3. Implement full UX + styles + calcs + script/connector calls in the Vue SFC. Create it in the generated package project folder, then register/build/publish it ([vue-component-editor.md](vue-component-editor.md#generated-package-components-where-sfcs-live)).
4. Create/update the screen with **only** the Vue mount (props include collection ids) and empty `computed` / `watchers`.
5. Wire numeric `pm:screenRef`; BPMN conditions use catalog **codes**.

## Done when

```
- [ ] No native FileUpload / SignaturePad / FormSelectList siblings on the FORM
- [ ] Multi-option selects backed by seeded Collections (not hard-coded arrays)
- [ ] Upload / sign / select work inside the Vue component
- [ ] Styles, calcs, and script/connector logic live in the SFC; screen computed/watchers are []
- [ ] Refactors: every original field / config behavior / calc / watcher / nested screen lives in Vue per refactor-parity.md
- [ ] Refactors: Gate C parity trace complete; no publish with open watcher/calc rows ([refactor-parity.md#refactor-completion-gate-blocking](refactor-parity.md#refactor-completion-gate-blocking))
```
