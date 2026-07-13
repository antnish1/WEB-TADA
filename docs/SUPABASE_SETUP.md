# Supabase setup

## 1. Create the local environment file

Copy `.env.example` to `.env.local` and add the project URL and anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Do not commit `.env.local`. Never place the Supabase `service_role` key in a browser application.

## 2. Apply the database migration

1. Open the Supabase project dashboard.
2. Open **SQL Editor**.
3. Open `supabase/migrations/001_deputation_foundation.sql` from this repository.
4. Paste the complete SQL into a new query.
5. Run the query once.

The migration creates the branch, profile, engineer, daily-plan, deputation, status-history and audit-log foundation, including Row Level Security policies.

## 3. Start the application

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4. Security notes

- The anon key may be used by the frontend only with Row Level Security enabled.
- Never share or commit the `service_role` key.
- Production users must be created through Supabase Auth and mapped to a profile and branch.
- File buckets for selfies, hotel bills and supporting documents should be private.
