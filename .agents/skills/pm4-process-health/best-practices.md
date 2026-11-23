# Process optimization best-practice sources

Use these stable labels to map a checklist item or finding to the relevant
ProcessMaker documentation. In the report, cite the linked page and the
specific practice; a source does not replace evidence from the reviewed asset.

| Label | Official source | Relevant review guidance |
|-------|-----------------|--------------------------|
| **BP-MODEL** | [Process Modeling Best Practices](https://docs.processmaker.com/docs/process-modeling-best-practices) | Clear default and exception paths, Start and End Events, descriptive names, appropriate gateways and sub-processes; see also its Script Task guidance. |
| **BP-SCRIPT** | [Script Tasks Best Practices](https://docs.processmaker.com/docs/script-tasks-best-practices) | Assess sequential Script Tasks for cumulative user-facing delay, consolidation of related work, safe off-critical-path work, feedback during necessary waits, and execution-time budgets. |
| **BP-SCREEN** | [Screen Design Best Practices](https://docs.processmaker.com/docs/screen-design-best-practices) | Review control count, descriptive and unique variable names, keyboard order, and the performance and maintenance costs of custom JavaScript and Script-based Watchers. |
| **BP-CONTROL** | [Screen Control Best Practices](https://docs.processmaker.com/docs/form-type-screens-best-practices) | Review concise labels, helpful instructions, field layout, and control-specific behavior. |
| **BP-COLLECTION** | [Collection Best Practices](https://docs.processmaker.com/docs/collection-best-practices) | Consider Collections as the source of truth for durable business data and Requests for auditable changes to records. |
| **BP-DECISION** | [Decision Table Best Practices](https://docs.processmaker.com/docs/decision-table-best-practices) | Review applicable decision expressions and String output quotation rules. |
| **BP-BLOCK** | [PM Blocks Best Practices](https://docs.processmaker.com/docs/pm-blocks-best-practices) | A PM Block has one configured Start-type Event and should not use Web Entry as its start. |

## Applying sources

- Inspect the relevant BPMN, linked asset, configuration, or runtime evidence
  before making a claim. Cite the specific node, script, control, or
  configuration as well as the best-practice reference.
- If the evidence needed for a check is unavailable, mark it **Not assessed**
  and explain what is missing. Never invent asset IDs, configuration, or
  execution times. Do not infer measured performance from a static model.
- Distinguish a documented violation from a context-dependent optimization
  opportunity and an intentionally retained design with its rationale. Apply
  guidance in context rather than treating every recommendation as mandatory.
- The official [best-practices index](https://docs.processmaker.com/docs/best-practices)
  also includes instance-wide security and Script Executor administration,
  dashboards, and menus. Those are outside the default process review; review
  them only when explicitly requested and supported by the available evidence.
