# CLAUDE.md

# Recipe Lab
Recipe development app: users draft recipes, save versions, publish.

# Layout
/web: React + TS (Vite), React Router, Tailwind
/api: Express + Prisma (SQLite dev)
# Commands
web: npm run dev | npm test | npx playwright test
api: npm run dev | npm test | npx prisma migrate dev
# Rules
TypeScript strict; no any.
Every new feature ships with tests; run them before saying you're done.
Versions are immutable snapshots; never update a RecipeVersion row.
Ask before adding a new dependency.
## Commands

Run these from within a frontend directory (`recipe-lab/web` or `my-app`). Run `npm install` first: `recipe-lab/web` has no `node_modules` yet.


No test runner is configured in any package yet.

## TypeScript / lint notes

- The frontend uses TypeScript ~7 with `tsconfig.json` project references (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`). It uses bundler module resolution and `noEmit`, so Vite handles the bundling.
- `tsconfig.app.json` enables `verbatimModuleSyntax` (use `import type` for type-only imports), `erasableSyntaxOnly` (no `enum`, `namespace`, or constructor parameter properties), and `noUnusedLocals`/`noUnusedParameters`. Code that breaks these rules fails `npm run build`.
- oxlint enforces `react/rules-of-hooks` (error) and `react/only-export-components` (warn, which matters for Fast Refresh).
