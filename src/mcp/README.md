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

Resources:

- `workflow://registry`
- `workflow://workflows/runnable`
- `workflow://workflows/{workflowId}`

Prompts:

- `choose-workflow`
- `collect-workflow-inputs`
- `review-workflow-payload`

## Next Step

After this skeleton is tested with a local MCP client or MCP Inspector, the next safe layer is a prepare-only runner contract. A real runner should stay behind explicit confirmation and dry-run defaults.
