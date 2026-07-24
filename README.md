# REJO

REJO is an offline-first progressive web application for small dairy farms in Carchi, Ecuador.

## Phase 0

Phase 0 is intentionally limited to four product screens:

- Home
- Record Milk
- My Cows
- Settings

The app records the daily tank measurement locally before any network operation. It uses Dexie for IndexedDB persistence and an outbox that synchronizes to Supabase when connectivity returns.

## Local development

1. Install Node.js 20 or newer.
2. Copy .env.example to .env.local.
3. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when a Supabase project is available.
4. Run npm install.
5. Run npm run dev.

Without Supabase environment variables, the application runs in local provisioning mode for offline development. With Supabase configured, it uses email magic-link authentication and the database migration in supabase/migrations.

## Quality checks

Run npm run check to lint, test, type-check, and build the PWA.

## Language conventions

Code, code comments, commits, and issue titles use English. Product interface strings use Spanish from the Carchi glossary. GitHub issue descriptions use Spanish.
