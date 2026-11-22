# Plan: Encrypt the budget file

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-22 |

## Goal

Make a `.folio` file unreadable to anyone who gets a copy of it without the household's keys: a sync provider, a backup, a USB stick, another account on the same computer. Everyday use stays free of passwords. The household keeps one recovery code, shown once, for the day a computer is lost or a second computer opens the file. Decision record: [AD-22](../knowledge/architecture/09_architecture_decisions.md#ad-22-the-budget-file-is-encrypted-as-a-whole-with-aes-256-gcm).

## Scope

- In: the container format around the zip (AD-2 keeps the zip inside), the recovery code and its screens, the machine key store, atomic save and encrypted backups, migration of plain files, a developer script and test-key support.
- Out, for now: a user password or passphrase, locking after idle time, per-part encryption, encrypting diagnostic logs (they hold no financial data, AD-10), a server backend (AD-19). Each is in "Later".
- Out for good: any key or recovery code leaving the computer, other than the one the household writes down.

## What the repository looks like today

Read on 2026-11-22. These facts shape the plan.

- No code writes a `.folio` file yet. `fflate` is pinned in the constraints but not imported anywhere, and `packages/core` has no persistence layer. "Currently a plain zip" is the AD-2 design, not a shipped format. So encryption can be part of the first save and open code, and migration only has to cover plain files made by earlier tests or prototypes (open question 1). Building it later would turn every household file into a migration.
- The core may not import Node (AD-14), so `node:crypto` cannot be used there. The container codec belongs in the main process, behind `FileStore` and `HostApi` (AD-19), and the core keeps working on plain zip bytes. The renderer never sees a key.
- A safeStorage blob only opens on the computer and OS account that made it, so it cannot be stored in the file. This changes the shape of the proposal; see "Changes from the proposal".
- The end-to-end tests run the packaged binary (AD-16), and a packaged build never writes plaintext. They need a real key store or a test-only route (open question 7).
- Backups and atomic save are not built yet (Electron foundations, milestone 2). This plan lands first, so that plan builds on the encrypted container instead of retrofitting it.

## Approach

### Changes from the proposal

The design holds. These changes follow from the facts above.

1. _The safeStorage wrap lives on the machine, not in the file._ The file holds one wrapped copy of the file key, the recovery wrap. Each computer keeps its own safeStorage-wrapped copy in a machine key store (AD-11, "stored on the machine"), indexed by the file's id. A computer that has never opened the file asks for the recovery code once, then remembers.
2. _The header carries a file id, a key id and the wrapped key._ The file id is a random 16 bytes that names the file for the key store and the downgrade guard. The key id names which file key the file uses, so a computer can tell when the key was replaced.
3. _The first key-derivation function is HKDF-SHA-256, with a KDF id in the header._ The recovery code is 128 random bits, not a password, so no work factor is needed. HKDF also exists in Node and in WebCrypto, so a later read-only web build (AD-19) can decrypt with no dependency; scrypt is not in WebCrypto. The KDF id and parameter fields stay, so a passphrase wrap with scrypt can come later as a new format version.
4. _"Shown once" means the code cannot be shown again, not that it cannot be replaced._ While a file is open, "Replace recovery code" makes a new file key and a new code, re-encrypts, and shows the new code once. Replacing only the code would leave the old code opening new saves, because the file key would not change.
5. _A save never lowers a file's mode._ An encrypted file is never written as plaintext, in any build. Dev builds write plaintext only for a new file, or when told to for a plaintext file they opened.
6. _A plaintext file is not trusted just because it is plaintext._ It has no integrity check, so someone with write access to a synced folder could swap in a plaintext file of their own and wait for Folio to "migrate" it. The machine key store remembers every file id and path it has seen encrypted, and a plaintext file with a remembered id or path is refused, not migrated.
7. _Verify before rename._ The temporary file is decrypted and compared with the zip bytes before it replaces the real file, so a bug in the new code cannot turn a good file into an unreadable one.
8. _Backups are byte copies of the last file written,_ not a second serialization. There is one encryption path and no plaintext path to a backup.

### File layout, format version 1

All numbers are big-endian. The whole file is one byte string; the file is read into memory (AD-1) and is untrusted input, so sizes are checked before anything is allocated.

| Field               | Size       | Notes                                                                       |
| ------------------- | ---------- | --------------------------------------------------------------------------- |
| Magic               | 8 bytes    | Fixed, and not `PK`, so the file cannot be taken for a zip                  |
| Format version      | 2 bytes    | 1. A higher number gives "made by a newer Folio", not a crypto error        |
| Mode                | 1 byte     | 0 plaintext (see below), 1 encrypted                                        |
| File id             | 16 bytes   | Random, made when the file is created, never changes                        |
| Key id              | 8 bytes    | Random, changes when the file key is replaced                               |
| KDF id              | 1 byte     | 1 is HKDF-SHA-256; unknown ids are refused                                  |
| KDF parameters      | 1 byte + n | A length byte, then n bytes; none for HKDF                                  |
| Recovery salt       | 32 bytes   | Random, new when the file key is replaced                                   |
| Recovery wrap nonce | 12 bytes   | Random                                                                      |
| Wrapped file key    | 48 bytes   | The 32-byte file key encrypted under the recovery key, plus its 16-byte tag |
| Content nonce       | 12 bytes   | A fresh random value on every save                                          |
| Ciphertext and tag  | the rest   | The whole zip under the file key, ending in a 16-byte tag                   |

What is authenticated:

- The wrapped file key is encrypted with AES-256-GCM, and every header byte before it is its AAD. A wrap cannot be moved to another file or key id.
- The zip is encrypted with AES-256-GCM under the file key, and every header byte from the magic through the content nonce is its AAD. That includes the wrapped key, so no header field can be changed without the open failing.
- Decrypting checks that the tag is 16 bytes. Node accepts shorter tags unless the length is given, so the code gives it on both encrypt and decrypt.

_Plaintext mode_ is the magic, version, mode 0, the file id, and then the zip bytes. It has no tag and no protection. Every build can read it (migration needs that). Only an unpackaged build writes it. A bare zip with no header at all (it starts with `PK`) is the legacy plain file and is read the same way.

### Keys

- The file key is 32 bytes from `crypto.randomBytes`, made once per file and again only when the code is replaced.
- The recovery key is `HKDF-SHA-256(recovery code bytes, recovery salt, "folio/v1/recovery-wrap")`. The recovery code is 128 random bits.
- The machine key store is a small file in the user-data folder, separate from the settings file, holding `fileId -> keyId -> safeStorage blob` and the last path seen. A blob is the file key encrypted with `safeStorage`, which ties it to the OS account (Windows) or the login keychain (macOS). Retired keys are kept until no backup on this computer uses them, so a backup made before a replacement still opens.
- If `safeStorage` is not available (or on Linux reports a plain-text backend, which protects nothing), the packaged app does not save the key. It asks for the recovery code on every open and says why (open question 5).

### Open and save

Open:

1. Read the file. Check the magic, version, mode, KDF id and sizes.
2. Legacy or plaintext: go to Migration. Encrypted: look up the file id and key id in the key store.
3. A stored key is decrypted with `safeStorage` and tried. If the key is missing or wrong, the renderer is asked for the recovery code (through `HostApi`), the code is turned into the file key, and the key is stored for next time.
4. Decrypt the zip and hand the bytes to the core. A failed tag is "this file was changed or damaged" and offers a backup (H1.11).

Save:

1. The core serializes the zip in memory. The zip never touches the disk unencrypted, not even in a temporary file.
2. A new 12-byte content nonce, the header with the same file id, key id, salt and wrap, then AES-256-GCM.
3. Write to a temporary file in the same folder (a random name, so two computers do not collide), flush it, decrypt it again and compare, then rename it over the original and flush the folder where the OS allows. On Windows a sync client may hold the file for a moment, so a rename that fails with `EPERM` or `EBUSY` is retried a few times and then reported; the original is untouched either way.
4. Temporary files left by a crash are removed on the next open or save of that file.

A random 96-bit nonce under one key stays safe far beyond this use. A million saves, which is more than ten years of autosave on several computers, gives a collision chance near one in 10^17, and replacing the code starts a new key.

### Backups

The main process copies the last encrypted file it wrote into the backup folder (AD-12). The copy is the same bytes, so it has the same header, key and recovery code. A restored backup opens on this computer with the stored key, and elsewhere with the code that was current when it was made. Retention and frequency stay in the backup plan.

### Threat model

Folio protects a copy of the file. It does not protect an unlocked session.

| Where the file or key is exposed                                                             | What is protected                                                                                                                                                                           | What is not                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A cloud-sync folder (provider breach, a staff member, a stolen account, a leaked share link) | The contents of the zip and of every part inside it. The keys are never in the folder: the recovery code is on paper or in a password manager, and the key store is in the user-data folder | The file name, its size, its save times, and the header (format version, mode, file id). Size and times show roughly how much history there is and when someone works. The sync provider's version history may still hold an earlier plain copy (see Migration) |
| Backups of the computer or of the app's own backup folder                                    | App backups are ciphertext. A whole-profile backup holds the key store too, but its blobs open only with the OS account's own secrets                                                       | A whole-profile backup plus the person's OS login password. In that case the OS password is the only barrier. Every app backup under one file key shares one recovery code, so a leaked code opens all of them                                                  |
| A USB stick, an email attachment, or a copied file                                           | The contents. The finder needs the recovery code                                                                                                                                            | Nothing extra: a person who holds both the file and the code is the intended recoverer                                                                                                                                                                          |
| Another OS account on the same computer                                                      | The contents. Each OS account has its own safeStorage secrets, so the other account cannot open this account's key store and needs the code                                                 | Nothing extra                                                                                                                                                                                                                                                   |
| A shared OS account (everyone uses one login)                                                | Nothing. The key store opens for whoever is logged in, with no prompt, so the file opens for them too. This is accepted for v1. A passphrase option would address it and is in "Later"      | Everything the account can reach                                                                                                                                                                                                                                |
| Malware running as the same user                                                             | Nothing. It can ask the OS for the same secrets, and it can read the app's memory, which holds the plain model (AD-1)                                                                       | Everything, including memory, swap and hibernation files                                                                                                                                                                                                        |
| Someone with write access to the synced folder                                               | Changes to a file are detected: any edit to the header or the ciphertext fails the tag. A swap to a plaintext file is refused when the file id or path is known to have been encrypted      | Replacing the file with an older valid copy, or deleting it. The change check (AD-12) catches a replacement that happens while the file is open. A save counter is open question 9                                                                              |
| A lost recovery code and every computer that remembers the key                               | Nothing: the data cannot be recovered, and backups do not help because they share the key. The creation screen says so                                                                      |                                                                                                                                                                                                                                                                 |

Logging: file keys, recovery codes, wrapped keys and decrypted bytes are never logged. The file id and key id are random and may be logged. The code is held only by the dialog that shows it, is never put in a log field, the settings, the recent-files list or an error message, and is marked private (`privateField`) wherever it crosses a function that logs.

### Recovery code UX

When it is shown: when a new file is created, and when an existing file is encrypted (migration). It is not shown at any other time. "Replace recovery code" in the file's settings shows a new one.

The code: 128 random bits written in Crockford base32 (26 characters; no I, L, O or U), plus one check character, in groups of four. Typing is forgiving: case, spaces, dashes and look-alike characters (O for 0, I and L for 1) are accepted. The check character lets the app say "check for a mistyped character" without trying the file.

Showing it:

- A short explanation in plain words: this is the only way to open the file on another computer, or after this one is lost; the app cannot show it again; keep it where the whole household can reach it, such as a shared password-manager entry or a printed sheet, and not in the folder that holds the budget file.
- Buttons for Copy and Print. There is no "save to a file", because a text file next to the data is the exact leak this feature removes. Copy clears the clipboard after a minute if it still holds the code (a clipboard-history tool can keep it; the dialog says so).
- A confirmation step: the person types two groups of the code, chosen at random, before Continue is enabled. Cancelling here creates nothing for a new file and leaves the original untouched for a migration. A file is never written encrypted under a code the person did not confirm.
- The code is plain selectable text, grouped so a screen reader reads it in chunks.

Entering it, on a computer that has no key for the file:

- A dialog that names the file and asks for the code, with one line on where to find it.
- A mistyped code (check character fails) says "That does not look like a recovery code. Check for a mistyped character." A well-formed code that does not open the file says "That code does not open this file. It may belong to another file, or the code was replaced." No attempt limit: an attacker who has the file can guess offline anyway, and the code is 128 bits.
- After a correct code the key is stored and the dialog does not appear again on this computer.

Replacing it, with the file open: the dialog explains that other computers will ask for the new code, and that old backups still open with the old one. It then runs the show-and-confirm steps above and saves.

### Migration of plain files

A plain file is a bare zip, or a header with mode 0. A packaged build handles it like this:

1. Warn, in plain words, before anything is written: this file is not protected, Folio will encrypt it, and a recovery code will be shown next. Offer Encrypt and open, or Cancel (the file is untouched and is not opened).
2. Run the show-and-confirm steps for a new recovery code.
3. Build the encrypted file in memory, write it as a temporary file, decrypt it and compare with the original zip bytes, then rename it over the original and store the key on this computer. The original plain bytes are never copied anywhere, so no plaintext backup is left behind. The verification replaces that safety net.
4. After it succeeds, tell the person what the app cannot fix: older versions in the sync service's history, copies on other drives and backups made before this are still plain, and the household should delete them. If the rename fails, the original stays as it was and the error is shown; the plain file is not opened for editing.
5. Other computers: the first open there asks for the recovery code. The warning says to give the household the code before they next open the file.

Dev builds open a plain file and leave it plain. A save keeps its mode (change 5). The developer script converts a file in either direction.

A file already encrypted on this computer that comes back as plaintext, or a bare zip at a path known to have been encrypted, is not migrated. It is refused with a message that an unprotected file has taken the place of the encrypted one (change 6).

### Developer script and test support

- A script in `scripts/` (name chosen at implementation) with `info <file>` (header only, no key needed), `decrypt <file> <out.zip>` and `encrypt <in.zip> <out>`. It imports the same codec the app uses, so the two cannot drift apart. The key comes from the test key (`--test-key`) or from an environment variable holding a recovery code, never from an argument that shells keep in history. It refuses to overwrite an existing output, and prints a warning that its output is unprotected.
- Codec and key-store code take their randomness and their key provider as arguments. Production passes `crypto.randomBytes` and a safeStorage provider. Tests pass a fixed test key and a counter for nonces, so a test file is the same bytes on every run and known-answer vectors can be checked, ideally against a second implementation (for example `openssl` or Python's `cryptography`) so the codec is not only tested against itself.
- The test key lives in one test-support module. An architecture check fails if non-test main-process code imports it, and the packaging check fails if its value, or the script, is in the packaged app. The packaged app has no way to accept a fixed key.
- The unpackaged-only plaintext write is chosen from `app.isPackaged`, passed in as a parameter so the unit tests can try both values. A variable such as `FOLIO_FILE_MODE=plaintext|encrypted` selects it in dev builds and is ignored when packaged, like the logging switch (logging plan, milestone 6).

## Milestones

One branch and one pull request per milestone, in order. The branch is `encryption-m{N}-{short-name}` and the pull request title starts `Encryption milestone {N}:`. Branches start from the latest `main`.

### 1. The container codec

- Does: encode and decode format version 1 in both modes, the AAD rules, every size and version check, the 16-byte tag check, and a test key provider with deterministic nonces. Lives in the main process, takes randomness and keys as arguments, and uses only `node:crypto`.
- Acceptance criteria: a round trip in both modes; known-answer vectors, one checked against a second implementation; changing any single byte of an encrypted file (header or body) fails to open, with a different error for a newer version, an unknown mode or KDF id, a truncated file and a failed tag; a short tag is refused; a bare zip is recognised as legacy; an oversized length field allocates nothing.
- Verified by: the unit run and the architecture checks (no new dependency; `core` still imports no Node).

### 2. Recovery code and key wrapping

- Does: generate, format and parse the recovery code with its check character; derive the recovery key with HKDF; wrap and unwrap the file key; create and replace a file key.
- Acceptance criteria: a code round-trips through formatting and forgiving input; a mistyped character is caught by the check; a wrong code fails the tag; replacing the code changes the key id and file key, and the old code no longer opens the new file; the code and keys appear in no log line (a test with a capturing logger).
- Verified by: the unit run.

### 3. The machine key store

- Does: a store of safeStorage-wrapped file keys by file id and key id, last path seen, retired keys kept for backups, and the behaviour when safeStorage is unavailable (ask for the code on every open). Electron stays behind a small interface so the store is unit tested with a fake.
- Acceptance criteria: unit tests over the fake for store, lookup, retirement and the unavailable case; an integration run on the real Windows and macOS runners that a stored key survives a restart. On macOS, record whether the unsigned app (AD-20) gets a keychain prompt, and whether it comes back after an upgrade (open question 6).
- Verified by: the unit run and the integration run in CI.

### 4. Open, save, atomic write, backups

- Does: the encrypted `FileStore` and host paths: open with key lookup, save with a fresh nonce, temporary file, verify, rename and folder flush, retry on a locked rename, stale temporary cleanup, backups as byte copies, the packaged-build rule against writing plaintext, the no-downgrade rule, and the downgrade guard. The mock host and the real one stay in step. This takes over the save and backup parts of Electron foundations milestone 2.
- Acceptance criteria: on real temporary folders, a simulated crash between write and rename leaves the old file or the new one and never a mix; a failed verify leaves the original; a packaged host asked to write plaintext refuses; an encrypted file opened in a dev build is saved encrypted; a plaintext file with a remembered id is refused; the zip is never written unencrypted anywhere (a test that lists the folder during a save).
- Verified by: unit and integration runs on Windows and macOS.

### 5. Recovery-code screens

- Does: the `HostApi` additions (open reports that a code is needed; submit a code; create-with-code and replace-code flows) and the dialogs for showing, confirming, entering and replacing the code. The renderer never receives the file key.
- Acceptance criteria: component tests with the mock host for every dialog state in "Recovery code UX", including the confirmation step, the two error messages and cancel; the mock host exposes no key; the scenario that a second computer asks once and then not again.
- Verified by: unit and integration runs; a manual read-through of the wording with a household member.

### 6. Migration

- Does: detect plain files, the warning and consent dialog, the verified in-place conversion, the follow-up notice about copies, and the refusal for a known-encrypted file that comes back plain.
- Acceptance criteria: a legacy bare zip and a mode-0 file both convert and open; the original is unchanged when the person cancels, when the code is not confirmed, and when the rename fails; no plain copy remains in the folder or in backups; a replaced-by-plaintext file is refused.
- Verified by: the unit and integration runs, and one hand run on each OS with a real plain file.

### 7. The developer script and the packaging check

- Does: the script and its documentation, and the checks that keep the test key and the script out of the packaged app.
- Acceptance criteria: `info`, `decrypt` and `encrypt` work on a file made by the app; the packaged app contains neither the test key nor the script; the end-to-end smoke test creates, saves and reopens an encrypted file in the packaged app (see open question 7 for how).
- Verified by: the integration run, the packaging check and the end-to-end run.

### 8. Documents

- Does: update the architecture sections that still describe a plain zip (03 context, 04 solution strategy, 02 constraints storage row), add the risk "a lost recovery code loses the data" to 11, point AD-2 and AD-12 at AD-22, and list the new files in AD-22's key files. Update the PRD line "Optional file password and encryption", which this plan makes always-on and not optional; the password part stays Later.
- Acceptance criteria: the architecture index regenerates without a stale warning for these sections.
- Verified by: the format check and the index script.

## Later

Recorded so they are not lost. None is scheduled.

| Item                                                                          | Why it waits                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| An optional passphrase (a third wrap in the header, scrypt, format version 2) | Covers the shared-OS-account case; adds a password the household must remember                      |
| Lock after idle time and on screen lock                                       | Needs UI, and only helps once something gates the key                                               |
| "Forget this computer" and a list of computers that hold the key              | Needs the settings page                                                                             |
| A save counter in the header against rollback                                 | Needs a rule for two computers saving in turn                                                       |
| A browser decrypt in the read-only web build                                  | Needs the web check first (Electron foundations, milestone 5); HKDF was chosen so it stays possible |
| Hiding the file name and size (padding, an opaque name)                       | The cost and the gain are small next to the rest                                                    |

## Requirements

- No key, recovery code or decrypted byte in any log, setting, recent-files entry or error message (AD-10).
- No plaintext zip on disk in a packaged build, including temporary files and backups.
- No new dependency: `node:crypto` only. The architecture checks keep the core free of Node.
- A save cannot leave a file that fails to open: the temporary file is verified before the rename.
- Encryption adds no network access (AD-18).

## Decisions

- Zip first, then encrypt the whole zip with AES-256-GCM from Node's built-in crypto. No new dependency and no zip-level encryption (Jeremy, 2026-11-22).
- File layout: magic, format version, mode, KDF parameters, salt, nonce, then ciphertext and tag, with the whole header authenticated as AAD (Jeremy, 2026-11-22). The header gains the fields listed under "Changes from the proposal" (Engineer, 2026-11-22, awaiting confirmation).
- A mode flag: dev builds may write plaintext, packaged builds never do. A packaged build that opens a plaintext file warns and re-saves it encrypted (Jeremy, 2026-11-22).
- A random file key, wrapped once by Electron `safeStorage` for everyday use and once by a recovery code shown a single time (Jeremy, 2026-11-22). Where the safeStorage wrap is kept is the first change below (Engineer, 2026-11-22, awaiting confirmation).
- A fresh random nonce on every save, atomic writes through a temporary file and a rename, and backups encrypted the same way (Jeremy, 2026-11-22).
- A developer script to decrypt and encrypt files for analysis, and a fixed test key in tests (Jeremy, 2026-11-22).

## Open questions

1. Is there any real household file in the plain zip form today? Nothing in the repository writes one, so migration may only need to cover test files and prototypes, and could shrink to the dev script. [Jeremy, before milestone 6]
2. Is the order right: this plan before Electron foundations milestone 2 (atomic save and backups), which then builds on the encrypted container? [Jeremy, before milestone 1]
3. Replacing the recovery code makes a new file key, so every other computer asks for the new code once. Retired keys are kept on each computer so its own backups still open. Is that the wanted behaviour? [Jeremy, before milestone 2]
4. HKDF-SHA-256 for the first KDF, because the code is random and HKDF also runs in a browser. If a passphrase is wanted soon, scrypt would come with it. Agreed? [Jeremy, before milestone 2]
5. When `safeStorage` is unavailable or protects nothing (Linux plain-text backend), the packaged app asks for the code on every open instead of saving the key. Is that right, or should the app refuse to run there? Linux is not a v1 target, so this may stay theoretical. [Jeremy, before milestone 3]
6. Does an unsigned macOS app (AD-20) get a keychain prompt, and does it come back after each upgrade? This is not tested; milestone 3 measures it on a clean Mac. If it prompts every time, the household needs a line in the install instructions or a signing decision. [Engineer, milestone 3]
7. The end-to-end tests drive the packaged binary, which cannot accept a test key. Do they use the real safeStorage on the Windows and macOS runners (whether a runner's keychain is available is unchecked), or is a test-only route through `FOLIO_AUTOMATION=1` acceptable, given that it would let anyone who sets that variable encrypt under a public key? [Jeremy and Engineer, before milestone 7]
8. For a plain file in a packaged build, is "Encrypt and open or Cancel" enough, or should there also be "Open read-only"? Read-only avoids forcing a decision but leaves the file unprotected in the folder. [Jeremy, before milestone 6]
9. Should the header carry a save counter that each computer remembers, to catch a rollback to an older valid copy? It adds a rule for two computers saving in turn. [Jeremy, Later unless wanted now]
10. If anyone already runs a build that reads the file, an older build cannot open an encrypted one and says only that the file is newer. Should the migration warning tell the household to update every computer first? [Jeremy, before milestone 6]
11. Is no "save the code to a file" option acceptable? Copy and Print only. [Jeremy, before milestone 5]
