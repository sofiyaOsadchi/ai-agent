# AI Workspace Assistant - Rebuild Notes

## Why This Exists

The project now has several strong standalone tools, but the current central assistant is not yet strong enough to be the main entry point. The user wants one chat above the tool rubrics that can understand flexible requests, guide the user, route into the right feature, and eventually operate as a broader AI work assistant.

The first implementation connected an AI endpoint and produced action cards, but it still feels like a form router. It does not yet feel like a real assistant that owns the workflow.

## Current Prototype Files

- `public/assistant-workspace.html` - central assistant page.
- `public/assistant-workspace.js` - chat UI, action cards, local routing, handoff attempts.
- `public/assistant-tools.js` - tool registry for current features.
- `src/server-demo.ts` - includes `/api/assistant-chat`, using OpenAI to classify/respond.
- `public/index.html` - links to the assistant above the feature cards.

## What Works

- The page exists and is reachable from the index.
- The assistant can call `/api/assistant-chat`.
- The endpoint can use a cheaper model by default and a stronger model for more complex messages.
- It can create action cards for registered tools.
- It has an initial handoff to FAQ Builder.
- It can avoid classifying the word "model" as vehicle unless the request is truly automotive.

## What Does Not Work Well Enough

- Conversation state is weak.
- The assistant duplicates actions instead of maintaining one active task.
- Follow-up answers sometimes go back to AI instead of updating state.
- The assistant asks questions but does not reliably advance to open/run/complete.
- It does not reuse the strong guided-chat logic already built inside specific tools.
- It lacks a clear distinction between:
  - general answer,
  - tool routing,
  - missing-field collection,
  - confirmation,
  - handoff,
  - direct run,
  - file edit planning.
- The UX feels uncertain and repetitive.

## Recommended Architecture

Rebuild the central assistant as a stateful orchestrator.

Core concepts:

- `ToolManifest`
  - tool id, title, description
  - required inputs
  - optional inputs
  - follow-up questions
  - risk level
  - run capability
  - workspace href
  - payload builder
  - handoff adapter

- `ConversationState`
  - active tool id
  - active intent
  - collected inputs
  - missing inputs
  - last assistant question
  - next recommended action
  - confirmation status

- `AssistantDecision`
  - answer generally
  - ask one follow-up question
  - update active draft
  - open workspace
  - run job
  - draft file edit
  - escalate to stronger model

## Model Strategy

Do not call AI for every message.

Use local deterministic handling for:

- yes / no / skip / continue
- URL answers
- language chips or simple language names
- selected option answers
- answers to a known pending field

Use cheap AI for:

- intent detection
- mapping flexible user language to a registered tool
- extracting fields from messy text

Use stronger AI for:

- multi-step plans
- new workflow design
- ambiguous requests
- file edit reasoning
- cross-tool orchestration
- general strategic answers

## First Rebuild Scope

Start with FAQ Workflow Builder only.

Do not try to support every tool at once. Build one excellent path:

1. User asks naturally for FAQ creation.
2. Assistant detects FAQ Builder and workflow type.
3. Assistant asks only useful missing questions.
4. User answers in flexible text.
5. Assistant updates one active draft.
6. Assistant shows a clear summary.
7. Assistant can open FAQ Builder with all collected state.
8. FAQ Builder receives:
   - subjects
   - workflow type
   - audience
   - source URL / source guidance
   - optional custom categories or prompt guidance if collected.

Only after this feels good, add adapters for:

- AI Translation Engine
- Meta Tags Studio
- Schema Builder
- AI FAQ Audit
- AI Site Audit Crawler
- FAQ Editing Workspace
- File edit draft / general abilities

## User Expectations

The user does not want another decorative chat. They want a real working assistant that can become the main interface.

The assistant should feel like:

- a normal AI chat,
- aware of the tools,
- capable of asking smart questions,
- capable of deciding when a tool is needed,
- capable of answering generally,
- capable of using existing jobs safely,
- expandable as new features are added.

The assistant should not feel like:

- a keyword router,
- a form generator,
- a repeated action-card factory,
- a chat that asks questions but does not progress.

