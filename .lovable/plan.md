## Goal
Add a small cloud-sync status indicator to the shared app layout, while preserving the requested exact file content and edits.

## Changes
1. Create `src/components/SyncStatus.tsx` with the exact supplied content.
2. In `src/components/layout/AppLayout.tsx`, add the `SyncStatus` import and render it immediately before `SystemBanners`, applying only the two supplied replacements.

## Verification
- Run the TypeScript check and report whether it passes.
- Make no database changes and touch no files beyond the one new component and the layout file.

## Safety checks completed
- `SyncStatus.tsx` does not already exist.
- `AppLayout.tsx` contains `SystemBanners`.
- Both requested FIND strings appear exactly once in `AppLayout.tsx`.