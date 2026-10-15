# Token Risk Console

Read-only research dashboard for an Ethereum token. Each security provider keeps its own result. The console does not trade, connect a wallet, request a signature, or treat a token as safe.

## Run

```bash
npm install
npm run dev
```

The dev server uses the `/Scanner/` base path: `http://localhost:5173/Scanner/`.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run dev` and `npm run preview` host `/api/scan`. GitHub Pages publishes the console at `https://jackmiller825.github.io/Scanner/`. On that page, GoPlus and Honeypot.is are called from the browser. Providers that need an API key stay Not configured.

Copy `.env.example` to `.env` and supply only the keys you have. Empty providers stay **Not configured** or **Manual / link-out only**. Details are in `INTEGRATIONS.md`.

Scan history is written to `data/scan-history.json`. That file is local and gitignored. It stores contract addresses and provider responses, not API keys.
