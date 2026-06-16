# Omni-Calendar UI Refactor & Feature Alignment

This plan addresses layout bloat, role-based visibility, UI/UX enhancements, and backend data consistency.

## 1. Sidebar Layout Refactor (UI Designer + Frontend Developer)
- **Problem**: Vertical bloat in `DayDrawer.tsx` when displaying Work Hours and Standby.
- **Solution**: Switch to a side-by-side (2-column) grid for Work Hours and Standby within each technology card.
- **Agent**: **UI Designer** for CSS/Grid, **Frontend Developer** for component refactor in `@/omni-calendar-ui/src/components/DayDrawer.tsx`.

## 2. Technology Filter Logic (Backend Architect + Frontend Developer)
- **Problem**: Empty technologies showing in the sidebar across domains.
- **Solution**: 
    - **Frontend**: Update `visibleTechs` filter in `DayDrawer.tsx` to only show technologies that have at least one assignment *for the specific domain* (SIAE or ENG).
    - **Backend**: Ensure the `/shifts/` endpoint correctly filters assignments by domain if needed, or rely on frontend filtering of the combined payload.
- **Agent**: **Frontend Developer**.

## 3. Role-Based Color Precision (UI Designer)
- **Problem**: PRIMARY and BACKUP colors need better distinction.
- **Solution**: Refine the emerald (Primary) and sky (Backup) color scales in `UserCard.tsx` and `style.css` to increase visual contrast and role clarity.
- **Agent**: **UI Designer**.

## 4. Availability Button Contrast (UI Designer)
- **Problem**: "Available" button contrast issues.
- **Solution**: Update the button styles in `UserCard.tsx` to meet WCAG AA/AAA contrast guidelines.
- **Agent**: **UI Designer**.

## 5. Add User Button Visibility (Backend Architect + Frontend Developer)
- **Problem**: "Add User" button should only show for Admin/Superusers and CR users in specific contexts.
- **Solution**: 
    - **Frontend**: Update `canAddUser` logic in `DayDrawer.tsx` to check `user.is_superuser` and role `CR`.
    - **Backend**: Update `UserSerializer` or `AuthContext` to ensure `is_superuser` is available to the frontend.
- **Agent**: **Backend Architect** (for API) and **Frontend Developer** (for UI logic).

## 6. Backend Data Audit (Database Optimizer + Backend Architect)
- **Problem**: Ensure fields like availability, vacation, and tech counts are accurate.
- **Solution**: Review `calendar_app/views.py` and `models.py` for $N+1$ issues and ensure annotation logic for `vacation_status` and `assignment_count` is consistent across all views.
- **Agent**: **Database Optimizer** and **Backend Architect**.

## 7. Calendar Cell Hover Effects (UI Designer)
- **Problem**: Calendar cells need better interaction feedback.
- **Solution**: Add smooth hover transitions, elevation, or border highlighting to `CalendarCell.tsx`.
- **Agent**: **UI Designer**.

## 8. "Standby Ready" Summary (UX Architect + Frontend Developer)
- **Problem**: Need quick glance visibility for standby status.
- **Solution**: Add a "Standby Ready" badge/icon to `CalendarCell.tsx` that appears only if at least one Primary/Backup standby is assigned for that day.
- **Agent**: **UX Architect** for placement, **Frontend Developer** for implementation.

## 9. Documentation (Technical Writer)
- **Problem**: Documentation needs update after changes.
- **Solution**: Update `CHANGELOG.md` and `GROUND_TRUTH.md` to reflect architectural changes and new UI patterns.
- **Agent**: **Technical Writer**.

## Implementation Order
1. **Backend Verification** (Task 6)
2. **Auth/Permission Updates** (Task 5)
3. **Sidebar & Tech Filtering** (Tasks 1 & 2)
4. **Visual Refinements** (Tasks 3, 4, 7, 8)
5. **Docs** (Task 10)
