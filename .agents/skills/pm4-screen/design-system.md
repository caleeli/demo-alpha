# Design system and tenant design skills (Vue FORM/DISPLAY)

Use when **creating** or **refactoring** FORM/DISPLAY screens — one screen or **all screens in a process** — on the Vue Component Editor path where layout, tokens, or visual chrome matter.

Aligned with ProcessMaker Screens MCP: call `get-mcp-guidance` before other Screens tools; load tenant skills with `get-mcp-skill` only when their `when` matches the task.

## Blocking rule

When **≥1** custom design skill is in the catalog and the [skip table](#skip-the-design-ask) does **not** apply:

- The agent **must ask the user in chat** (or `AskQuestion`) **before** the next styling action: `get-mcp-skill` on a token skill, editing SFC styles/SCSS, or MCP `create-screen` / `update-screen` on a redesign/refactor batch.
- **Calling `get-mcp-skill` for a tenant design-token skill without a user choice is a skill violation** — including when only **one** skill exists (still ask yes/no, do not auto-apply).
- **Finding existing `byewind-tokens.scss` or WCP components in git is not permission to skip the ask** — the user must confirm the tenant skill (or decline).

If MCP `get-mcp-guidance` returns an empty `system_prompt` but a non-empty **skills** array, the gate still applies: filter design skills from that array.

## Skip the design ask

Do **not** prompt for a design system when **any** of these is already clear in the user request or thread:

| Source already given | Examples |
|---------------------|----------|
| Figma | A `figma.com` URL, file key, “match this Figma”, “implement this frame” |
| Named token / design system | “ByeWind”, “ByeWind Light”, a token doc path, “use design tokens X” |
| Explicit visual scope | “parity only / no redesign”, “keep existing look”, traditional SB opt-in |
| Prior turn | User already chose a tenant design skill or declined a design system |

If the user named **Figma**, use the Figma MCP / project Figma skills when available — do not substitute a tenant token skill without asking.

## When to ask (hard rule)

Before writing or refactoring Vue SFCs for a **process-scoped** or **multi-screen** create/refactor, or a **single-screen** create/refactor that changes UI chrome (not a data-only bugfix):

1. Confirm design source is missing (table above).
2. Call **ProcessMaker Screens MCP** `get-mcp-guidance` and read the **skills catalog** (do not load every skill).
3. Build the list of **tenant custom design skills**: catalog entries that are **not** generic screen wiring (`screen-creation-rules`, `screen-refactor-parity`, `screen-vue-fields`, `screen-ui-qa`, …) and match **any** of:
   - **Title** contains `Design Tokens`, `design tokens`, or similar tenant branding; or
   - **`when`** mentions restyling, visual styling, design system, tokens, or building/rebuilding UI for screens.
   Example tenant skills: `Design Tokens Byewind Light`, `Design Tokens Byewind Dark`.

| Custom design skills | Action |
|----------------------|--------|
| **0** | No design-system question. Proceed with parity + sensible Vue styling; do not invent a token file. |
| **1** | Ask once: *Do you want to apply the **{title}** design system / tokens to these screens?* (yes / no). |
| **2+** | Ask once: *Do you want to use a design system for these screens?* If yes, ask which: list each **title** (and slug if titles collide). Present choices in chat — never pick silently. |

Record the answer (skill slug or “none”) before SFC work.

## After the user chooses a skill

1. `get-mcp-skill` with the chosen **slug** (or the catalog Resource URI).
2. Follow that skill for tokens, shell components, SCSS variables, and layout — **in addition to** [refactor-parity.md](refactor-parity.md) / [vue-component-editor.md](vue-component-editor.md).
3. Apply the **same** design system across **every** screen in a process-scoped batch so tasks feel consistent — **including DISPLAY summaries, nested read-only panels, and warnings** (not only full-page FORM tasks).

If the user declines, stay on parity-first styling (no forced token migration).

### SFC theme contract (Light or Dark)

When the user chose a **Light** or **Dark** tenant token skill (e.g. *Design Tokens Byewind Light*), **every** new or refactored Vue SFC in that batch must implement that theme. This is separate from field parity.

| Rule | Detail |
|------|--------|
| **One theme per batch** | Do not mix Light and Dark roots across FORM/DISPLAY mounts in the same process refactor unless the user documents an exception. |
| **Root attribute** | Set `data-theme="light"` or `data-theme="dark"` on the SFC root to match the user's choice — never the opposite skill's doc. |
| **Shared tokens file** | Prefer one batch-level CSS file (e.g. `wcp-byewind-light-tokens.css` with a `[data-theme="light"] { --color-* … }` block) imported via `<style src="./…">` in **each** SFC. |
| **Scoped styles** | Use `var(--color-*)`, `var(--font-sans)`, `var(--space-*)`, `var(--radius-*)` from the token file. **Do not** paste dark-shell hex (`#0e1014`, `#181b22`, …) when Light was chosen. |
| **No type-based theme** | **Forbidden heuristic:** “summaries / nested DISPLAY / agent panels are dark; forms are light.” Screen **type** does not change the design system. |
| **Dark skill** | If the user chose **Dark**, load only the dark token skill/doc — do not default summaries to light. |
| **Light skill** | If the user chose **Light**, do **not** load the dark token skill or copy dark-token snippets for convenience. |
| **Brand chrome exception** | A child chrome SFC may use the **other** theme only when it mirrors an existing brand pattern (e.g. dark footer strip under a light form). Name it in the handoff; do not use this to darken the main task body. |

**Pre-build self-check (agent):** when Light was chosen, search the batch SFC folder for `data-theme="dark"` and for hardcoded dark background hex — fix or justify as a documented chrome exception before `npm run prod` / `update-screen`.

**Incident (2026-11-16):** WCP subprocess screens **725** / **711** shipped with `data-theme="dark"` and inline dark variables while the user had confirmed **ByeWind Light** — caused by treating DISPLAY summaries differently from FORM SFCs and skipping the shared light tokens file.

## MCP unavailable

If Screens MCP is down and no design source was given: do not block on the ask. Use repo/package conventions already in the solution (e.g. existing `byewind-tokens.scss` in the package) or minimal Vue scoped CSS; note in the handoff that no tenant design skill was offered.

## Anti-patterns

- Picking ByeWind (or any tenant token skill) without catalog + user choice when multiple design skills exist
- Ignoring a user-supplied Figma URL because a token skill is in the catalog
- Loading every MCP skill from guidance instead of filtering design skills
- Different token systems on screens within the same process refactor batch
- Using “Figma was unavailable” as an excuse for native Screen Builder fallback ([SKILL.md](SKILL.md) Vue rule still applies)
- **Light chosen but DISPLAY/summary SFCs use `data-theme="dark"` or hardcoded dark palette**
- **Importing dark token docs while implementing a Light batch**

## Check

```
- [ ] User did not already specify Figma or a named token system
- [ ] get-mcp-guidance run when MCP is available; design skills filtered from catalog
- [ ] User asked when exactly one custom design skill; choice asked when 2+
- [ ] get-mcp-skill loaded for chosen slug before token/SFC styling
- [ ] Same design choice across all screens in a process-scoped batch (or documented exception)
- [ ] Every SFC root `data-theme` matches the chosen Light/Dark skill; summaries/nested DISPLAY included
- [ ] Batch uses shared token CSS + `var(--color-*)`; no stray dark hex when Light was chosen
- [ ] Pre-build grep for `data-theme="dark"` / dark hex when Light batch (exceptions named)
```