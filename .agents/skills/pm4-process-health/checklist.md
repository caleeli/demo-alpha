# Health check checklist

For each item that fails, record: **asset** (process, screen id, script name, …), **category**, **severity**, **evidence**, **recommendation**.

Cross-check rules in the asset skill when unsure. Source labels below refer to
[best-practices.md](best-practices.md). Apply each check only to relevant,
loaded evidence; otherwise mark it **Not assessed** and state what is missing.

## BPMN flow

| Check | Category | Typical severity |
|-------|----------|------------------|
| Start and End Events exist, with a clear normal path and appropriate exception paths; investigate unintended orphan nodes or paths that cannot complete ([BP-MODEL](best-practices.md)) | Technical debt | High |
| Conditional gateway exits implement the intended decisions, including a default where needed; split and join use separate, appropriate matching gateway types ([BP-MODEL](best-practices.md)) | Maintainability | Medium |
| No duplicate parallel branches doing the same work | Simplification | Medium |
| Script / connector / decision tasks are not duplicated serially when one step suffices; assess Script Task chains as described below | Simplification | Medium |
| Call Activity `calledElement` and `pm:config` match a real child ([pm4-sub-process](../pm4-sub-process/SKILL.md)) | Technical debt | Critical |
| Signal throw has a matching catch (or documented external consumer) | Technical debt | High |
| Tasks, events, and gateways have descriptive names; task names are action-oriented, not defaults (`Form Task`, `Script Task`) ([BP-MODEL](best-practices.md)) | UX | Low |
| Large or complex process sections are candidates for sub-processes when a coherent boundary improves clarity or reuse ([BP-MODEL](best-practices.md)) | Maintainability | Low |
| FlowGenie nodes use linked genie id, not legacy inline prompt config | Technical debt | High |
| PM Block call activities have inbound/outbound mapping documented | Maintainability | Medium |

## Screens

| Check | Category | Typical severity |
|-------|----------|------------------|
| Form tasks use `FORM` screens with Submit and required inputs | UX | High |
| No `DISPLAY` screen used for data entry | UX | High |
| Controls bind to `data.*` keys used downstream | Maintainability | Medium |
| Validations on required business fields | UX | Medium |
| Control count is reviewed against the documented guideline of fewer than 25 per Screen; consider nested Screens or page navigation in context, rather than assuming a performance defect ([BP-SCREEN](best-practices.md)) | Performance | Medium |
| Control variable names are descriptive and unique where applicable; keyboard tab order follows the visual flow ([BP-SCREEN](best-practices.md)) | UX | Medium |
| Labels and helper text clearly guide users ([BP-CONTROL](best-practices.md)) | UX | Low |
| Custom JavaScript is necessary and maintainable; Script-based Watchers are used sparingly and avoid unnecessary heavy integration ([BP-SCREEN](best-practices.md)) | Performance | Medium |
| Nested screens and templates reduce duplication | Simplification | Low |
| Conditional visibility expressions reference existing `data.*` paths | Technical debt | Medium |
| Collection schema screens exist and match collection field usage | Maintainability | Medium |

## Scripts

| Check | Category | Typical severity |
|-------|----------|------------------|
| No hardcoded API keys, passwords, or tokens | Security | Critical |
| Secrets use `getenv()` / `{{env.*}}` | Security | High |
| Output merges into `data` with stable key names | Maintainability | Medium |
| Timeout and executor appropriate for work (avoid docker PHP for trivial JS) | Performance | Medium |
| No blocking external calls in screen watchers when async script task fits | Performance | High |
| Error handling returns meaningful failure (not silent empty merge) | Maintainability | Medium |
| Language matches the selected executor (`php` + PHP Executor; retain `php-nayra` only for an intentional specialized Nayra runner) | Technical debt | High |

### Consecutive Script Tasks

Source: [BP-SCRIPT and BP-MODEL](best-practices.md). Assess serial chains,
particularly those between user-facing tasks, for cumulative latency and
failure risk. A chain is an optimization candidate, not proof of a measured
delay or an automatic instruction to merge.

1. **Identify the chain.** Follow BPMN sequence flows, not canvas proximity,
   to identify each maximal sequence of consecutive Script Tasks. Record the
   node IDs, `pm:scriptRef` values, execution order, predecessor, and successor.
   Note branches or conditions that change which tasks run. Prioritize chains
   of three or more between user-facing tasks; assess shorter chains too when
   evidence suggests duplication or delay.
2. **Assess consolidation and off-critical-path options.** Read the referenced
   scripts and task configuration. Consider combining related transformations
   into one clearly named Script Task when they can share the same execution
   and failure boundary. Consider moving independent, non-blocking work off the
   user-facing critical path only when its completion is not required by the
   next task or other downstream work.
3. **Evaluate intentional boundaries.** Preserve sequential ordering and data
   dependencies. Compare executors, retry/error handling, timeouts,
   permissions, reusable boundaries, auditability, and independently
   observable side effects. Different requirements can justify separate tasks;
   do not merge or parallelize blindly. If script code or configuration is
   unavailable, mark merge safety **Not assessed**, not safe by default.
4. **Recommend the appropriate action.** Suggest consolidation, a safe
   parallel/asynchronous path, or an interstitial/summary Screen for an
   unavoidable wait. A parallel branch that rejoins before the next user task
   may still block it; verify dependencies, synchronization, failure handling,
   and side effects before recommending a change. If separation is intentional,
   retain the chain and report its rationale.
5. **Avoid invented timing.** With runtime evidence, compare the observed
   user-facing transition time with an agreed budget; the documentation gives
   approximately 2–3 seconds as an example target, not a guaranteed limit.
   Without measurements, report a potential latency risk and what to measure,
   not an actual delay or speedup.

Examples (illustrative, not findings about a real process):

- **Consolidate:** Form Task → Validate Data → Format Data → Calculate Total →
  Approval Task. If the three scripts are related and can share an executor and
  failure boundary, recommend a single Script Task that preserves their order.
- **Retain:** The same chain includes a calculation with a different executor
  or retry/error policy required for an independently observable side effect.
  Retain the necessary separate boundary and explain why; do not assume that
  unrelated steps can be merged without inspecting them.

## Data Connectors

| Check | Category | Typical severity |
|-------|----------|------------------|
| Auth uses instance config, not inline secrets | Security | Critical |
| Outbound mapping only sends required fields | Security | Medium |
| Response mapping targets existing `data.*` keys | Maintainability | Medium |
| Connector reused across tasks instead of duplicate resources | Simplification | Low |
| Retry / error paths defined for external dependency failures | Maintainability | Medium |

## Decision Tables

| Check | Category | Typical severity |
|-------|----------|------------------|
| Hit policy matches business rules ([pm4-decision-table](../pm4-decision-table/SKILL.md)) | Maintainability | High |
| Input/output mappings align with `data.*` model | Technical debt | Medium |
| Tabular business decisions are not duplicated in scripts; compare loaded rules and script logic before recommending consolidation ([pm4-decision-table](../pm4-decision-table/SKILL.md)) | Simplification | Medium |
| String output quotation and decision expression syntax follow the documented guidance when those patterns occur ([BP-DECISION](best-practices.md)) | Technical debt | Medium |
| Rules readable — not overly wide single rows without comments | Maintainability | Low |

## Collections

| Check | Category | Typical severity |
|-------|----------|------------------|
| Durable business data has an appropriate source of truth; consider a Collection when request-only storage obscures data shared across requests ([BP-COLLECTION](best-practices.md)) | Maintainability | Medium |
| When an auditable workflow is required, consider Requests for changes to Collection records; assess actual write paths and business requirements before recommending a change ([BP-COLLECTION](best-practices.md)) | Maintainability | Medium |

Request-scoped transient data does not by itself require a Collection. If
Collection configuration or the business data lifecycle is unavailable, do
not infer that the design is incorrect.

## PM Blocks

| Check | Category | Typical severity |
|-------|----------|------------------|
| Block version pinned intentionally; parent not on stale block | Technical debt | Medium |
| `inboundConfig` / `dataMapping` maps parent `data` clearly ([pm4-pm-block](../pm4-pm-block/SKILL.md)) | Maintainability | Medium |
| Block env vars (`PMB_*`) defined before use | Technical debt | High |
| Block scope is truly reusable — not one-off logic forced into a block | Simplification | Low |
| The PM Block model has exactly one Start-type Event, and its configuration selects that event ([BP-BLOCK](best-practices.md)) | Technical debt | High |
| The PM Block does not use Web Entry as its start ([BP-BLOCK](best-practices.md)) | Technical debt | High |

## Variables (request data model)

| Check | Category | Typical severity |
|-------|----------|------------------|
| Single consistent naming convention (`camelCase` or `snake_case`) | Maintainability | Low |
| No orphan `data.*` keys (written never read, or read never set) | Technical debt | Medium |
| Mustache / FEEL paths exist before the step that uses them | Technical debt | High |
| Sensitive fields not logged in script `Log::` or email bodies | Security | High |
| PII fields marked or obfuscated where collections support it | Security | Medium |

## Process configuration

| Check | Category | Typical severity |
|-------|----------|------------------|
| `status` matches intent (`ACTIVE` only when ready for production) | Technical debt | High |
| Start event permissions match who may launch | Security | High |
| `manager_id` set when using process manager assignment | Technical debt | Medium |
| Form tasks with `user_group` have matching `process_task_assignments` after create | Technical debt | High |
| Notifications do not embed secrets or full PII | Security | Medium |
| Description and category support operators finding the process | Maintainability | Info |
| Unpublished Designer draft while production cases rely on the last published version | Technical debt | Medium |

## PM3 migration follow-up

Use when the process was imported from PM3 or an accelerated converter ([pm3-pm4-migration](../pm3-pm4-migration/SKILL.md)).

| Check | Category | Typical severity |
|-------|----------|------------------|
| Every FORM screen passes Preview (invalid `name` / subform flattening) | UX | Critical |
| Human tasks have real assignment, not default `user` / `requester` only | Technical debt | High |
| Sequence flow conditions tested against `data.*` | Maintainability | High |
| PM3 triggers accounted for (script tasks or watchers planned) | Technical debt | High |
| Migrated PHP Script assets use `php` + **PHP Executor**, never `php-nayra` | Technical debt | High |
| Email, web entry, PM Tables, SQL dropdowns listed as manual gaps | Maintainability | Medium |
