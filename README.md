# InvenTree QE Case Study — Submission

**Stack:** VSCode · Playwright · TypeScript · Google Gemini AI (Antigravity Agent)

---

## Approach Summary

This submission demonstrates a **multi-agent QE workflow** where specialised AI agents handle discrete quality engineering roles under human architectural direction. The agents are orchestrated sequentially — requirements → test cases → automation — with each agent's output becoming the next agent's input.

```
┌─────────────────────┐
│  Requirements Agent │  ← Analyses InvenTree Part CRUD requirements
└────────┬────────────┘
         │ test-cases brief
         ▼
┌─────────────────────┐
│  Test Design Agent  │  ← Generates manual UI + API test cases
└────────┬────────────┘
         │ test case catalogue
         ▼
┌─────────────────────┐
│   API Test Agent    │  ← Writes Playwright API automation scripts
└────────┬────────────┘
         │ api test suite
         ▼
┌─────────────────────┐
│   UI Test Agent     │  ← Writes Playwright UI automation scripts
└─────────────────────┘
```

---

## Folder Layout

```
submission/
├── README.md                          ← This file
├── github-instructions.md             ← GitHub Copilot / Agent workflow instructions
├── agents/
│   ├── system-instructions.md         ← System prompts for all 4 agents
│   ├── prompts.md                     ← Invocation prompts (user-facing)
│   ├── agent-configs.json             ← Agent metadata / config
│   └── orchestrator.ts                ← TypeScript orchestration runner
├── test-cases/
│   ├── ui-manual-tests.md             ← UI manual test cases
│   └── api-manual-tests.md            ← API manual test cases
├── automation/
│   ├── ui/                            ← Playwright UI automation project
│   │   ├── package.json
│   │   ├── playwright.config.ts
│   │   └── tests/
│   └── api/                           ← Playwright API automation project
│       ├── package.json
│       ├── playwright.config.ts
│       └── tests/
├── agent-artifacts/
│   ├── logs/                          ← Conversation logs per agent run
│   └── conversation-log.md            ← End-to-end agentic workflow log
└── video/
    └── README.md                      ← Recording instructions / link
```

---

## Tool Choices

| Role | Tool |
|------|------|
| AI Engine | Google Gemini (gemini-3.8-flash / Antigravity Agent) |
| Orchestration | TypeScript + `@google/genai` SDK |
| Test Automation | Playwright + TypeScript |
| Test Runner | `@playwright/test` |
| API Under Test | InvenTree REST API (`/api/part/`, `/api/part/category/`) |
| UI Under Test | InvenTree Web Application |

---

## Quick Start

```bash
# 1. Install orchestrator dependencies
cd submission/agents
npm install

# 2. Set your Gemini API key
export GEMINI_API_KEY=<your_key>

# 3. Run the full agentic pipeline
npx ts-node orchestrator.ts

# 4. Install and run API tests
cd ../automation/api && npm install && npx playwright test

# 5. Install and run UI tests
cd ../automation/ui && npm install && npx playwright test
```
