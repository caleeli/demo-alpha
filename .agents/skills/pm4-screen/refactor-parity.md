# Refactor parity (traditional → Vue component)

Use when you **rewrite** an existing traditional Screen Builder screen as a [Vue Component Editor](vue-component-editor.md) screen: redesign, design-system restyle, "make it nicer", or any structural update of an existing FORM/DISPLAY. Default path is always Vue unless the user **explicitly** asks to keep traditional Screen Builder controls ([vue-component-editor.md](vue-component-editor.md#traditional-screen-builder-opt-in)).

The rewrite must keep the original's **request data contract**, **behavior**, and **help content**. A prettier subset that drops variables, calcs, watchers, nested screens, or help material breaks gateways, scripts, and emails, and leaves users without the guidance the original gave.

Aligned with ProcessMaker core MCP skill `screen-refactor-parity` (commit `147d7f555`). Load with [vue-domain-fields.md](vue-domain-fields.md).

Read the original with `GET /api/1.0/screens/{id}`.

## Process-scoped refactor (parent + subprocess screens)

When the user asks to **refactor / redesign / restyle the screens of a process** (by process id, name, or "all screens in process X"), do **not** assume the parent BPMN alone is the full scope.

**Nested screens** (`FormNestedScreen` inside a screen's `config`) are always in scope for that screen's parity inventory — that is not optional. **Subprocess screens** are different: they live on other BPMN graphs (embedded phases or Call Activity children) and are easy to miss.

### Mandatory ask (before inventory) — blocking

Enforced as **[Gate A in SKILL.md](SKILL.md#gate-a--subprocess-screen-scope)**. If the process BPMN has any of:

- `bpmn:subProcess` / `bpmn:adHocSubProcess` / `bpmn:transaction` with inner tasks that reference screens, or
- `bpmn:callActivity` that calls another process (including PM Blocks that own screens),

**stop and ask the user once** before **any** of: subprocess BPMN walk, bulk `get-screen`, parity inventory table, Vue SFC work, `update-screen` / `create-screen`, or generated-package build for the batch.

> Do you also want to refactor the screens used inside this process's **subprocesses** (embedded phases and Call Activity child processes)?

**Do not infer “parent only”** because the user named the parent process, because WCP SFCs already exist in the generated package, or because you plan to skip product-registration screens later.

| Answer | Scope |
|--------|--------|
| **Yes** | Parent process screens **and** every screen referenced by subprocess BPMN (see inventory below). Analyze all subprocesses, build one inventory, then refactor. |
| **No** / parent only | Parent (and its nested screens) only. Record that subprocess screens were **explicitly excluded**; do not silently skip them without asking. |
| User already said "include subprocesses" / "whole solution" / "parent and children" | Skip the ask; include subprocesses. |

If the process has **no** subprocesses / Call Activities with screens, skip the ask.

Do **not** finish a "process screen refactor" and only later discover untouched child screens because the ask was skipped.

**Visual / token styling:** before SFC work on a create or redesign batch, resolve design source per [design-system.md](design-system.md) (tenant MCP design skills + user choice when Figma/tokens were not specified). Use one design system consistently across **all** screens in the batch — **DISPLAY summaries and nested read-only mounts are not exempt** from the chosen Light/Dark theme ([design-system.md#sfc-theme-contract-light-or-dark](design-system.md#sfc-theme-contract-light-or-dark)).

### Subprocess screen inventory (when included)

1. Load parent BPMN: `GET /api/1.0/processes/{id}` / `…/bpmn` ([pm4-process](../pm4-process/SKILL.md)).
2. List every **embedded** `subProcess` / `adHocSubProcess` / `transaction` and walk **inner** nodes for screen refs.
3. List every **Call Activity** `calledElement` / `pm:config.processId`; for each child process id, load that child's BPMN and walk the same way. Follow deeper Call Activities until the tree is exhausted (or the user capped depth). Shape choice: [pm4-sub-process](../pm4-sub-process/SKILL.md).
4. Collect unique screen ids from:
   - `pm:screenRef` on Form / Manual / summary End tasks
   - `pm:interstitialScreenRef` when set
   - EMAIL / ABE `pm:config.screenRef` and task `email_notifications` screen refs **only if** the user asked to include EMAIL (default Vue refactor scope is **FORM and DISPLAY**)
5. Deduplicate ids shared by parent and children (refactor once; reuse the same SFC / catalog key).
6. For each FORM/DISPLAY id, run the per-screen inventory below (including **nested screens** inside that screen).
7. Refactor with the same design system / Vue path as the parent; keep parity checklists per screen.

### Exclude system processes and screens (hard rule)

When subprocess scope is **yes**, a Call Activity or embedded walk may surface **platform / system** processes (Public Files, Collection signal processes, `global_signals`, Data Connector service subprocesses, and similar). Their screens are **out of scope** for customer redesign — **never** refactor, `PUT`, or MCP-update them as part of a solution process refactor.

**Before** loading a child process BPMN for screen collection (step 3 above), classify the process:

| Check | How | If true |
|-------|-----|---------|
| System category | `GET /api/1.0/processes/{id}?include=categories` — any category with `is_system: true` (often named **System**) | **Skip** the whole process; do not inventory its screens |
| Package-owned process | Non-null `package_key` for platform packages (`package-files/…`, `package-collections/…`, connector/service keys from Call Activity with non-numeric `calledElement`) | **Skip** |
| Known platform names | e.g. `global_signals`, `Public Files`, `Collection {n} signal process` | **Skip** (confirm with category / `package_key`) |

**Allow** normal customer children: `package_key` null, categories **not** system (uncategorized / user categories). **PM Block** child processes (`asset_type = PM_BLOCK`, `process_package_key` like `pm-block-…`) are customer assets — include when the user opted into subprocess screens, unless they sit in a **System** category.

**Before** refactoring each queued screen id:

| Check | How | If true |
|-------|-----|---------|
| System screen category | `GET /api/1.0/screens/{id}?include=categories` — any category `is_system: true` | **Skip**; no draft/`update-screen` |
| System screen `key` | Non-null `key` on the screen row (e.g. `interstitial`, core defaults from `database/processes/screens/`) | **Skip** |
| Template copy | `is_template` or template `asset_type` | **Skip** unless the user explicitly edits that template |

Do **not** restyle the system interstitial, Public Files UI, Collection signal process screens, or default form/display fallbacks because the parent Start/Task references them.

Record **skipped** process and screen ids (title + reason) in the handoff. If every subprocess child is system-only, tell the user subprocess scope had nothing customer-owned to refactor.

### Check (process scope)

```
- [ ] Asked about subprocess screens when the process has embedded or Call Activity children (or user already included them)
- [ ] If yes: every child process / embedded phase walked; screen refs inventoried and deduped
- [ ] If yes: system / package-owned child processes and system screens excluded — skips documented
- [ ] If no: exclusion recorded; parent-only scope honored
- [ ] Nested FormNestedScreen ids still inventoried per screen (never treated as "subprocess" opt-out)
- [ ] No MCP/PUT on screens with system category or non-null system key
```

## Why computed and watchers do not run on a Vue-only screen

Screen Builder wires `computed` and `watchers` from variables parsed out of native controls (for example a `FormButton` named `search`). On a screen whose only control is core `VueRenderPreview` (or legacy `VueComponentRenderTemplate`), those names are not in the variable list, and the watcher loader drops any watcher whose `watching` key is missing. Copying the original `computed` and `watchers` arrays onto the new screen therefore does **nothing**.

**Do not** rely on SB `computed` / `watchers` JSON for Vue-only refactors. Reimplement them inside the Vue SFC (and put CSS in the SFC). Send `computed: []` and `watchers: []` (never `null`).

## Inventory first

Do not start the component until this table exists for the original screen:

| Source | Capture |
|--------|---------|
| Controls | Every `config.name` (including nested paths such as `contact.phone`, FileUpload `data_name`, button `name` + `event` + `fieldValue`) |
| Control config | The **full** native `config` per control (see below) |
| Visibility | Every `conditionalHide` on the control **and its ancestors**; `readonly`; `disabled` |
| Selects | `optionsList`, `dataObject`, Collection, or Data Connector source |
| Computed | `property`, `type`, full `formula` |
| Watchers | `watching`, `script_id` or data source, `input_data`, `output_variable`, sync flags |
| Nested screens | Every nested-screen control: nested screen id, title, where it mounts, and a full inventory of **that** screen (`GET /screens/{id}` on each; follow deeper nests) |
| Help content | Every visible `FormImage`, instructional `FormHtmlViewer`/Rich Text (tips, "how to find X", diagrams) and helper link: purpose, the field it supports, the asset or URL |
| Static assets | Every `src` / background URL (`/public-files/...`, absolute host, CDN). Record the **exact** URL string from the original |

Tick every row when the new screen ships, including every nested screen id.

## Static assets (`/public-files/…` and images)

Traditional screens often hard-code **absolute** URLs to package-files Public Files on a customer host (e.g. `https://{tenant}.processmaker.net/public-files/bge/loading-egg.gif`). Root-relative `/public-files/...` resolves against the **current** `APP_URL`. Media lives on the Public Files process request (`package_key` `package-files/public-files`); if that Media row is missing on this instance, the browser gets **404** and the GIF/logo never shows.

**Rules:**

1. **Do not silently rewrite** an absolute Public Files URL to root-relative. Keep the absolute host from the original **or** verify the file exists on the current instance first.
2. Before shipping a Vue SFC that uses `/public-files/{path}`, `HEAD` or `GET` that path on the **current** `APP_URL` and expect **200**. A 404 means seed Media (File Manager → Public Files, or attach Media to the public-files request with `custom_properties.data_name` = the **basename** — `publicFile` looks up `end(path)`, so `/public-files/bge/loading-egg.gif` matches `data_name=loading-egg.gif`) or keep/use the absolute source URL.
3. **Never Vite-import multi‑MB GIFs/videos** into the SFC bundle. Bind the URL in `data` / computed (`:src="loadingGifSrc"`), do not `import egg from './loading-egg.gif'`.
4. Small logos may live under `public/...` of the generated package and be referenced as `/vendor/processmaker/packages/<package-name>/...` after `vendor:publish` — still prefer Public Files when the original already used them and Media is present on the target env.

## Classify every control

`conditionalHide` means "show when the expression is true" ("hidden until true").

| Original | In the Vue component |
|----------|----------------------|
| Control or **ancestor** has literal `conditionalHide: "false"` | Never shown. Keep the key on `data` (watchers, scripts, emails may need it). **Do not** render an input |
| `conditionalHide` expression (for example `contact_found`) | Mirror with `v-if` / `v-show` on the same request-data condition |
| `readonly` or disabled | Do not expose a free input. Show read-only if it was visible, otherwise omit |
| Present only to feed a watcher's `input_data` | Data-only: initialize on `data`, no control |
| Visible and interactive | Bind it in the UI |

Adding an editable control for a hidden data-only key (for example a Country select the user never saw) is a parity bug.

**Classic failure:** top-level keys that exist only for HubSpot / watcher payloads, are `readonly`, and sit under a parent with `conditionalHide: "false"`, while the user only sees email — a Vue rewrite that adds Country / Product registration selectors is a parity bug.

Classify before coding:

1. **Visible interactive** → bind in the Vue UI  
2. **Visible read-only** → display only  
3. **Hidden / data-only** → `ensureKeys` only (no selector/input)

## Behavior config to carry over

For every native control, read its `config` and `inspector` values. Look may change; behavior must not.

### Must preserve (behavior / data contract)

| Area | Typical keys | In Vue |
|------|--------------|--------|
| Variable | `name`, `data_name` | Same request-data key |
| Type and format | `type`, `dataFormat`, `rows`, masks, currency | Same input semantics |
| Validation | `validation`, required, min/max, regex | Same rules |
| Visibility and state | `conditionalHide`, `readonly`, `disabled`, `hidden` | Same show/hide and editability |
| Data-affecting defaults | default value, placeholder that sets data | Same defaults |
| Options | `optionsList`, `dataObject`, Collection or connector ids, value/content keys | Same codes and sources |
| Buttons and events | `event`, `fieldValue`, `variant` when it changes the payload | Same submit/trigger payload |
| File and signature | `data_name`, accepted types, signature variable | Same persistence keys and limits |
| Rich Text with Mustache | bound `{{...}}` | The data stays on request `data` |

Walk **every** control — including nested cells in `FormMultiColumn` / loops / nested screens.

### May change (UI redesign only)

Safe to restyle or drop when the redesign replaces native chrome:

- Colors, fonts, spacing, borders, shadows, icons, button chrome
- Screen `customCss` / theme classes (form styling moves into the SFC)
- Label wording polish **only** when the user asked for copy refresh (default: keep label meaning)
- Layout wrappers (columns → design-system grid) **without** dropping fields or visibility rules
- Presentation of instructional help (accordion / tooltip / compact callout, smaller images) — **not** deletion of the teaching content

**Do not** treat "redesign" as permission to skip validation, `conditionalHide`, `readonly`, option codes, `fieldValue`, variable names, or instructional help.

Reading only `config.name` and rebuilding a pretty input while ignoring validation, hide rules, options, `fieldValue`, or file limits is a parity bug.

## Help and instructional content

Traditional screens often teach the user **how to fill a field** with images and HTML that are **not** request-data variables. Keep that teaching — restyled or condensed — not strip it because it is "not a field."

| Original control | Examples | Vue expectation |
|------------------|----------|-----------------|
| `FormImage` | Diagram of where a serial / code appears | Same teaching image(s) (or equivalent asset) next to the field |
| Instructional `FormHtmlViewer` / rich HTML | "If pre-2016, leave blank", tip alerts | Same meaning in a callout, caption, or accordion |
| Helper links | "Not sure what size…?" docs | Keep the link and intent near the related control |

**Anti-patterns:** shipping only inputs and calling help images "chrome"; keeping helper text but dropping the diagram (or vice versa); replacing a how-to image with a vague icon; treating absence of `config.name` on `FormImage` / HTML as out of scope for parity.

## Nested screens become shared components

1. Record every nested-screen id and which parents use it.
2. Recreate each nested screen as a **dedicated shared Vue component**. Register it globally for the core control, or as its own catalog row in the [generated package](vue-component-editor.md#generated-package-components-where-sfcs-live) (`{camelSlug}/shared/` when 2+ screens of the project use it).
3. Every parent that nested the same id mounts or imports that **one** component. Do not copy the UI into each parent.
4. Bind it to the same request-data paths the nested screen used. Its calcs and watchers move into the shared component (or a helper it calls).
5. If the nested screen is also a standalone task screen, publish that screen as a thin mount of the **same** component.

### Optional chrome-only exception

Header/footer/brand-only nests may be restyled or folded into parent chrome **only** when the human agrees. Domain fields, summaries, selectors, and any Mustache-bound data inside nests are **not** optional.

### Nested anti-patterns

- Refactoring the parent shell and leaving nested screens as blank regions
- Inlining the same nested UI three times instead of one shared SFC
- Creating a new parent screen while the nested screen id still points at the old traditional screen without a Vue equivalent
- Treating "nested" as out of scope for parity

## Calcs and watchers in the component

| Original | After |
|----------|-------|
| Computed (frontend/DOM: `window`, `document`, redirects) | Vue methods, `watch`, `mounted` |
| Computed (derived request data) | Vue `computed` plus `$set` onto `data` when BPMN, emails, or later screens read the key |
| Watcher with a backend script | Call from Vue with the same script id and `input_data` fields: `POST /api/1.0/scripts/execute/{script_id}` with `{ data, config, sync: true }`. Write the result to the same `output_variable`. Secrets stay in the script |
| Watcher with a Data Connector or Collection | Call the same endpoint or collection id from Vue |
| Frontend-only watcher | Vue method or `watch` |

Trigger hygiene:

- A user action replaces the old FormButton: Search becomes a method that runs the script.
- Still write the legacy trigger keys to `data` when downstream assets read them (`search: "1"`, `verify: "1"`, `approve: "Yes"`), but do not expect Screen Builder watchers to react.
- Match the original button `fieldValue` when a script or gateway expects a specific value.
- Never overwrite a domain value with a timestamp.
- A temporary mock flag is fine for Preview without an external API. The live path must still call the real script or connector.

## Packaging

The new screen keeps the original `type` (FORM or DISPLAY) unless the user changes the task type, and carries:

1. A thin core `VueRenderPreview` mount, or a consistent `VueComponentRenderTemplate` mount from the generated package ([vue-component-editor.md](vue-component-editor.md)).
2. `computed: []`.
3. `watchers: []`.
4. Form styles in the Vue SFC (not a port of the old screen `custom_css` unless the user asked for traditional).
5. `preview_presets` for empty/start, happy path, and each major visibility/role branch ([preview-presets.md](preview-presets.md)).

Multi-option selects use a seeded Collection with the **same codes** BPMN already tests ([vue-domain-fields.md](vue-domain-fields.md)).

## Preview presets (required on refactor)

After the Vue mount works, **before** calling the refactor done: build and save `preview_presets` that exercise every case from the inventory (OTP pending, contact found, not found, edit mode, dealer role, disallowed country, etc.). Do not ship a refactor with an empty Preview panel. Details and the `data`-as-string rule: [preview-presets.md](preview-presets.md).

## Refactor completion gate (blocking)

Enforced as **[Gate C in SKILL.md](SKILL.md#gate-c--refactor-completion-blocking)**. A Vue mount with `computed: []` and `watchers: []` is **not** proof the screen is refactored — only proof that Screen Builder is not running the old arrays.

### Why “incomplete” refactors happen (avoid these)

| Failure mode | What went wrong | Example symptom |
|--------------|-----------------|-----------------|
| Happy-path first | Ship minimal fields + chrome; defer calcs/watchers/help | Watcher on `search` + script 243 with no UI to set `search` / dealer fields |
| Empty arrays mistaken for “done” | Assume copied SB `computed`/`watchers` still run | `assigned_dealer` never populated; BPMN keys missing |
| Inventory skipped | No table of calcs, watchers, `conditionalHide`, `custom_css` | `showSearchButton` logic absent; `[selector='search']` CSS but no control |
| Presets as afterthought | Two generic presets | Preview cannot show dealer search, role forks, or file viewers |
| Batch order | Toughest screen last without trace carry-over | Screen 672 dealer block missing while 648–649 marked done |

**Rule:** Do not call `update-screen` or tell the user a screen is refactored until the parity trace below has **no open rows**.

### Parity trace (required per screen)

Build this table from `GET /screens/{id}` **before** coding the SFC. Fill the **Vue location** column before publish; leave no cell as “TBD”.

| Kind | Original | Must write to `data`? | Vue location (method/computed/UI) | Preset title that exercises it |
|------|----------|----------------------|-----------------------------------|--------------------------------|
| Calc | `property` + formula summary | yes/no | e.g. `applyCalculatedFields` | … |
| Watcher | `watching` → script/connector id, `output_variable` | trigger + output | e.g. button → `search` + `POST …/scripts/execute/{id}` | … |
| Control / HTML | `config.name` or instructional block | yes/no | input / read-only / dropped (user ok) | … |
| Visibility | `conditionalHide` / ancestor hide | n/a | matching `v-if` | one preset per branch |
| Nested screen | nested id + title | n/a | shared SFC import or inline | … |
| `custom_css` | `[selector='…']` rules | n/a | UI exists OR drop CSS with note | … |

**Watcher row rules:**

1. Read the script body (or `GET /scripts/{id}`): list **every** `$data['…']` / `input_data` field the script expects — not only the watcher's `input_data` template.
2. Expose UI or an explicit automatic path to set the **watching** key (e.g. button sets `search` to a trigger value without clobbering domain fields).
3. Call the **same** script id with the **same** output variable from Vue (`sync: true` unless original was async).
4. Add a preset with **output shape** when Preview cannot call the API (e.g. `assigned_dealer` populated).

**Orphan CSS rule:** If `custom_css` references `[selector='foo']` or `#pdfViewer`, the inventory must list controls that used `customCssSelector: foo` (or equivalent). Missing controls → restore UI in the SFC or document intentional removal with user confirmation.

### Definition of done (one screen)

All must be true before "refactored" / next screen in a batch:

```
- [ ] Parity trace table complete; no TBD rows
- [ ] Every interactive original control has UI or documented exclusion
- [ ] Every calc that writes request data has a Vue path that $emit's the same keys
- [ ] Every watcher has trigger UI/logic + script/connector call + output_variable
- [ ] Every major v-if/conditionalHide branch has a named preview_presets entry
- [ ] validate-screen OK; npm run prod + vendor:publish for new/changed SFCs
- [ ] Preview: switch each preset — visible change or noted "API-only" with mock preset
- [ ] Handoff lists any intentional gaps user approved (not silent omissions)
```

### Batch / subprocess refactors

When refactoring **multiple** screens (process or subprocess scope):

1. **Inventory all screens first** (ids + calc/watcher counts). Do not start SFCs until each screen has a parity trace stub.
2. **Do not** mark easy screens "done" in vault/handoff while a sibling screen in the same batch still has open watcher rows.
3. Order by dependency is allowed (chrome → forms), but **Gate C applies per screen** at publish time — not only at batch end.

## Check

```
- [ ] Inventory covers fields, full control config, ancestor conditionalHide, readonly, calcs, watchers, help content
- [ ] Every nested screen id is inventoried and recreated as one shared component used by all its parents
- [ ] Every original config.name is on request data; UI only for visible interactive controls
- [ ] No always-hidden or data-only key rendered as an editable input
- [ ] Behavior config (validation, visibility, options, events, defaults) is reimplemented
- [ ] Help images, tips, and helper links are present (restyled or condensed, not omitted)
- [ ] Every static asset URL returns 200 on the current APP_URL (or remains the original absolute host); no silent absolute→root-relative rewrite; no huge binaries in the Vite bundle
- [ ] Every computed property and watcher is implemented in the component with the same script id / endpoint / output_variable
- [ ] Styles live in the SFC; screen sends computed: [] and watchers: []
- [ ] preview_presets cover empty/start, happy path, and each major UI branch; data values are JSON strings
- [ ] Spot check: Preview (each preset), a task, or a web entry writes the request-data keys the process expects
```

## Anti-patterns

- An Arco-style shell with a subset of inputs "for polish"
- Mapping only `config.name` and ignoring other SB `config` keys
- Showing every `config.name` as an editable control (ignores `conditionalHide` / `readonly`)
- Dropping `FormImage` / instructional HTML because they have no `config.name`
- Skipping nested screens or duplicating nested UI instead of a shared child SFC
- Copying original `computed` / `watchers` onto the new screen and assuming they run on a Vue-only config
- Mutating `search` / `verify` only, expecting Screen Builder watchers to fire
- Replacing a HubSpot/API script with a hard-coded Vue mock as the **only** production path
- Putting secrets, tokens, or `getenv` equivalents into the Vue SFC
- Falling back to traditional native controls without an explicit user request
- Finishing a refactor without preview_presets for the screen's UI cases
- Rewriting `https://{tenant}/public-files/...` to `/public-files/...` without verifying Media on the current instance (Preview 404s for GIFs/logos)
- Bundling large Public Files GIFs through Vite `import` instead of a runtime URL
- Refactoring "the process screens" from the parent BPMN only and leaving Call Activity / embedded subprocess screens traditional **without asking** the user
- Treating subprocess screens as the same thing as `FormNestedScreen` (nests are always in scope; subprocess BPMN screens need the explicit ask / inclusion)
- Refactoring screens on **system** or **package_key** processes (Public Files, Collection signal, `global_signals`, interstitial / `key` screens) while walking subprocesses
- Calling `update-screen` after a **minimal** SFC (fields + submit only) while calcs/watchers/custom_css selectors from the original are still unchecked in the parity trace
- Declaring a batch "in progress" with some screens published but **no** parity trace file/table for the remaining ids
- Shipping only `Empty / start` + `Happy path` presets when the inventory lists more `conditionalHide` branches or watcher output states
