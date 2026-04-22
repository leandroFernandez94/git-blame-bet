# Git Blame Bet

Multiplayer trivia game: guess which GitHub contributor wrote a code snippet.

Players join a room, the server clones a real GitHub repo, extracts TypeScript snippets via AST parsing, runs `git blame` for attribution, and presents 20 rounds of multiple-choice questions in real-time via WebSockets.

## Prerequisites

- [Bun](https://bun.sh) v1.1+
- Git (for cloning repos during gameplay)
- A GitHub personal access token (optional, but recommended to avoid API rate limits)

## Setup

```bash
# Install all dependencies (root, backend, frontend, shared)
bun install
```

### Environment variables

Create a `.env` file in the `backend/` directory:

```bash
# backend/.env
GITHUB_TOKEN=ghp_your_token_here   # optional — higher GitHub API rate limits
PORT=3000                           # default: 3000
PUBLIC_URL=http://localhost:5173    # frontend URL for CORS/links in dev
```

> Without `GITHUB_TOKEN`, the GitHub API allows 60 requests/hour. With a token you get 5,000/hour.
> You can create one at https://github.com/settings/tokens (no scopes needed for public repos).

## Running (development)

You need two terminals:

**Terminal 1 — Backend** (Bun WebSocket server on port 3000):

```bash
bun run --cwd backend dev
```

**Terminal 2 — Frontend** (Vite dev server on port 5173, proxies `/api` and `/ws` to backend):

```bash
bun run --cwd frontend dev
```

Open http://localhost:5173 in your browser.

## How to play

1. Enter a public GitHub repo URL (e.g. `https://github.com/facebook/react`) and a nickname
2. Share the game link or QR code with friends
3. The server clones the repo, extracts TypeScript snippets, and runs git blame
4. 20 rounds: each round shows a code snippet and 3 contributor options — guess who wrote it
5. 15 seconds per round, +1 point for correct answers
6. Final leaderboard at the end

## Project structure

```
git-blame-bet/
├── packages/shared/    # Shared types and constants (@git-blame-bet/shared)
├── backend/            # Bun HTTP + WebSocket server
│   └── src/
│       ├── index.ts           # Entry point (Bun.serve)
│       ├── websocket/         # WS message handler
│       ├── game/              # Engine, state machine, snippet extraction
│       ├── github/            # API client, git clone
│       └── utils/             # Git blame, QR, cleanup
├── frontend/           # React 19 + Vite + Tailwind
│   └── src/
│       ├── pages/             # Home, Lobby, Join, Playing, Results
│       ├── components/        # UI components
│       ├── context/           # GameContext (useReducer)
│       └── hooks/             # useWebSocket
├── package.json        # Bun workspaces root
└── tsconfig.base.json  # Shared TypeScript config
```


<!-- Fix #12 -->
