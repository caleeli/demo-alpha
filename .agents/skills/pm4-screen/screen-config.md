# Screen `config` that Screen Builder can open

`POST /api/1.0/screens` accepts almost any `config` array and returns **201**. That is not proof the screen works. Hand-authored items without the expected builder metadata can produce a screen the **Screen Builder cannot open**: `/designer/screen-builder/{id}/edit` renders the page chrome and no canvas, no page tab, no fields.

Do not judge a screen by the 201. Open the builder.

A plain `PUT /api/1.0/screens/{id}` usually drops a new `config` and still returns **204**. Core replaces the submitted `config` with the latest saved version (the draft if there is one) whenever the title, description, category, or `projects` differ from the stored row. Omitting `projects` always counts as a difference. To change `config`, send it to `PUT /screens/{id}/draft`, then publish with `PUT /screens/{id}` sending only `title`, `description`, and `type`. That copies the draft into the screen. The exact rules are in [architecture.md](architecture.md#updating-config).

## Why hand-authored items fail

Every control that Screen Builder saves carries an `inspector` array — the full property-panel definition for that control (Variable Name, Label, Data Type, Validation Rules, colors, …). A `FormInput` has ~18 inspector entries.

The builder reads `inspector` from the stored item. It does **not** rebuild it from the component registry. An item without `inspector` breaks the load.

Measured on a 4.x instance, all screens created with `POST /api/1.0/screens`:

| `config` | Builder canvas |
|----------|----------------|
| Items with `uuid`, `order`, `dataFormat`, `validation: []`, no `inspector` | fails — 0 page tabs |
| Items missing `uuid` and page `order` too | fails — 0 page tabs |
| `[]` (no page at all) | toolbar loads, no page |
| `[{"name": "Page 1", "order": 0, "items": []}]` | **opens** |
| Items deep-copied from a Designer screen, `inspector` intact | **opens** |

Adding `uuid`, `order`, `dataFormat`, or an array `validation` does not help on its own. `inspector` is the deciding field.

A screen with `config: []` is also wrong: the builder toolbar loads but there is no page to drop controls on. Always ship at least one page.

## Use one of these paths

### A. Vue Component Editor (default for FORM/DISPLAY)

POST (or draft PUT) a page whose `items` contain **only** one `VueComponentRenderTemplate` mounting a registered Vue SFC (optional thin Submit `FormButton` if the SFC does not own submit). Styles, calcs, and script/connector calls live **in the SFC**; send `computed: []`, `watchers: []`, and `preview_presets` for the screen's UI cases ([preview-presets.md](preview-presets.md)). See [vue-component-editor.md](vue-component-editor.md), [vue-domain-fields.md](vue-domain-fields.md), and [examples/vue-component-form.json](examples/vue-component-form.json).

**Screens MCP:** create/register the Vue SFC before `create-screen` / `update-screen`. Native control trees are allowed only when the user explicitly opts into traditional Screen Builder ([SKILL.md](SKILL.md#processmaker-screens-mcp-hard-rule)).

Register/build/publish new `@/…` components (or create a valid `custom://`) **before** create/update. Prefer `validate-screen` when available. A soft warning such as `prefer_vue_component_editor` on a native layout is **not** permission to ship that native layout or a hybrid (Vue mount + `FormInput`/`FormSelectList`/`FormHtmlViewer` siblings).

FORM task completion: prefer `:submit="submit"` / `this.submit()` from the Vue SFC. A thin native Submit `FormButton` is OK only when the component does not own submit. Do not invent fields; match the user's data contract. Completion by type: [Completion by screen type](#completion-by-screen-type).

Empty shell ([examples/form-shell.json](examples/form-shell.json)) is only a builder-loadable placeholder until the Vue mount is added — not a finished task screen.

### B. Traditional Screen Builder (opt-in only)

Use native control trees and screen-level `custom_css` / `watchers` / `computed` **only when the user explicitly asks** for traditional Screen Builder.

Options then:

1. **Shell + builder:** POST an empty page ([form-shell.json](examples/form-shell.json)), open `/designer/screen-builder/{id}/edit`, add controls, Save/Publish.
2. **Clone:** `GET /api/1.0/screens/{sourceId}`, deep-copy `config`, change only requested `items[].config` values, fresh `uuid` per item, keep `inspector` / `component` / `editor-*`. Never retype `inspector` by hand. Clone **only** control types that already exist on a Designer screen on **this** instance.

Replace `SCREEN_CATEGORY_ID` from [asset-map.md](asset-map.md#lookups-never-invent-ids); never assume `1`.

### C. Import a screen export

```
POST /api/1.0/screens/import
```

Takes a file ProcessMaker produced via `POST /api/1.0/screens/{id}/export`. Use this to move a screen between instances.

## Item shape (read-only reference)

What Screen Builder actually stores per page:

```json
{ "name": "Page 1", "order": 0, "items": [ /* controls */ ] }
```

Per control:

```json
{
  "uuid": "aa62f1eb-bd63-4436-85aa-580dd2f8dbdd",
  "label": "Line Input",
  "component": "FormInput",
  "editor-component": "FormInput",
  "editor-control": "FormInput",
  "config": {
    "icon": "far fa-square",
    "name": "name",
    "type": "text",
    "label": "Name",
    "helper": null,
    "readonly": false,
    "dataFormat": "string",
    "validation": [],
    "placeholder": "INV-1001"
  },
  "inspector": [ /* ~18 property definitions */ ]
}
```

Notes that trip up hand-written JSON:

- `validation` is an **array**, not `"required"`.
- Screen Builder saves the Submit button as `component: FormButton`, `editor-component: FormButton`, `editor-control: FormSubmit`, `event: "submit"`, `defaultSubmit: true`, `fieldValue: null`. `event: "script"` makes it a Regular Button that does not submit ([controls.md](controls.md#buttons)).
- Page needs `order`.

## Completion by screen type

| Screen type | Completion contract |
|-------------|---------------------|
| `FORM` | A screen used to complete a Form Task has a Submit button with `event: "submit"`. Inputs are needed only when the user wants to collect data. |
| `DISPLAY` | Read-only instructions/context. No input fields or screen-level Submit control. When used by a Manual Task, the task renderer supplies **Complete Task** outside the screen. |
| `CONVERSATIONAL` | Requires `package-conversational-forms`. Do not add a FORM Submit control; the package submits answers and completes the form after its last item ([config-schema.md](config-schema.md#conversational)). |
| `EMAIL` | Email body, not an interactive task screen. Its Submit-style controls render as Actions by Email links when that capability is available ([screen-types.md](screen-types.md#email)). |

Screen types and available controls: [screen-types.md](screen-types.md). Screen checks: [verify.md](verify.md). Do not start a request or complete a task just to verify screen configuration unless the user asked.

## Verify the screen before wiring the task

```
- [ ] The screen exists with the intended type and any required package is installed; 201 alone is not proof it works
- [ ] /designer/screen-builder/{id}/edit shows a page tab
- [ ] Requested controls render in preview; FORM task screens have a Submit action, DISPLAY has no inputs/Submit, CONVERSATIONAL uses package completion
- [ ] Changes are published, not only saved as a draft
- [ ] Only then wire the real screen id into the intended task or other asset
```

A screen that fails to open in the builder can still be referenced by a process and render badly or empty at runtime. Catch it here; screen creation does not authorize creating a process or running a request.
