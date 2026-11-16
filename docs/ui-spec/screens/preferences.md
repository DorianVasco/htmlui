# Preferences

Navigation ID `preferences`. Source: `src/app/pages/preferences/PreferencesPage.tsx`, `NotificationProfiles.tsx`, `src/app/preferences.tsx`, `src/app/cli.tsx`.

Header: title “Preferences”, description “Settings for this user interface and for notifications.” Content max 760 px. Works without a repository connection.

## Appearance card

Title “Appearance”. Each row: label (medium weight) and dimmed hint on the left, control on the right.

| Label                     | Hint                                                                                        | Control                                                    | Stored                          |
| ------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------- |
| Theme                     | Stored in this browser.                                                                     | Segmented “Auto / Light / Dark” (default Auto = follow OS) | locally                         |
| Sizes                     | For example {1536000 formatted with the current setting}. Stored on the server.             | Segmented “1 KB = 1000 bytes” / “1 KiB = 1024 bytes”       | server `bytesStringBase2`       |
| Show all users' snapshots | When the server holds snapshots of several users or computers, list all of them by default. | Switch                                                     | server `defaultSnapshotViewAll` |
| Show CLI equivalents      | Show the kopia command line for what a page does. Stored in this browser.                   | Switch (default off)                                       | locally                         |

- Server-stored controls are disabled until preferences have loaded and while a save runs. Save = merge into the stored preferences and `PUT ui-preferences` ([shell.md](../shell.md#server-side-preferences)). Failure → red toast “Could not save preferences”.
- Native: change the hints “Stored in this browser.” to “Stored on this computer.” The example sizes read “1.5 MB” / “1.5 MiB”.

## Notifications card

Without a connection: card “Notifications” with “Notification profiles are stored in the repository. Connect to a repository to manage them.”

When connected: card with header “Notifications” and help “Get snapshot reports and errors by e-mail, Pushover or a webhook.”, plus light button “Add profile” (`IconPlus`) with a menu: “E-mail” (`IconMail`), “Pushover” (`IconBell`), “Webhook” (`IconWebhook`).

Data: `GET notificationProfiles` (once; refetched after save/delete). Note: the server returns `null` when there are no profiles.

List (min width 480 px):

| Column        | Content                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile       | name (medium)                                                                                                                                      |
| Method        | method icon + label (“E-mail”, “Pushover”, “Webhook”; unknown types show the raw type)                                                             |
| From severity | badge with `severityLabel(minSeverity)`; orange if ≥ 10, else gray                                                                                 |
| (90 px)       | “Edit {name}” (`IconPencil`) and a menu “More actions for {name}”: “Send test” (`IconSend`), “Duplicate” (`IconCopy`), “Delete” (red, `IconTrash`) |

Empty: bell icon + “No notification profiles yet. Without one, Kopia doesn't tell you when snapshots fail.” (“Loading…” while loading). Load failure: red alert “Could not load notification profiles”.

Actions:

- **Add**: opens the profile dialog with a new profile: name `newProfileName(type)` (e.g. “email-1”), the method's defaults, minimum severity 0 (Report).
- **Duplicate**: the same with a copy of the profile's settings and a new free name.
- **Send test** (row menu): `POST testNotificationProfile` with the saved profile. Success → green toast “Test notification sent”, “Check that “{name}” arrived.” Failure → red toast “Sending failed”.
- **Delete**: confirmation “Delete notification profile?”, text ““{name}” will no longer receive notifications.”, buttons “Cancel” / red “Delete”. Calls `DELETE notificationProfiles/{name}`, reloads, closes. Failure → red toast “Could not delete”.

### Profile dialog

Title “New notification profile” / “Edit notification profile”. Wide modal.

Fields ([fields.md](../fields.md#notification-profiles)): “Profile name” (read-only when editing), “Minimum severity”, then the method's fields.

Validation (shown after the first Save or Send test attempt): profile name required; a new name must be unique (“A profile with this name exists”); the method's required fields must be non-blank (“Required”), see `missingFields`.

Buttons:

- Left: “Send test” (`IconSend`) → `POST testNotificationProfile` with the profile as edited (not saved). Success → green toast “Test notification sent”, “Check that it arrived.”
- Right: “Cancel” and primary “Create profile” (new) / “Save” → `POST notificationProfiles` (creates or replaces by name), reload, close.
- Errors show inside the dialog as a red alert titled “Sending failed” or “Could not save”.
- The name is trimmed before sending.
