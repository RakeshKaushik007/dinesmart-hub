# Mobile Polish Pass — Light Touch, App-Wide

Goal: clean up the cluttered/tight feel on phone viewports (<640px) without changing layouts, navigation, or any business logic. Pure presentation tweaks.

## Scope (all four areas you picked)

1. Billing / order taking (`BillingPage.tsx`)
2. Tables + Kitchen (`TablesPage.tsx`, `KitchenDisplayPage.tsx`, `ActiveOrdersPage.tsx`)
3. Dashboards (`OwnerDashboard.tsx`, `ManagerDashboard.tsx`, `EmployeeDashboard.tsx`)
4. App-wide chrome (`AppLayout.tsx`, `AppSidebar.tsx`, shared card/table patterns)

## What "light polish" means here

No redesign, no nav restructure, no new components. I'll do a sweep targeting these recurring mobile issues:

- **Outer padding** — replace `p-6`/`p-8` with `p-3 sm:p-6` so phones get breathing room without wasted edge space
- **Page headers** — stack title + action buttons vertically on mobile, shrink heading sizes (`text-3xl` → `text-xl sm:text-2xl md:text-3xl`)
- **Stat card grids** — ensure they're `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4` (not 1-col cramped or 4-col squished) with smaller numeric font on mobile
- **Tables** — add `overflow-x-auto` wrappers and `whitespace-nowrap` on cells that are wrapping ugly; reduce row padding on mobile
- **Tap targets** — bump small icon buttons to min 40×40 on touch (`h-10 w-10` on mobile, current size on `sm:`)
- **Cart / KOT cards** — reduce internal padding on mobile, tighten gaps, make qty +/- buttons larger
- **Sidebar drawer** — make sure overlay close + active state are crisp; slightly wider on mobile so labels don't wrap
- **Top mobile bar** — `AppLayout` mobile header gets a touch more vertical padding and a subtle shadow so content scroll feels separated
- **Dialogs/sheets** — ensure DialogContent has `max-h-[90vh] overflow-y-auto` and `w-[calc(100vw-1.5rem)]` on mobile so they don't run off-screen
- **Charts (Owner dashboard quadrant)** — set a fixed mobile min-height and shrink legend text so it doesn't overlap

## Out of scope (explicitly)

- No new components, no bottom tab bar, no sheet-style dialog rework
- No business logic, no data fetching changes, no schema changes
- No theme/token changes (`index.css`, `tailwind.config.ts` untouched)
- Desktop layout (≥sm) stays visually identical

## Approach

Single sweep across the files above using small, targeted className diffs. I'll verify on a 375×812 mobile preview after edits and iterate on any visibly cramped spot.

## Risks

Low — purely className changes. Main risk is accidentally over-shrinking something on desktop, which I'll guard against by using `sm:`-prefixed overrides that preserve current desktop values.
