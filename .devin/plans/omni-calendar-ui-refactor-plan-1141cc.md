# Omni-Calendar UI/UX Refinement & Privilege Audit

Multi-agent plan to fix permission leaks, resolve UI bugs in modals, and improve the calendar day detail view for better information density and usability.

## 1. Privilege & Access Control Audit (Lead: **Debug Surgeon**)
- **Fix Role-Scoped Visibility**: Update `canCreateShift` and `canAddToColumn` in `DayDrawer.tsx` to ensure `Manager` users can only mutate shifts/assignments within their own domain (`SIAE` or `ENG`).
- **Domain Locking**: Ensure the "+ Add Technology" and "+ Shift" buttons are hidden for domains the user doesn't belong to (unless `isAdmin`).

## 2. UI/UX Optimization (Lead: **UX Architect** + **Frontend Developer**)
- **Redesign UserCard**: Update `UserCard.tsx` to handle narrow layouts better.
    - Remove or intelligently handle `truncate` on names to ensure visibility.
    - **Conditional Detail Visibility**: Show `Phone Number` and `Standby Role` (Primary/Backup) on hover or for specific administrative roles to save space in narrow columns.
    - Improve visual hierarchy for availability and vacation status.
- **DayDrawer Layout**: Increase information density. Ensure all technologies can be seen even as the list grows. Add a persistent "+ Add Technology" button at the bottom of each column.

## 3. Bug Remediation & Feature Prefills (Lead: **Debug Surgeon** + **Frontend Developer**)
- **Fix Modal Auto-Close**: Investigate and fix the issue where clicking inside `AddAssignmentDialog` closes the modal. Check for event bubbling and backdrop click handler logic.
- **Standby Prefill Logic**: Enhance `AddAssignmentDialog.tsx` to:
    - Automatically select `PRIMARY` if it's the first standby for the shift.
    - Better prefill phone numbers from the user profile.
    - Ensure the UI clearly indicates why a role was auto-selected.

## 4. Mobile & Scalability Check (Lead: **Frontend Developer**)
- **Responsive Audit**: Verify the `DayDrawer` and `UserCard` adapt correctly to mobile screen widths (single column vs two column).
- **Scalability**: Test with multiple technology shifts and many assignments to ensure the scroll area in `DayDrawer` works as expected.

## 5. Quality Assurance (Lead: **Code Reviewer**)
- **Code Audit**: Verify adherence to `AI.md` standards (e.g., `cn()` usage, `lucide-react`, `date-fns`).
- **Build Gate**: Run `npm run build` to ensure zero regressions or warnings.
