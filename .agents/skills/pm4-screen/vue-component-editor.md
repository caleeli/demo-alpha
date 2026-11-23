# Vue Component Editor (default for FORM and DISPLAY)

**Default for every new FORM/DISPLAY screen and every rewrite/refactor of an existing one:** the main UI is Screen Builder's **Vue component Editor** (`component: "VueComponentRenderTemplate"`, inspector group named after the package), with a thin `contentVue` mount of a registered Vue component. The control is provided by the package generated from `package-skeleton`.

Aligned with ProcessMaker core MCP skills `screen-creation-rules`, `screen-vue-fields`, `screen-refactor-parity`.

## Scope

| Case | Rule |
|------|------|
| New FORM or DISPLAY | Vue Component Editor is **mandatory** |
| Rewrite, redesign, "make it nicer", or any structural change to an existing FORM/DISPLAY | Vue Component Editor is **mandatory**; follow [refactor-parity.md](refactor-parity.md) and [vue-domain-fields.md](vue-domain-fields.md) |
| Small edit to an existing screen (add or change a field, rename a label) | Keep the screen's current structure: add a native control to a native screen, or edit the Vue component of a Vue screen. Do not convert unless asked |
| DISPLAY screen used by a dashboard | Use the Vue mount for the main layout. Native `SavedSearchChart` controls may sit beside it |
| EMAIL and CONVERSATIONAL | Out of scope here; [screen-types.md](screen-types.md) |
| Traditional Screen Builder tree (native controls + screen `custom_css` / `watchers` / `computed`) | **Only** when the user **explicitly** asks for traditional / native Screen Builder controls — see [Traditional opt-in](#traditional-screen-builder-opt-in) |

**DISPLAY prerequisite.** The core control is registered for DISPLAY screens only by the core `typeDisplay.js`. On an instance without that change, the Vue Component Editor appears only on FORM screens, so a DISPLAY screen built with `VueComponentRenderTemplate` renders nothing for the Vue block. Before you build a DISPLAY screen, open the screen in Designer and confirm that Content Fields lists the Vue component Editor for DISPLAY (see [verify.md](verify.md)). If it does not, stop and tell the user.

If the instance does not have the control (the generated package is missing or the control is absent), **stop and tell the user**. Do not fall back to a native layout silently.

## Hybrid pages are invalid

A FORM/DISPLAY page that mixes `VueComponentRenderTemplate` with native Screen Builder controls (`FormInput`, `FormSelectList`, `FormHtmlViewer`, `FormTextArea`, …) as the main UX is **wrong**. So is a native-only page created because Vue registration was hard or `validate-screen` only warned `prefer_vue_component_editor`.

| Allowed on a Vue FORM/DISPLAY page | Not allowed |
|------------------------------------|-------------|
| One `VueComponentRenderTemplate` | Native fields next to the Vue mount |
| Optional thin Submit `FormButton` if the SFC does not call `submit` | Native layout as a “temporary” stand-in |
| Renderer-height-only `custom_css` stub | Screen-level form CSS / calcs / watchers for the form UI |

Order of work when the UI does not exist yet: **design source** ([design-system.md](design-system.md) when MCP lists custom design skills and Figma/tokens were not given) → **SFC → catalog (`public-screen-components.json` or `custom://`) → build/publish → then** `create-screen` / `update-screen` with the Vue mount only.

## The rule

1. `page.items` holds one `VueComponentRenderTemplate` that mounts one (or a few) named Vue components — **nothing else** except an optional thin Submit `FormButton`.
2. `contentVue` is a **thin mount**: e.g. `<PetRegistrationForm v-model="data" :submit="submit" />`.
3. All layout, fields, copy, **CSS**, interactivity, **calcs**, and **watcher-equivalent** calls live **inside that Vue component**, not in `contentVue` and not in screen-level `custom_css` / `computed` / `watchers` (except the optional full-height stub below).
4. Native controls (`FormInput`, `FormSelectList`, `FormHtmlViewer`, …) are not the primary layout and must not share the page with the Vue mount. A submit `FormButton` is acceptable only when the Vue component does not own submit.
5. Never invent a component key. Copy `{ name, key }` from a working screen or the catalog.

Good:

```html
<PetRegistrationForm v-model="data" :submit="submit" :configuration="configuration" />
```

Bad: a `<div>` with headings, inputs, selects, and styles inside `contentVue`. If `contentVue` grows past a mount tag and a trivial wrapper, move that markup into a Vue component.

## Styles, calcs, and watchers (inside the SFC)

| Concern | Vue path (default) | Traditional path (opt-in only) |
|---------|--------------------|--------------------------------|
| CSS | Scoped / component styles in the SFC; tenant Light/Dark via [design-system.md](design-system.md#sfc-theme-contract-light-or-dark) (`data-theme` + shared token file + `var(--color-*)`) | Screen `custom_css` |
| Calculated properties | Vue `computed` / methods; write to `data` when needed | Screen `computed` column |
| Script / Data Connector side effects | Call from Vue (`POST scripts/execute/{id}` sync, Collections, connectors) | Screen `watchers` column |

On create/update for Vue screens send `computed: []` and `watchers: []` (never `null`). Copying SB calc/watcher JSON onto a Vue-only screen does **nothing** — see [refactor-parity.md](refactor-parity.md#why-computed-and-watchers-do-not-run-on-a-vue-only-screen).

Domain fields (upload, catalog select, signature): [vue-domain-fields.md](vue-domain-fields.md).

## Traditional Screen Builder opt-in

Use native Screen Builder controls, screen-level `custom_css`, `watchers`, and `computed` **only** when the user clearly asks for that (e.g. "traditional Screen Builder", "native controls", "keep SB watchers/calcs/CSS").

When they do:

1. Follow [controls.md](controls.md), [watchers.md](watchers.md), [config-schema.md](config-schema.md).
2. Clone controls from a Designer-saved screen; keep `inspector`.
3. Do **not** silently mix a Vue mount with a full native form as the main UX.

If the request is ambiguous, use the Vue Component Editor path.

## How the control runs

- `contentVue` is compiled as a Vue 2 template string.
- `handlerVue` is a function body that **must `return { ... }`**; merged as a mixin.
- Request data is injected as `data` (same object as Screen Builder transient data).
- Tags resolve from `config.components` (`{ name, key }`), then globals.
- `submit()` is available to the mounted component / mixin.
- `getData()` returns the current transient data and `updateTransientData(value)` merges values into it.

Initialize missing request fields in `data()` by mutating `getData()` and return only local component state. Do not return a `data` key, because it would replace the injected transient-data reference:

```js
return {
  data() {
    const transientData = this.getData();
    if (transientData.petName === undefined) {
      this.$set(transientData, 'petName', '');
    }
    return {};
  },
};
```

Do not parse `contentVue` for dependencies. Every catalog or custom tag needs a `config.components` entry.

## Control shape

```json
{
  "component": "VueComponentRenderTemplate",
  "editor-component": "VueComponentEditor",
  "editor-control": "VueComponentEditor",
  "label": "Vue component Editor",
  "inspector": [],
  "config": {
    "icon": "fas fa-pencil-ruler",
    "interactive": true,
    "componentName": "PetRegistrationForm",
    "contentVue": "<PetRegistrationForm v-model=\"data\" :submit=\"submit\" />",
    "handlerVue": "return {\n  created() {\n    if (this.data && this.data.petName === undefined) {\n      this.$set(this.data, 'petName', '');\n    }\n  },\n};",
    "components": [
      { "name": "PetRegistrationForm", "key": "@/projects/petAdoption/registration/PetRegistrationForm.vue" }
    ],
    "renderVarHtml": null,
    "ignoreMustache": true
  }
}
```

Shape only — full body: [examples/vue-component-form.json](examples/vue-component-form.json). Replace `key` from a real catalog / working screen, never invent paths.

| Field | Purpose |
|-------|---------|
| `componentName` | Inspector / docs label; runtime uses the tag + `components` |
| `contentVue` | Thin Vue 2 template mounting registered tags |
| `handlerVue` | Trusted mixin body, must `return`. Init keys with `created()` + `$set`, or `data()` + `getData()`. No UI markup |
| `components` | `{ name, key }` for every `@/…vue` or `custom://slug` tag in `contentVue` |
| `ignoreMustache` | Keep `true` |
| `interactive` | Keep `true` |

`data` is request data. Bind with `v-model` / props. Signed-in user: `this.data._user` or `ProcessMaker.user`, not `this._user`.

## Where the component comes from

| Key shape | Kind | Use |
|-----------|------|-----|
| `@/.../Name.vue` | Official catalog of the generated package | Shipped / registered SFCs |
| `custom://slug` | Admin Custom Vue Components (DB) | No official fallback; must be valid |

1. **Reuse first.** `GET /api/1.0/screens/{id}` on a similar screen; copy `contentVue`, `handlerVue`, and each `components` entry.
2. If the UI does not exist, **create the Vue component first** (SFC + catalog registration + build/publish, or `custom://`), then the screen. Do not ship UI as inline `contentVue` while waiting.
3. Screens API stores screens only. Component source lives outside screen JSON.
4. Customization / caching: `ai-docs/custom-vue-components.md` in `package-skeleton`. `custom://` components are optional; the skeleton documents the pattern and does not ship the administration screens.

## Generated package components (where SFCs live)

A package generated from `package-skeleton` holds several projects; each project is one process. SFCs live in **that** package:

`shared` and `components` are literal directory names. Example (`pet-adoption` / registration screen):

```text
resources/js/projects/
├── shared/                          # package-wide, only when 2+ projects use it
└── petAdoption/
    ├── shared/components/           # only when 2+ screens of this project use it
    └── registration/
        ├── PetRegistrationForm.vue
        └── components/              # local children, only when one exists
            └── PetRegistrationHeader.vue
```

- Create `components/`, `composables/`, or `styles/` only when a file goes inside. Do not scaffold empty folders.
- Never create a directory named `{components}` or `{shared}`. On zsh, `mkdir {components}` does not expand and the braces become part of the name.
- Start a component in its screen folder; promote it to `{camelSlug}/shared/` when a second screen of the project needs it, and to `projects/shared/` when a second project needs it. Never import another project's screen folder.

Screen Builder loads official tags only from the generated package's `resources/js/designer/public-screen-components.json`. A `.vue` on disk is not enough — without a catalog row the preview stays blank (`No SFC bundled for <key>`).

Copy `contentVue`, `handlerVue`, and every `{ name, key }` entry from a working screen before inventing keys.

1. **Catalog**: append `{ "name": "YourForm", "key": "@/projects/{camelSlug}/{screenFolder}/YourForm.vue" }`. Parent children: nested `components` **and** top-level rows.
2. **Build** (generated package root): `npm run prod`.
3. **Publish** (`processmaker`): `php artisan vendor:publish --tag={package-name} --force`. PM serves `public/vendor/processmaker/packages/{package-name}/`.
4. Hard-refresh Screen Builder.

Full rules live in the generated package's root `AGENTS.md` (§4 Screens) and `ai-docs/screen-builder.md`. Do this before calling the screen done. A successful `POST` without registration/build/publish is incomplete.

## Core Screen Builder (`VueRenderPreview`)

Some instances expose core **Content Fields** `VueRenderPreview` instead of (or alongside) the generated package control. **Do not mix shapes** on one screen.

| Core Screen Builder | Generated package (`VueComponentRenderTemplate`) |
|---------------------|--------------------------------------------------|
| `VueRenderPreview` / `VueRenderEditor` | `VueComponentRenderTemplate` / `VueComponentEditor` |
| `templateVue` | `contentVue` |
| `handlerVue.components` or global registration | `config.components` (`{ name, key }`) |

Core has no component-key catalog. Tags in `templateVue` must be globally registered or declared in `handlerVue.components`. The renderer keeps only `data()`, `methods`, `computed`, `watch`, and `components` from `handlerVue` — lifecycle hooks, `mixins`, and other options are ignored. Initialize request fields with `data()` + `getData()` (see [How the control runs](#how-the-control-runs)). Example shape: [examples/vue-component-form.json](examples/vue-component-form.json) (core fields). Prefer the generated package mount when both are available.

**Refactors:** A successful `update-screen` with `computed: []` and `watchers: []` is still **incomplete** until [refactor-parity.md#refactor-completion-gate-blocking](refactor-parity.md#refactor-completion-gate-blocking) passes (parity trace, watcher UI + script, presets per branch). Do not move to the next screen in a batch until Gate C is green for the current id.

## Authoring rules

- Vue 2 Options API in `handlerVue` and DB components: no `<script setup>`, no TypeScript in runtime DB components.
- Keep `handlerVue` thin: init `data`, small helpers, submit bridge.
- On core `VueRenderPreview` only: do not put lifecycle hooks or `mixins` in `handlerVue`; the renderer discards them (the `VueComponentRenderTemplate` mixin allows `created()`).
- No secrets, tokens, or tenant credentials in `contentVue`, `handlerVue`, or component source. Call backend scripts for secret-bearing work.
- **Images / GIFs from Public Files:** bind URLs in `data` (e.g. `loadingGifSrc: '/public-files/bge/loading-egg.gif'`), never `import` multi‑MB binaries into the Vite bundle. Root-relative `/public-files/...` only works when Media exists on **this** instance — `HEAD` the URL before shipping; if the original screen used an absolute tenant host, do not strip it without seeding Media. Details: [refactor-parity.md](refactor-parity.md#static-assets-public-files-and-images).

## Config safety

- Every control in `page.items` needs `"inspector": []` (or a real inspector). Omitting it crashes Screen Builder (`item.inspector.forEach`).
- Pages carry `"items": []` even when empty.
- Send `"computed": []` and `"watchers": []`, never `null`.
- Prefer `custom_css: null`. Optional **renderer height only** (not form styling — that belongs in the SFC):

```css
[data-cy="screen-renderer"] { height: 100%; }
[data-cy="screen-renderer"] > div,
[data-cy="screen-renderer"] > div > div,
[data-cy="screen-renderer"] > div > div > div { height: 100%; }
```

## Validate before save

Prefer MCP `validate-screen` (or equivalent checks) before create/update. Hard errors include empty `FormSelectList` `optionsList`, incomplete Vue wiring (`vue_content_missing`, `vue_components_missing`, …). A FORM built only with native SB controls should warn (`prefer_vue_component_editor`) unless traditional opt-in was explicit.

**MCP agents:** if `validate-screen` returns `prefer_vue_component_editor` and the user did **not** ask for traditional Screen Builder, do **not** call `create-screen` / `update-screen` with that config. Create/register the Vue SFC (this file), then re-validate. Put the SFC under `resources/js/projects/{camelSlug}/` in the generated package, which `resources/js/componentsDesigner/customComponents.js` already globs — add the SFC + `public-screen-components.json` row, build, publish, then mount.

## Check

```
- [ ] Type is FORM or DISPLAY; control is VueComponentRenderTemplate with "inspector": []
- [ ] page.items has the Vue mount only (plus thin submit FormButton if needed) — no FormInput/FormSelectList/FormHtmlViewer siblings
- [ ] contentVue is a short mount of named tags; no page of markup
- [ ] Styles, calcs, and script/connector logic live in the Vue SFC
- [ ] handlerVue starts with "return"; ignoreMustache is true
- [ ] Every non-global tag has a copied { name, key } in components
- [ ] New @/ keys are in public-screen-components.json, built, and published (or custom:// exists) before the screen is saved
- [ ] Multi-option selects use a seeded Collection; uploads/signatures work inside the component
- [ ] Dashboard DISPLAY screens may add native SavedSearchChart controls; other native fields are not the primary layout
- [ ] computed and watchers are []; preview_presets cover UI cases (preview-presets.md); Screen Builder preview renders the component
- [ ] Did not use native SB as a fallback for missing Vue registration
- [ ] Traditional SB path used only when the user explicitly asked for it
- [ ] Core VueRenderPreview only (if used): templateVue mount; handlerVue uses allowed options only; tags globally registered or in handlerVue.components
- [ ] Any `/public-files/...` (or absolute Public Files) URL used in the SFC returns 200 on the current APP_URL; large assets are URL-bound, not Vite-imported
- [ ] If a tenant Light/Dark skill was chosen: root `data-theme` matches; shared token CSS imported; no hardcoded opposite-theme shell colors (DISPLAY summaries count too)
```
