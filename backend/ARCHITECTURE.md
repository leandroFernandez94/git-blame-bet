# Backend Architecture — Git Blame Bet

## Directory Structure

```
backend/src/
├── index.ts                         # HTTP + WS server entry point (router)
├── game/
│   ├── engine.ts                    # Game lifecycle orchestrator (mediator)
│   ├── state.ts                     # In-memory game state store (pure)
│   ├── repo-processor.ts            # Clone → parse → build rounds pipeline
│   └── snippet-extractor.ts         # AST-based TypeScript snippet extraction
├── github/
│   └── client.ts                    # GitHub API client + git clone
├── websocket/
│   └── handler.ts                   # WebSocket connection/message handling
└── utils/
    ├── git-blame.ts                 # Git blame parsing + email-to-login mapping
    ├── qr.ts                        # QR code generation
    ├── cleanup.ts                   # Timer-based resource cleanup (TTL)
    └── id.ts                        # Game code generation
```

**11 source files**, 4 modules + entry point.

---

## Layered Architecture

```mermaid
block-beta
  columns 1
  block:transport["Transport Layer"]
    A["index.ts (HTTP router)"]
    B["websocket/handler.ts (WS protocol)"]
  end
  block:orchestration["Orchestration Layer"]
    C["game/engine.ts (mediator, timers, broadcast)"]
  end
  block:domain["Domain Layer"]
    D["game/state.ts (pure state machine)"]
    E["game/repo-processor.ts (data pipeline)"]
    F["game/snippet-extractor.ts (AST parsing)"]
  end
  block:infra["Infrastructure Layer"]
    G["github/client.ts (GitHub API + git CLI)"]
    H["utils/* (QR, blame, cleanup, IDs)"]
  end
  block:shared["Shared Contract"]
    I["@git-blame-bet/shared (types, constants)"]
  end

  transport --> orchestration
  orchestration --> domain
  domain --> infra
  infra --> shared
```

---

## Dependency Graph

```mermaid
graph TD
  index["index.ts"]
  handler["websocket/handler.ts"]
  engine["game/engine.ts"]
  state["game/state.ts"]
  repo["game/repo-processor.ts"]
  snippet["game/snippet-extractor.ts"]
  github["github/client.ts"]
  blame["utils/git-blame.ts"]
  cleanup["utils/cleanup.ts"]
  qr["utils/qr.ts"]
  id["utils/id.ts"]

  index --> handler
  index --> state
  index --> qr

  handler -- "createEngine()" --> engine
  handler -. "direct read (Refactor #1)" .-> state
  handler --> qr

  engine --> state
  engine --> repo
  engine --> cleanup

  repo --> github
  repo --> snippet
  repo --> blame
  repo --> cleanup

  snippet --> blame
  state --> id
```

Handler creates the engine instance at module level via `createEngine()`, passing
its WebSocket transport functions (`broadcastToGame`, `sendToPlayerSocket`) as
constructor dependencies. The engine is transport-agnostic — it never knows about
WebSockets, only about the `broadcast` and `sendToPlayer` function signatures.

---

## State Machine

```mermaid
stateDiagram-v2
  [*] --> Lobby
  Lobby --> Loading : admin starts
  Loading --> Ready : repo processed
  Loading --> Lobby : on failure
  Ready --> Playing : admin starts
  Playing --> Results : all rounds done
  Results --> [*]
```

Valid transitions enforced in `state.ts:93-118` via a lookup table.

---

## Data Flow: Full Game Lifecycle

```mermaid
sequenceDiagram
  participant C as Client
  participant H as handler.ts
  participant E as engine.ts
  participant S as state.ts
  participant R as repo-processor

  Note over C,R: 1. CREATE GAME
  C->>H: lobby:create
  H->>E: handleCreateGame()
  E->>S: createGame()
  E-->>H: gameId
  H-->>C: lobby:created + lobby:state

  Note over C,R: 2. JOIN GAME
  C->>H: lobby:join
  H->>E: handleJoinGame()
  E->>S: addPlayer()
  E-->>C: broadcast lobby:player_joined
  E-->>C: send lobby:state

  Note over C,R: 3. LOAD REPO
  C->>H: game:start (from lobby)
  H->>E: handleStartLoading()
  E->>S: transitionTo(Loading)
  E->>R: processRepo()
  R-->>E: rounds[]
  E->>S: setRounds() + transitionTo(Ready)
  E-->>C: broadcast game:ready

  Note over C,R: 4. PLAY ROUNDS
  C->>H: game:start (from ready)
  H->>E: handleStartGame()
  E->>S: transitionTo(Playing)
  E-->>C: broadcast round:start

  loop Each round (tick every 1s)
    E-->>C: broadcast round:tick
  end

  Note over C,R: 5. ANSWER
  C->>H: round:answer
  H->>E: handleSubmitAnswer()
  E->>S: submitAnswer()

  Note over C,R: 6. ROUND END (timeout or all answered)
  E->>S: calculateRoundScores()
  E-->>C: broadcast round:result
  Note over E: wait 3s, then next round or end

  Note over C,R: 7. GAME END
  E->>S: transitionTo(Results)
  E-->>C: broadcast game:results
```

---

## Repo Processing Pipeline

```mermaid
flowchart LR
  A["Parse URL"] --> B["Validate repo\n(must be public)"]
  B --> C["Fetch contributors\n(need >= 3)"]
  C --> D["Clone repo\n(shallow, single-branch)"]
  D --> E["Build email map\n(git log → GitHub login)"]
  E --> F["Extract snippets\n(ts-morph AST + git blame)"]
  F --> G["Build rounds\n(snippet + 3 options)"]
  G --> H["Cleanup\n(schedule temp dir removal)"]
```

Orchestrated by `repo-processor.ts`. Each step reports progress via callback to the engine, which broadcasts `game:loading` to all players.

---

## Design Patterns

| Pattern                | Where                       | Purpose                                                       |
| ---------------------- | --------------------------- | ------------------------------------------------------------- |
| **Mediator**           | `engine.ts`                 | Coordinates transport ↔ state without direct coupling         |
| **State Machine**      | `state.ts` transition table | Enforces valid phase transitions                              |
| **Dependency Injection** | `engine.ts` `createEngine()` factory | Handler injects transport fns at construction — no mutable module state |
| **Pipeline**           | `repo-processor.ts`         | Linear data transformation: URL → rounds                      |
| **Repository**         | `state.ts` CRUD functions   | Abstract over in-memory Map (swappable to DB)                 |
| **Observer**           | broadcast/sendToPlayer      | Pub/sub for game events to connected clients                  |
| **Strategy Cascade**   | `git-blame.ts` buildEmailMap | Multiple matching strategies tried in order of specificity    |
| **Oversample + Filter**| `snippet-extractor.ts`      | Extract 5x candidates, filter after blame attribution         |

---

## External Dependencies

| Package                    | Purpose                         | Used In                 |
| -------------------------- | ------------------------------- | ----------------------- |
| `@git-blame-bet/shared`   | Shared types, constants, messages | All modules             |
| `ts-morph` ^24.0.0        | TypeScript AST parsing          | `snippet-extractor.ts`  |
| `qrcode` ^1.5.4           | QR code data URL generation     | `utils/qr.ts`           |

**Bun-specific APIs:** `Bun.serve()`, `Bun.spawn()`, `Bun.$`, `Bun.file()`

---

## Refactor Opportunities

### 1. Layer Violation: handler reads state directly

**Where:** `websocket/handler.ts:5` imports `getGame` from `state.ts`
**Used at:** `lobby:create` (line 104) and `game:start` (line 147)

**Problem:** The handler bypasses the engine layer to read state directly. This breaks the clean Transport -> Engine -> State layering and makes the handler coupled to state internals.

**Note:** The previous DI coupling (`setBroadcast`/`setSendToPlayer` mutable setters) was already resolved by refactoring the engine to a `createEngine()` factory. This remaining `getGame` import is the last direct state dependency in the handler.

**Fix:** Add corresponding methods in `engine.ts` that the handler calls instead. The handler should ONLY talk to the engine.

---

### 2. No route abstraction in `index.ts`

**Where:** `index.ts:100-111`

**Problem:** Routes are matched with manual `if/startsWith` chains. As endpoints grow, this becomes a maintenance burden with no middleware support, no parameter extraction, and no method-based routing.

**Fix:** Extract a lightweight router (pattern-match table or `Map<string, handler>`) that supports path params, HTTP method matching, and composable middleware. No need for Express/Hono — a simple abstraction over the existing pattern is enough.

---

### 3. `handler.ts` does too much in message handlers

**Where:** `websocket/handler.ts:93-180`

**Problem:** The `lobby:create` handler (lines 94-129) does socket binding, game creation, QR generation, AND sends multiple messages. It mixes transport concerns (socket map management) with application logic (QR generation, state reads).

**Fix:** Split into:
- **Socket management** (bind/unbind, socket map) — stays in handler
- **Application responses** (what to send back) — move to engine, which returns response payloads

---

### 4. Timer management is scattered in `engine.ts`

**Where:** `engine.ts` — `roundTimers` map (line 38), `startNextRound` (lines 140-175), `endRound` (lines 177-209), `endGame` (lines 211-227), `handleSubmitAnswer` (lines 245-253)

**Problem:** Round timers (`setTimeout`, `setInterval`) are managed manually with a `roundTimers` map inside the `createEngine` closure. Timer lifecycle (create, clear, auto-advance) is interleaved with game logic in 4 separate functions. If a new timer type is needed (e.g., loading timeout), the pattern must be duplicated.

**Fix:** Extract a `TimerManager` or `RoundTimer` class that encapsulates the tick interval + timeout pattern. The engine calls `timerManager.startRound(gameId, duration, onTick, onEnd)` instead of managing raw timer refs.

---

### 5. Unused code

**Where:**
- `github/client.ts:77-89` — `getRepoTree()` is never called
- `utils/id.ts:1` — `generateId()` is never called
- `GameConfig.fileTypes` and `GameConfig.githubToken` — defined in shared types but unused

**Fix:** Remove dead code. If these are planned features, track them in issues instead of leaving ghost code.

---

### 6. Hardcoded TypeScript-only support

**Where:** `snippet-extractor.ts` — uses `ts-morph`, filters `.ts/.tsx` only, always sets `language: "typescript"`

**Problem:** The architecture implies multi-language support (snippet has a `language` field, config has `fileTypes`), but the implementation only handles TypeScript. This creates a false API contract.

**Fix:** Either:
- (a) Make it explicit: remove the `language`/`fileTypes` flexibility from the types until multi-language is actually implemented
- (b) Abstract extraction behind a `LanguageExtractor` interface and implement TypeScript as the first strategy, with a registry pattern for adding languages later

---

### 7. `git-blame.ts` is too complex (236 lines, 6 matching strategies)

**Where:** `utils/git-blame.ts:13-147` — `buildEmailMap()`

**Problem:** A single 135-line function with 6 nested matching strategies, multiple loops, and complex fallback logic. Hard to test individual strategies, hard to debug when matching fails.

**Fix:** Extract each strategy as a named function or into a strategy pattern array:
```typescript
const strategies: EmailMatchStrategy[] = [
  noreplyMatch,
  numberedNoreplyMatch,
  emailPrefixMatch,
  nameMatch,
  sameNameGroupMatch,
  rankHeuristicFallback,
];
```
Then `buildEmailMap()` just iterates strategies until all emails are resolved.

---

### 8. No error boundaries in the processing pipeline

**Where:** `repo-processor.ts` — the pipeline is linear with no granular error handling

**Problem:** If `extractSnippets()` fails, the entire pipeline fails and the game goes back to Lobby. But some failures are recoverable (e.g., retry clone, skip individual files). Progress callbacks exist but there's no structured error per step.

**Fix:** Add typed `PipelineError` per step. Consider a result-type pattern (`{ ok: true, data } | { ok: false, error, step }`) so the engine can decide whether to retry or abort per step.

---

### 9. No persistence layer

**Where:** `game/state.ts` — all state in a `Map<string, GameRoom>`

**Problem:** Server restart kills all active games. No crash recovery, no multi-instance support.

**Fix (when needed):** Since `state.ts` already acts as a repository abstraction, introducing persistence (Redis, SQLite) would only require replacing the internal `Map` with a store adapter behind the same function signatures.

---

### 10. Magic numbers and inline config

**Where:**
- `engine.ts` — 3-second pause between rounds (hardcoded)
- `snippet-extractor.ts` — 5x oversample ratio, 4-25 line range (from shared constants but still magic)
- `handler.ts` — 10-second handshake timeout
- `cleanup.ts` — 60-second temp cleanup delay

**Fix:** Consolidate all timing/config constants into the shared package or a dedicated `config.ts` with named exports and documentation of what each value does.

---

### Priority Matrix

| #  | Opportunity                        | Impact  | Effort | Priority    |
| -- | ---------------------------------- | ------- | ------ | ----------- |
| 1  | Handler reads state directly       | Medium  | Low    | **Do first** |
| 5  | Remove unused code                 | Low     | Low    | **Do first** |
| 10 | Consolidate magic numbers          | Medium  | Low    | **Do first** |
| 3  | Handler does too much              | Medium  | Medium | **Do next**  |
| 4  | Extract timer management           | Medium  | Medium | **Do next**  |
| 7  | Split git-blame strategies         | Medium  | Medium | **Do next**  |
| 2  | Route abstraction                  | Low     | Medium | **Plan**     |
| 8  | Pipeline error boundaries          | Medium  | Medium | **Plan**     |
| 6  | Multi-language extraction          | Low     | High   | **Defer**    |
| 9  | Persistence layer                  | High    | High   | **Defer**    |
