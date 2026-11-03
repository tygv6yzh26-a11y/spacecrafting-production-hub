<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Workflow rules (statuses, stages, deadline = shoot + 3 days, overdue/at-risk) live only in `src/lib/workflow.ts`; views derive from it so status logic stays in one place.
- Production data is read/written from the browser Supabase client under RLS; access requires a row in `user_roles` (first signup becomes admin) so unapproved accounts see nothing.
- Spreadsheet import parses .xlsx client-side (`src/lib/import-sheet.ts`) and upserts on `jobs.import_key` with ignoreDuplicates so re-imports never duplicate or overwrite jobs.
