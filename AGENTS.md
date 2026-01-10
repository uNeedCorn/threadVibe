# Repository Guidelines

## Project Structure & Module Organization

- `docs/`: Product, architecture, database, backend, and frontend specs. Start with `docs/INDEX.md` before adding or changing docs so topics stay deduplicated and discoverable.
- `frontend/`: Frontend UI code (Next.js + TypeScript + Tailwind + shadcn/ui patterns).
  - `frontend/components/`: Feature and shared components (kebab-case filenames like `stats-cards.tsx`).
  - `frontend/components/ui/`: Copied shadcn/ui primitives.
  - `frontend/lib/`: Utilities (e.g., `cn()` helpers).
  - `frontend/styles/`: Global styles (e.g., `globals.css`).
- `supabase/migrations/`: SQL migrations (timestamp-prefixed, e.g., `20260110000001_initial_schema.sql`).

## Build, Test, and Development Commands

Common workflows (see `README.md` and `CLAUDE.md` for more):

```bash
cd frontend && npm install   # install frontend deps
cd frontend && npm run dev   # run Next.js dev server
cd frontend && npm run build # production build
cd frontend && npm run lint  # ESLint checks

supabase db push --linked    # apply migrations to cloud
supabase functions deploy    # deploy all Edge Functions
supabase secrets set KEY=val # set Edge Function secrets
```

## Coding Style & Naming Conventions

- Match existing file formatting (some files are semicolonless; keep consistency within the file you touch).
- Use TypeScript, React function components, and Tailwind utility classes; keep components small and focused.
- Naming: files in `kebab-case`, React components in `PascalCase`, exports from `index.ts` when creating a module boundary.
- Database changes: add a new migration; avoid editing old migrations once applied.

## Testing Guidelines

- No automated test suite is present in this checkout. If you add tests, prefer `*.test.ts(x)` or `__tests__/` colocated with the code, and document how to run them in `README.md`.

## Commit & Pull Request Guidelines

- Git history isn’t available in this checkout; use clear, imperative commit subjects (or Conventional Commits like `feat:`, `fix:`, `docs:`).
- PRs should include: what/why, linked issue/task, screenshots for UI changes, and notes for any migrations/RLS or env var changes.

## Security & Configuration Tips

- Never commit secrets. Use `.env.local` for frontend config (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and `supabase secrets` for Edge Function secrets (e.g., Threads OAuth keys).
