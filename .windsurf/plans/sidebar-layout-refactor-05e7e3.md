# Plan: Sidebar Layout Refinement & Tabbed View Option

This plan outlines the steps to fix the non-functional accordion logic and introduce an optional tab-based layout for the sidebar in `DayDrawer.tsx` to manage vertical density.

## 1. Diagnostics & Fixing Existing Accordion
- **Issue**: Accordion sections reportedly do not collapse or expand as expected.
- **Root Cause Analysis**: 
    - The current `isExpanded` logic `expandedTechIds.has(tech.id) || (totalCount > 0 && visibleTechs.length === 1)` is too aggressive; it forces expansion if there's only one technology, potentially overriding manual collapse.
    - The CSS `grid-rows-[0fr]` transition requires a specific container structure to animate correctly.
- **Fix**: 
    - Refine `isExpanded` to prioritize user intent (`expandedTechIds`) or provide a cleaner "auto-expand" that doesn't block manual toggle.
    - Audit the Tailwind transition classes and ensure `grid-template-rows` is correctly applied to the animating container.

## 2. Global Layout Toggle (ArchitectUX)
- **Objective**: Provide a way for users to switch between 'Stacked' (Accordion) and 'Tabbed' (Horizontal) views.
- **Action**:
    - Add a `sidebarLayout` state ('stacked' | 'tabbed') in `DayDrawer`.
    - Persist this preference in `localStorage` so it remains consistent across sessions.
    - Add a toggle UI in the `SheetHeader` (using `LayoutGrid` and `Columns` icons from `lucide-react`).

## 3. Tabbed Layout Implementation (UI Designer & Frontend Developer)
- **Objective**: Create a horizontal tab switcher within each technology card when 'Tabbed' mode is active.
- **Design**:
    - Add a sub-navigation bar below the Technology name.
    - Tabs: **Work Hours** (with count) and **Standby** (with count).
    - Content Area: Swaps between the two lists within the same vertical space.
- **Implementation**:
    - Use local state within `ShiftColumn` or per-tech state to track the active tab.
    - Leverage existing `UserCard` components in both views.
    - Ensure smooth transitions when switching tabs.

## 4. Maintenance & Cleanup
- **Code Hygiene**: Reuse existing sub-components to avoid bloat.
- **Responsiveness**: Ensure the tab layout handles the 800px sidebar width gracefully on smaller screens (the sidebar is already responsive, so the tabs should follow).
- **Update Documentation**: Reflect the new layout option in `CHANGELOG.md` and `GROUND_TRUTH.md`.

## 5. Verification
- Manual testing of accordion toggle.
- Manual testing of layout mode persistence.
- Manual testing of tab switching within technologies.
- Final build check.

## 6. Mobile
- Make checks mobile responsivnes for dashboard if is ok on all sizes.