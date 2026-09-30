# GitHub Copilot Instructions

Please refer to the primary instructions in [../github-instructions.md](../github-instructions.md) which orchestrates the multi-agent QE workflow and calls [agents/system-instructions.md](../agents/system-instructions.md) in turn.

## Agent System Instructions

Each stage of the workflow must invoke the respective agent system instruction in [`agents/system-instructions.md`](../agents/system-instructions.md):
1. **Requirements Analyst**: [`../agents/system-instructions.md#agent-1--requirements-analyst`](../agents/system-instructions.md#agent-1--requirements-analyst)
2. **Test Design Engineer**: [`../agents/system-instructions.md#agent-2--test-design-engineer`](../agents/system-instructions.md#agent-2--test-design-engineer)
3. **API Automation Engineer**: [`../agents/system-instructions.md#agent-3--api-automation-engineer`](../agents/system-instructions.md#agent-3--api-automation-engineer)
4. **UI Automation Engineer**: [`../agents/system-instructions.md#agent-4--ui-automation-engineer`](../agents/system-instructions.md#agent-4--ui-automation-engineer)
5. **QA Lead Reviewer**: [`../agents/agent-05-qa-lead-reviewer.md`](../agents/agent-05-qa-lead-reviewer.md)

See [../github-instructions.md](../github-instructions.md) for complete details on inputs, outputs, schemas, and execution constraints.
