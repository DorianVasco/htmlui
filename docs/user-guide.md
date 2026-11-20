# Using the Kopia UI

This guide explains how to back up and restore files with the Kopia user interface. It applies to KopiaUI (the desktop app) and to the web interface of a Kopia server, which look the same.

Kopia stores backups in a **repository**: a folder, a cloud bucket or a server. Everything is encrypted before it leaves your computer. A **snapshot** is a backup of one folder at one point in time. Kopia only stores what changed since the last snapshot, so regular snapshots are fast and small.

## Contents

- [The window](#the-window)
- [Set up a repository](#set-up-a-repository)
- [Back up a folder](#back-up-a-folder)
- [See what is backed up](#see-what-is-backed-up)
- [Browse and restore files](#browse-and-restore-files)
- [Keep or label snapshots](#keep-or-label-snapshots)
- [Schedules, retention and file rules (policies)](#schedules-retention-and-file-rules-policies)
- [Follow running work (tasks)](#follow-running-work-tasks)
- [Preferences and notifications](#preferences-and-notifications)
- [Work with several repositories](#work-with-several-repositories)
- [Troubleshooting](#troubleshooting)

## The window

- **Sidebar** (left): Snapshots, Policies, Tasks, Repository, Preferences. On a narrow window, open it with the menu button at the top left. The Tasks entry shows how many tasks are running. At the bottom you see whether a repository is connected and the Kopia version.
- **Header** (top): the current repository. Click its name to switch to another repository you used before. A “running” badge appears while snapshots or other tasks run; click it to see them. The sun/moon button switches between light and dark mode.

## Set up a repository

The first time you open Kopia, it asks for a repository. Later you find the same wizard under **Repository → Add repository**.

1. **Storage.** Choose where the backups go:

   | Choice                  | Use it for                                                                  |
   | ----------------------- | --------------------------------------------------------------------------- |
   | Local directory or NAS  | A folder on this computer, an external drive or a network share             |
   | Amazon S3 or compatible | AWS S3, MinIO, Wasabi, Cloudflare R2 and other S3 services                  |
   | Backblaze B2            | A Backblaze B2 bucket                                                       |
   | Google Cloud Storage    | A Google Cloud Storage bucket                                               |
   | Azure Blob Storage      | A Microsoft Azure storage container                                         |
   | SFTP server             | Any server you can reach over SSH                                           |
   | WebDAV server           | Nextcloud, ownCloud and other WebDAV servers                                |
   | Rclone remote           | Any storage rclone supports                                                 |
   | Kopia repository server | A repository someone shares through a Kopia server                          |
   | Repository token        | A token from another computer (`kopia repository status -t -s` creates one) |

2. **Location or settings.** For a local directory, type a path or pick a suggestion. `~` means your home folder, and a folder that doesn't exist yet is created. For other storage, fill in the form; fields marked with \* are required. Click **Continue**: Kopia checks the location. If a repository is already there, the next step connects to it; otherwise it creates a new one.

3. **Create or connect.**
   - Enter the **repository password**. When creating, enter it twice. **Write it down somewhere safe**: it encrypts your backups, and nobody can recover them without it.
   - **Description**: a name shown in the header, e.g. “NAS backups”.
   - **Identity of this computer** (optional): snapshots are owned by `user@computer`. Change it only if you move to a new computer and want to continue the old snapshots. When connecting, you can also connect **read-only**.
   - **Encryption and format** (only when creating): leave the recommended defaults unless you know you need something else.

   Click **Create repository** or **Connect**.

A Kopia server is connected to one repository at a time. If one is already connected, the wizard disconnects it first.

## Back up a folder

1. Go to **Snapshots** and click **New snapshot**.
2. Under **Folder to back up**, type the folder's path or pick one of the suggestions (recently used folders and common ones like Documents or Pictures). Paths are on the computer the Kopia server runs on. In KopiaUI you can also click the folder button to choose a folder.
3. Kopia shows the settings that will apply (schedule, how many snapshots it keeps, compression, ignored files). They come from your policies; see [Policies](#schedules-retention-and-file-rules-policies).
4. Optionally click **Estimate size** to see how many files and how much data the folder holds.
5. Click **Snapshot now** to add the folder and back it up right away, or **Add without snapshot** to only add it; then it's backed up on its schedule.

From then on Kopia backs up the folder according to its schedule, as long as KopiaUI or the Kopia server runs.

## See what is backed up

The **Snapshots** page lists every backed-up folder (a **source**):

- **Cards at the top**: number of sources, protected data, the next scheduled snapshot, and how many sources need attention.
- **Status of each source**:
  - _Protected_: the last snapshot worked and the next one is on time.
  - _Uploading_ with a progress bar: a snapshot is running.
  - _Pending_: waits until another snapshot finishes.
  - _Overdue_: the scheduled snapshot didn't happen (e.g. the computer was off).
  - _Never backed up_.
  - An orange _errors_ badge means some files couldn't be read; hover over it to see which.
- **Actions** per source: start (**Snapshot now**) or stop a snapshot, and under the **⋯** button: Snapshot history, Edit policy, Task details.
- **Filter** by path, and if the repository holds snapshots of several users or computers, choose whose to show.
- The **Synchronize** button (circular arrows) reloads snapshots that other computers added to the repository.

## Browse and restore files

Click a source's path to open its **history**: every snapshot with date, size, number of files and retention labels (e.g. _daily-1_ means “kept as the newest daily snapshot”).

- **Browse files** (folder icon) opens the snapshot. Click folders to open them and use the path at the top to go back.
  - **Download** a single file with the download icon.
  - **Restore this folder…** / **Restore all…** restores into a folder on the server's computer.
  - **Mount as folder** makes the whole snapshot appear as a read-only folder (or drive letter on Windows). Copy what you need, then click **Unmount**.
- **Restore…** (circular arrow icon) restores the whole snapshot. In the dialog:
  - **Restore to**: by default a new folder next to the original, named “… (restored)”. End the name with `.zip` or `.tar` to get an archive instead.
  - Choose whether to overwrite existing files and restore modification times, permissions and owners.
  - **More options**: continue on errors, or skip files restored before (to resume an interrupted restore).
  - A notification appears when the restore starts; its **Show progress** link opens the task.
- **Show identical** also lists snapshots that are identical to a newer one (Kopia hides them by default).
- To **delete snapshots**, tick them and click **Delete**. **⋯ → Delete source and all snapshots…** removes the folder from Kopia completely, including its policy. Deleting can't be undone.

## Keep or label snapshots

In a snapshot's **⋯** menu in the history:

- **Add pin…** protects the snapshot: retention never deletes a pinned snapshot. Pins appear as orange labels. Click a pin to rename it, or its small icon to remove it.
- **Add description…** / **Edit description…** gives the snapshot a note, e.g. “Before reorganizing folders”. It's shown under the date.

## Schedules, retention and file rules (policies)

Policies decide **when** snapshots run, **how many** are kept, and **which files** are left out. They apply from broad to specific:

**Global policy → computer (`@host`) → user (`user@host`) → folder.**

A more specific policy only overrides what it sets; everything else is inherited. The global policy exists from the start.

On the **Policies** page you see all policies and what each defines. Click one to edit it, or click **New policy** and enter what it applies to: a folder path (for you on this computer), `user@computer`, or `@computer`.

The editor has tabs:

| Tab         | What you set                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Schedule    | Interval (e.g. every hour), times of day (24-hour, press Enter after each), cron expressions, manual only |
| Retention   | How many latest, hourly, daily, weekly, monthly and annual snapshots to keep; skip identical snapshots    |
| Files       | Ignore rules (one per line, like `.gitignore`), ignore cache folders, size limit, stay on one drive       |
| Errors      | Whether unreadable files or folders fail the snapshot or only count as errors                             |
| Compression | Algorithm and which files to compress                                                                     |
| Upload      | How many snapshots and files to process in parallel                                                       |
| Actions     | Commands to run before or after a snapshot, e.g. to pause a database                                      |
| Logging     | How detailed snapshot logs are                                                                            |
| Other       | Don't inherit from broader policies; the policy as JSON                                                   |

**Leave a field empty to inherit it.** Under every field you see the value currently in effect and where it comes from, e.g. “Effective: 7 · from Global policy”. Yes/no settings have three choices: Inherit, Yes, No. The Schedule tab previews the next snapshot times. Click **Save** (or **Create policy**) when done.

## Follow running work (tasks)

**Tasks** lists snapshots, restores, estimates and maintenance, running ones first. Filter by status (Running, Failed) or kind. Click a task to see its details: how long it took, counters (files, bytes, errors) and its log, which follows along while the task runs. Running tasks can be canceled with the **×** button or **Cancel task**.

## Preferences and notifications

Under **Preferences**:

- **Theme**: Auto (follows your system), Light or Dark. Stored in this browser or app.
- **Sizes**: show sizes as 1 KB = 1000 bytes or 1 KiB = 1024 bytes.
- **Show all users' snapshots**: on a shared server, list everyone's sources by default.
- **Show CLI equivalents**: shows the matching `kopia` command under pages, with a copy button, for scripting.
- **Notifications** (needs a connected repository): get reports and error messages by e-mail, Pushover or a webhook. Click **Add profile**, choose the method, fill in the details and click **Send test** to check it. **Minimum severity** decides what you receive: _Warning_ or _Error_ for problems only, _Report_ for regular summaries. Without a notification profile, Kopia doesn't tell you when snapshots fail.

## Work with several repositories

Kopia remembers local repositories you used in this browser or app (never their passwords). To switch, click the repository name in the header, or go to **Repository** and click **Switch** next to one. You're asked for its password, and the server disconnects from the current repository first.

The **Repository** page also shows the connected repository's details, lets you change its description, and **Disconnect** from it. Disconnecting stops snapshots from this computer; the repository and its snapshots stay untouched.

## Troubleshooting

| Problem                                           | What to do                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Cannot reach the Kopia server”                   | KopiaUI or the Kopia server isn't running, or the network is down. Start it and click **Try again**.                                                                      |
| “The password is not correct for this repository” | Check the password. It can't be reset; without it the backups can't be opened.                                                                                            |
| A source is _Overdue_                             | Snapshots only run while Kopia runs. Start it, or click Snapshot now. Turn on **Run missed snapshots on startup** in the policy's Schedule tab.                           |
| A snapshot shows _errors_                         | Some files couldn't be read (often files open in another program). Hover over the badge to see them. The Errors tab of the policy decides whether they fail the snapshot. |
| Too much data is backed up                        | Add ignore rules in the policy's **Files** tab (e.g. `node_modules/`, `*.tmp`), or turn on **Ignore cache folders**.                                                      |
| A folder path isn't found                         | Paths are on the computer that runs the Kopia server, which may not be the computer your browser runs on.                                                                 |
