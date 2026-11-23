---
name: vue2-pm4-patterns
description: Vue 2 patterns for ProcessMaker UI. Activate when editing .vue files, filter-table, i18n, PM frontend, resources/js.
---

# Vue 2 PM4 patterns

ProcessMaker frontend is **Vue 2** with Options API, Vuex, Laravel Mix, and global components registered in `resources/js/bootstrap.js`.

## File locations

- Components: `resources/js/<feature>/components/`
- Shared UI: `resources/js/components/`
- API helpers: `resources/js/requests/`, mixins under feature folders

## Global components

`filter-table` is registered globally — don't import it in every listing:

```javascript
// resources/js/bootstrap.js
window.Vue.component("filter-table", FilterTable);
```

Listings pass PMQL, pagination, and sort props consistent with backend API contracts (see `pm-api-contracts` skill).

## API calls

Use existing request helpers and axios patterns from neighboring components. Match:

- Query param names (`per_page`, `order_by`, `order_direction`)
- Auth headers (session or API token depending on context)
- Error handling via existing mixins/notifications

Don't invent new HTTP clients.

## i18n

User-facing strings go through `$t()` / vue-i18n. Copy keys from similar components in the same feature area.

## Styling

Bootstrap 4 + ProcessMaker SCSS. Match surrounding components; avoid pulling in new CSS frameworks.

## Tests

Frontend tests are limited compared to PHP. For UI changes, note manual test steps in the PR. Storybook applies to PM3 screen components — not required for every Vue 2 admin page change.

## Build

```bash
npm run dev    # local
npm run prod   # production assets
```

Vite/webpack dev server needs Soketi up if the page uses realtime features.
