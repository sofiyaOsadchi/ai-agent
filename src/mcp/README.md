# Carmelon AI Agent MCP Skeleton

This folder contains a read-only MCP skeleton for the demo-connected workflow registry.

It intentionally does not:

- run jobs
- spawn `src/index.ts`
- write Google Sheets
- crawl websites
- call AI providers
- change `package.json`

## Run Locally

Because `package.json` is protected, there is no npm script yet. Run the server directly with the existing `tsx` dev dependency:

```bash
npx tsx src/mcp/server.ts
```

The server uses MCP stdio transport. It writes only JSON-RPC messages to stdout.

## Exposed MCP Surface

Tools:

- `list_workflows`
- `get_workflow`
- `validate_workflow_payload`
- `plan_workflow_run`
- `prepare_workflow_run`

Resources:

- `workflow://registry`
- `workflow://workflows/runnable`
- `workflow://workflows/{workflowId}`

Prompts:

- `choose-workflow`
- `collect-workflow-inputs`
- `review-workflow-payload`

## Next Step

Run the smoke client:

```bash
node scripts/mcp-smoke-test.cjs
```

## SDK Decision

This skeleton currently avoids adding `@modelcontextprotocol/sdk` because `package.json` is protected in this project. The official SDK should be introduced before remote HTTP transport, OAuth, or production use, but only after explicit approval to edit dependencies.

## Run Policy

`prepare_workflow_run` returns a read-only run contract with `MODE`, payload data, dynamic environment preview, missing inputs, and safety gates. It still does not run jobs.

A real runner should stay behind explicit confirmation, dry-run defaults, and a workflow allowlist.
