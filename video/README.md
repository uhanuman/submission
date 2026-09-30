# Video Recording

## What to Record

The screen recording should demonstrate the end-to-end agentic workflow:

1. **Run the orchestrator** — show terminal output as each agent executes
   ```bash
   cd submission/agents
   npm install
   npx ts-node orchestrator.ts
   ```

2. **Show generated artefacts** — open the `agent-artifacts/logs/` directory and
   review each JSON file produced by the agents

3. **Show generated automation code** — briefly scroll through:
   - `automation/api/tests/part-create.api.spec.ts`
   - `automation/ui/pages/PartFormPage.ts`
   - `automation/ui/tests/part-create.ui.spec.ts`

4. **Run API tests** (subset)
   ```bash
   cd automation/api
   npm install
   npx playwright test tests/part-create.api.spec.ts --reporter=list
   ```

5. **Run UI tests** (subset, against local InvenTree instance)
   ```bash
   cd automation/ui
   npm install
   npx playwright test tests/part-create.ui.spec.ts --headed --reporter=list
   ```

## Recommended Tool

- **OBS Studio** or **Windows Game Bar** (Win + G) for screen recording
- Keep resolution at 1920×1080 or 1280×720
- Aim for ≤ 10 minutes total

## Upload

Upload the recording to Google Drive or YouTube (unlisted) and paste the link here:

**Recording Link:** _(paste link here)_
