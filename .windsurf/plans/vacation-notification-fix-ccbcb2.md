# Vacation Notification System Fix

Audit and fix the vacation notification logic to ensure emails are sent to both internal recipients and external clients, even if one group is empty.

## Problem

When a Consultant (ENG role) adds a vacation, no email is sent. This occurs because the current logic in `NotificationService.send_vacation_notification` stops execution if no "opposite role" internal recipients are found, which inadvertently blocks the subsequent client notification logic.

## Root Cause

- **Backend Logic Error**: In `calendar_app/services.py`, the `send_vacation_notification` method has an early `return` if `recipients` (internal) is empty.
- **Coupled Notifications**: Internal and client notifications are sequentially dependent, where a failure or empty recipient list in the first blocks the second.

## Proposed Plan

### Backend Architect & Senior Developer

#### 1. Audit `NotificationService` in `calendar_app/services.py`
- Refactor `send_vacation_notification` to decouple internal and client notification blocks.
- Ensure that an empty internal recipient list does not prevent the client notification from being processed.
- Add descriptive logging for each notification stage (internal vs. client) to aid in future diagnostics.

#### 2. Verify Recipient Logic
- Ensure `_get_opposite_role_recipients` correctly identifies SIAE users for ENG changes.
- Verify that `CustomUser` objects have valid email addresses and `is_active=True`.

### Code Reviewer

- **Audit**: Review the refactored logic for potential silent failures or unintended side effects.
- **Security**: Ensure that client emails are only sent for users with the "ENG" role as per requirements.

### Frontend Developer

- **Verification**: Ensure that `notifications_enabled`, `notify_on_vacation_change`, and `client_email` settings are correctly populated in the admin UI.

## Detailed Steps

1.  **Modify `calendar_app/services.py`**:
    - Remove the early `return` when `recipients` is empty.
    - Wrap the internal notification logic in an `if recipients:` block.
    - Keep the client notification logic in its own `if` block, independent of internal recipients.
    - Add logging for "No internal recipients found" instead of returning.

2.  **Verify `calendar_app/signals.py`**:
    - Confirm signals are still correctly connected (they seem fine).

3.  **Testing**:
    - Trigger a vacation creation as an ENG user with no SIAE users in the system.
    - Verify client email is still sent.
    - Trigger a vacation creation with both SIAE users and a client email.
    - Verify both receive notifications.

## Agents Involved (from @[.windsurf/rules/agents.md])

- **Backend Architect**: For structural redesign of the notification service.
- **Senior Developer**: For robust implementation of the logic.
- **Code Reviewer**: For auditing the correctness and security of the email flow.
- **Frontend Developer**: For ensuring UI settings alignment.
