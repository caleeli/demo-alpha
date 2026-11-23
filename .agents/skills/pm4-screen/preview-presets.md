# Preview presets

Screen Builder stores named Preview JSON payloads on the screen row in `preview_presets`. Designers pick a preset in Preview instead of pasting JSON. **Every new screen and every Vue refactor must ship presets that cover the screen's UI cases.**

## When (hard rule)

On **create** and on **traditional → Vue refactor** (and whenever you rewrite request-data shape):

1. Inventory the UI cases (same inventory as [refactor-parity.md](refactor-parity.md) when refactoring).
2. Build one preset per case (titles short and human).
3. Persist with create/update (MCP or draft API) in the **same** save that ships `config` when possible.
4. Confirm `GET /screens/{id}` returns `preview_presets` and Preview can switch between them.

Do **not** leave `preview_presets` null/empty after a create or refactor unless the screen has no request data at all (empty DISPLAY chrome with zero bindings — rare). Prefer at least an `Empty / start` preset with `{}` or the handler defaults.

## Shape

Column: `screens.preview_presets` / `screen_versions.preview_presets` (JSON array, nullable).

```json
[
  {
    "title": "Contact found — USA",
    "data": "{\"email\":\"jane.doe@example.com\",\"contact\":{\"email\":\"jane.doe@example.com\",\"country\":\"USA\"}}"
  }
]
```

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Shown in the Preview preset list. Unique enough to pick the case. |
| `data` | **string** | JSON text of the request `$data` object. **Must be a string**, not a nested object. |

### Why `data` is a string

PHP `json_decode` turns JSON `{}` into `[]`. Designer serializes each preset's payload with `JSON.stringify` before save so empty objects (and intentional `{}` nests) survive. Agents must do the same:

- Correct: `"data": "{\"contact\":{}}"`
- Wrong: `"data": { "contact": {} }` — after a round trip `contact` often becomes `[]` and Vue/`v-if` branches break in Preview.

When reading presets, parse `data` with `JSON.parse` if it is a string.

## What cases to cover

Derive presets from **visible UI states**, not from every request key and **not** from a generic Empty/Happy template.

| Include when it changes Preview | Purpose |
|--------------------------------|---------|
| First paint / blank | Only if that state is visually distinct (empty list, no contact, loading) |
| Named UI branches | Title the **branch** (`OTP pending`, `Dealer pickup selected`), not `Happy path` |
| Each major `v-if` / `conditionalHide` | OTP, contact found/not found, role-gated, shippable vs not, reselect dealer, … |

Also add presets when the screen has:

- Role or channel flags (`start_role`, dealer vs customer)
- Allowed vs disallowed country / locale forks
- Nested objects that must stay objects (`contact: {}` vs missing key)
- Arrays that drive loops/record lists (one empty list + one with 1–2 rows)
- Error or validation banners driven by response flags
- **Watcher / script paths:** one preset with trigger fields set (e.g. valid `search_email`) and one with **`output_variable`** mock (`assigned_dealer`, `search_contact`, …) when Preview cannot call the API — see [refactor-parity.md](refactor-parity.md#refactor-completion-gate-blocking)
- **File / Viewer branches:** one preset per `how_did_you_obtain_*` (or equivalent) that toggles proof vs certificate vs neither

Skip inventing PII; use clearly fake emails and names. Prefer catalog codes that exist on the instance (country/state collection `code` values).

**Titles:** name the state the designer will see (`Owner loaded`, `Part needs order`). Reserve `Empty / start` / `Happy path` only when those labels honestly describe the only two states.

Minimum for a multi-state FORM: **one preset per distinct visible branch** (often 3+). A screen with **no** request bindings (static DISPLAY) needs **one** chrome preset — not Empty + Happy with unused keys.

## How to invent data

1. Open the Vue SFC (or native tree). List keys that **drive render**: `v-if` / `v-show`, `v-for` sources, displayed bindings — ignore keys only written on submit.
2. Confirm the mount uses `v-model` → SFC `value` (or both `value` and `data`). A prop named only `data` will **not** receive Preview presets from `v-model="data"`.
3. For each UI case, set **only** the keys that case needs, with the **exact shapes/codes** the SFC expects (`available_products[].select`, `would_you_like: "Direct Shipping"`, `shipping_info.{…}`, not invented aliases like `eggs` / `fulfillment_method` / top-level `address`).
4. Match Collection option **codes** (not labels) for selects.
5. Do not call production scripts just to build presets — synthesize the script **output** shape the UI expects (`search_contact`, `contact`, `user_update_response`, …).
6. **Self-check:** switching the preset in Preview must change something visible. If two presets look identical, drop or rewrite one.

## Persist

### Screens MCP (preferred when available)

`create-screen` / `update-screen` accept `preview_presets` (array). Send it with `config` on create, or alone on update after config is already published:

```json
{
  "id": 271,
  "preview_presets": [
    {
      "title": "Empty / start",
      "data": "{\"email\":\"\",\"contact\":{}}"
    },
    {
      "title": "OTP pending",
      "data": "{\"email\":\"jane.doe@example.com\",\"contact\":{},\"search_contact\":{\"found\":true,\"otp_hash\":\"abc\"}}"
    }
  ]
}
```

### REST (Designer draft flow)

Include `preview_presets` on the draft PUT with config:

```
PUT /api/1.0/screens/{id}/draft
{ title, description, type, config, computed, watchers, custom_css, preview_presets }
PUT /api/1.0/screens/{id}
{ title, description, type }
```

Publishing copies draft `preview_presets` onto the published version the same way as `config`.

### Git YAML (`upsert-screen-yaml`)

When the screen lives in a generated package, the versioned source is `projects/{slug}/screens/{title}.yaml`. Put `preview_presets` in that file (same `{ title, data }` shape, `data` a quoted JSON string). `POST /api/1.0/deploy-screen` writes them onto the screen and the published version, and `GET /api/1.0/screen-yaml` returns them. A YAML without the key is stored with an empty list, so Preview has nothing to switch.

## Check

```
- [ ] preview_presets is a non-empty array after create/refactor (unless truly data-less)
- [ ] Every major v-if / conditionalHide / role branch has a titled preset (title = branch name)
- [ ] Watcher output variables and script-driven UI states have a preset (live call or mocked output shape)
- [ ] Each preset.data is a JSON string; nested {} stay objects after GET
- [ ] Keys/shapes match the SFC (spot-check one happy and one alternate branch in Preview)
- [ ] No duplicate-looking presets; chrome-only screens have a single preset
- [ ] GET /screens/{id} returns the presets; Preview list shows the titles
```

## Anti-patterns

- Shipping a Vue rewrite with no presets (Preview stuck on `{}`)
- Defaulting every screen to `Empty / start` + `Happy path` without checking branches
- One mega-preset that mixes OTP + contact-found + edit mode
- Nested object `data` (not stringified) so `{}` becomes `[]`
- Real customer emails / phone numbers in presets
- Presets that only set keys never read by the UI (e.g. `claim_number` on a chrome-only thank-you, `task_title` alone as “happy path”)
- Wrong field names / shapes vs the SFC (`eggs` instead of `available_products`, `fulfillment_method` instead of `would_you_like`)
- Two presets that produce the same Preview pixels
- Empty PHP arrays in agent scripts that stringify to `[]` where the UI expects `{}` — write the JSON string with `{}` explicitly
