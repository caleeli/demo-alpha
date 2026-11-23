# Verify a screen

Run after every screen change. The static checks only read the API. The builder checks open Screen Builder. Do not start a request or complete a task unless the user asked.

## Static

`GET /api/1.0/screens/{id}` (published config; drafts are not returned).

### Metadata

- `title` is unique and `alpha_spaces`: no `()`, `,`, `:`, `/`
- `description` is not empty
- `type` is `FORM`, `DISPLAY`, `CONVERSATIONAL`, or `EMAIL`. The API accepts any string, so check the spelling
- `screen_category_id` is an existing category id, stored as a string

### Config

- At least one page, each with `name`, `order`, and `items`
- Every item has `uuid` (unique across the screen), `component`, `editor-component`, `editor-control`, `config`, and an `inspector`. A native control's `inspector` is non-empty; core `VueRenderPreview` and legacy `VueComponentRenderTemplate` mounts use `"inspector": []`
- FORM/DISPLAY (default path): Vue mount checks in [vue-component-editor.md](vue-component-editor.md#check) pass; `computed` / `watchers` are `[]`; styles/calcs/script calls live in the SFC ([vue-domain-fields.md](vue-domain-fields.md)). Rewrites also pass [refactor-parity.md](refactor-parity.md#check). Traditional native trees only when the user explicitly opted in
- Containers walked recursively: `FormMultiColumn` columns, `FormLoop` items ([config-schema.md](config-schema.md#containers))
- Page Navigation buttons point at an existing page index (`eventData`)
- After the last `PUT`, `config` matches what you sent. If not, the update rule replaced it ([architecture.md](architecture.md#updating-config))
- After create or Vue refactor: `preview_presets` is a non-empty array; each item has `title` and string `data`; cases cover empty/start, happy path, and major branches ([preview-presets.md](preview-presets.md))

### Per type

| Type | Check |
|------|-------|
| FORM | A button with `editor-control: "FormSubmit"` and `event: "submit"` if a task completes with it |
| DISPLAY | No inputs or Submit button; only display controls. Dashboard screens may combine `VueRenderPreview` with native `SavedSearchChart` controls |
| CONVERSATIONAL | One page, flat `items` (no containers or nested screens), no Submit control. Every `FormJump` destination matches a `FormBreak` `config.label` |
| EMAIL | Only the first page counts. Only Rich Text, Record List, Link Button, and FormButton items. Button-style Link Buttons need `_app_url_arrow_img` in the data outside task notifications |

### References

Look each one up; never assume it exists ([asset-map.md](asset-map.md#lookups-never-invent-ids)).

- `FormNestedScreen` `config.screen`: the child exists, is not this screen or a parent, and its type is allowed ([screen-types.md](screen-types.md#nesting-by-type))
- Vue path: screen `watchers` should be `[]` (logic in the SFC). Traditional opt-in only: `script_id` / `script.id` exist; for a data source, `script_configuration.dataSource` equals `script_id`; each `watching` is a control, loop, or watcher variable on this screen
- Traditional Data Connector Select Lists: `config.options.selectedDataSource` exists (prefer Collection + Vue select on the default path)

### Packages

- The type's package is installed: `package-conversational-forms` for CONVERSATIONAL, `connector-send-email` to send EMAIL
- Each package control's package is installed ([controls.md](controls.md))

## Screen Builder

Open `/designer/screen-builder/{id}/edit`:

1. A page tab shows and the canvas lists the controls. The palette matches the type (DISPLAY and EMAIL show fewer groups).
2. Watchers, Calcs, and CSS panels show what you saved.
3. Open Console lists only warnings you expect, such as the script watcher performance warning.
4. Preview renders. Switch each `preview_presets` entry and confirm the matching UI state. Type a value in a watched field and check the watcher output appears after about half a second.
5. CONVERSATIONAL: Preview asks one question at a time and ends with the last message.
6. EMAIL: Preview is not the real output. Render it the way Send Email does ([screen-types.md](screen-types.md#email)) or send a test email.

## Failures

| Symptom | Likely cause |
|---------|----------------|
| Builder shows the page chrome but no canvas or page tab | Hand-authored items without `inspector`, or `config` is not an array of pages |
| Builder palette is empty | CONVERSATIONAL or EMAIL screen without its package |
| `PUT` returns 204 but `config` is unchanged | Title, description, category, or `projects` differed, so core kept the latest version. Use the draft flow |
| Builder shows the change, tasks don't | Draft not published |
| Task stays in the inbox after Submit | No button with `event: "submit"`; a Regular Button (`event: "script"`) does not submit |
| A control never shows | `conditionalHide` is false; it shows only when the expression is true. Strings join with `||`, not `+` |
| Nested screen is blank | Wrong child id, or a child type not allowed in this parent |
| Watcher never runs | `watching` is not a variable on this screen, or `byPass: true` |
| Watcher script gets `&#39;` or `&amp;` | Mustache HTML-escapes `{{var}}` in `input_data`. Pass ids, not free text |
| Export fails | A data source watcher points at a missing connector, or nesting goes deeper than 10 levels |
| Imported data source watcher shows no endpoints | `script_configuration.dataSource` still holds the source instance id |
| Email shows the word `undefined` | An unsupported component (input, loop, nested screen) on an EMAIL screen |
| Email is missing content | Content on page 2 or later; only the first page is sent |
| Email button shows a broken image | `_app_url_arrow_img` not in the data; use `variantStyle: "link"` or add it |
| Conversation skips or loops | A `FormJump` destination no longer matches a `FormBreak` label |
| `custom_css` rule disappeared or changed | API sanitizing removed tags and `{{ }}`, or a template apply merged CSS ([templates.md](templates.md)) |
| CSS `@media` rule never applies | It matches the screen container width, not the window |
| Create from template returns 500 | `templateOptions` sent as an array; delete the orphan screen it left |
| Duplicate `uuid`s after applying a template | Apply keeps item uuids; regenerate them |
| Vue template renders as an unknown tag | The tag is not globally registered or declared from an available definition in `handlerVue.components`; `config.components` works only with the generated package control |
| Vue handler lifecycle code never runs | Core `VueRenderPreview` discards lifecycle hooks and `mixins`; use the component itself, or initialize transient data from `handlerVue.data()` with `getData()` |
| Preview shows broken image / Console `404` on `/public-files/...` | Media missing on this instance's Public Files request, or absolute tenant URL was rewritten to root-relative. Seed Public Files (`data_name` = basename) or restore the original absolute URL ([refactor-parity.md](refactor-parity.md#static-assets-public-files-and-images)) |
| Vite build treats `/public-files/...gif` as a module / huge bundle | Literal `src="/public-files/..."` was parsed as an asset import; bind the URL in `data` and use `:src` |
| Process refactor touched interstitial / Public Files / Collection signal screens | Subprocess walk did not exclude system processes (`categories.is_system`, `package_key`) or system screens (`key`, system category) — revert and scope customer assets only ([refactor-parity.md](refactor-parity.md#exclude-system-processes-and-screens-hard-rule)) |

Fix the screen, publish, then re-run the static and builder checks.
