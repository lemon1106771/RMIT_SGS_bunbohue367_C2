# Demo setup: five accounts, one empty payout group per case

Run this after `npm run init` and `npm run dev` (see the Setup section of the README). The realm name below is `clearaid` and the app's client is `clearaid-client` (the init script prints both on its `Realm:` and `Client:` lines). TideCloak: http://localhost:8080. App: http://localhost:3000. Run everything on **one laptop**, each role in its own Chrome profile (or one incognito window; incognito windows share one session with each other).

**Verification status.** Items marked (pack) come from the Tide pack docs (`relationship-attestation` and `iga-admin-governance` bootstrap sequences and scenarios). App behaviour was read from this repository's source code. TideCloak console menu names follow the Keycloak admin console. Where your TideCloak version may word them differently, the text says "(labels may differ slightly in your TideCloak version)". This setup has not been run end to end against a live TideCloak yet.

**Before you start.** The core of the demo (payout group, Tide-signed token, mock bank) needs only TideCloak IGA. The extension (the family's file is encrypted, and the approved hospital can decrypt it) needs the built-in contract `RelationshipAttestation:1`. It is new (ORK main since 2026-10-16) and not on every Tide network. Confirm with the Tide team on Discord (#support, https://discord.gg/XBMd9ny2q5) that the network used by `tideorg/tidecloak-dev` has it. If policy signing fails with an unknown contract, that is the cause, and the extension is roadmap.

## Prerequisites

The same steps work on macOS and Windows.

- **macOS:** Docker Desktop (Apple Silicon is fine), Node.js 20+, and `brew install jq`.
- **Windows 10/11:** Docker Desktop (WSL 2 backend), Node.js 20+, Git for Windows (it provides Git Bash, which the init script uses automatically), and `winget install jqlang.jq`. Then open a new terminal.

Steps, on both systems:

1. `npm install`
2. Copy `.env.example` to `.env` (macOS: `cp .env.example .env`; Windows PowerShell: `Copy-Item .env.example .env`) and fill the three values `KC_BOOTSTRAP_ADMIN_PASSWORD`, `TIDE_LICENSE_EMAIL` and `TIDE_TERMS_ACCEPTED=yes` (only after you have read and agree to https://tide.org/legal). Do not use Notepad on Windows; VS Code keeps LF line endings.
3. `npm run doctor` checks Node, Docker, jq, Git Bash (Windows), ports 8080 and 3000, and `.env`.
4. `npm run init` starts TideCloak and prints an invite link.
5. Open the printed invite link and link the admin's Tide account.
6. `npm run dev`, then open http://localhost:3000.

## Accounts

| Username | Role in the demo | Needs |
|---|---|---|
| `council1` | council member (realm admin) and fund lead, seat "Fund lead" | the admin created by the init script, whose username is `admin`. In these docs that account is called `council1`: wherever the text says `council1`, sign in as `admin` |
| `council2` | council member (realm admin), seat "Local Red Cross" | client role `tide-realm-admin` of `realm-management` |
| `council3` | council member (realm admin), seat "Donor representative". Also the account used on `/operator` | client role `tide-realm-admin` of `realm-management` |
| `volunteer` | field volunteer who seals the family's file (extension) | realm roles `_tide_encryptor` + `_tide_decryptor`. The volunteer's policy is read-write: the encryptor role seals the file, the decryptor role lets the volunteer read back their own cases |
| `hospital` | the payee, "Hoa Binh Hospital (mock)" | realm role `_tide_decryptor` only (extension: read-only access to the file). Payout authority comes only from group membership, granted by the council |

**The fund owner is not a separate account.** The `/operator` page ("Fund owner" in the top bar; we call it "God mode") shows what the person who runs the server can see: ciphertext only. It needs a signed-in account, because "Try to forge payout authority" edits the signed-in user's real token. Sign in as `council3` for it: `council3` approves nothing in the video. Do not add `_tide_encryptor`/`_tide_decryptor` to the default roles (pack).

The payout group for each case is named `payout-case-<id>` (full path `/payout-case-<id>`), where `<id>` is the case id. The volunteer types the case id when opening the case (section 5). The app does not create the group: you create it, empty, in the console.

## Admin console

- Console: http://localhost:8080/admin/clearaid/console/ (the path may differ slightly in your TideCloak version)
- Sign in as the Tide-linked admin (`admin`, called `council1` here). Every change below is an IGA change request. It appears under Change requests in the console's left menu (labels may differ slightly in your TideCloak version) and must be approved and committed. With one admin the approval is immediate; with more, approvals use the Tide enclave popup (allow popups for localhost:8080).
- Quorum: `max(1, floor(admins * 0.7))` (pack). 1 or 2 admins: 1 approval. 3 or 4 admins: 2 approvals. With the three council members, the quorum is 2 of 3.
- The "Approval in TideCloak" card on `/council` lists the console steps for the chosen case, with "Open Groups" and "Open Change requests" shortcuts.

## 1. Create the users (council2, council3, volunteer, hospital)

For each of `council2`, `council3`, `volunteer`, `hospital`:

1. Console, Users, Add user (labels may differ slightly in your TideCloak version). Set username. Fill first name, last name and email so the profile does not block login (pack: "include firstName and lastName to avoid VERIFY_PROFILE block"). Any email will do for the demo (the licence email is a separate setting).
2. Approve and commit the user-creation change request (pack).

## 2. Send each user their Tide-account link

The pack's way to onboard a user is a required-action link for `link-tide-account-action`, generated with the master-admin token (pack). The user opens it once and creates or links a Tide account. It needs bash, `curl` and `jq`. Run it from the repo root in Terminal on macOS, or in Git Bash on Windows (installed with Git for Windows):

```bash
set -a; . ./.env; set +a
REALM=clearaid
KC=http://localhost:8080
TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d client_id=admin-cli -d grant_type=password \
  --data-urlencode "username=${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}" \
  --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" | jq -r .access_token)

for U in council2 council3 volunteer hospital; do
  ID=$(curl -s "$KC/admin/realms/$REALM/users?username=$U&exact=true" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
  echo "== $U"
  curl -s -X POST "$KC/admin/realms/$REALM/tideAdminResources/get-required-action-link?userId=$ID&lifespan=43200" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '["link-tide-account-action"]'
  echo
done
```

Open each printed link in its own Chrome profile (or private window), signed out of everything else, and complete the Tide account step. The link lives 12 hours (`lifespan=43200`). The master-admin token lasts about 60 seconds, so run the script promptly.

To confirm a user is linked: Console, Users, the user, Attributes, `tideUserKey` is set (the init script polls this attribute for the first admin; pack/script). If a user has no `tideUserKey` there is nothing for a policy to name.

(pack) The pack also mentions `PUT /admin/realms/{realm}/users/{id}/execute-actions-email` with `["link-tide-account-action"]` as an alternative. It needs working SMTP, so use the link above.

## 3. Make council2 and council3 realm admins

Only after each has linked their Tide account (pack: grant `tide-realm-admin` after enrollment).

1. Console, Users, `council2`, Role mapping, Assign role, filter by clients, choose `realm-management` / `tide-realm-admin`, Assign (labels may differ slightly in your TideCloak version). Repeat for `council3`.
2. Open the change requests and approve (as `admin`), then commit each GRANT_ROLES request (pack). Do `council2` first and commit it before `council3`: after that there are 2 admins, and when `council3` is committed there are 3 (quorum 2).
3. Each council member signs in once at the admin console so their enclave is ready to approve.

## 4. Give the volunteer and the hospital their roles

Realm roles, not client roles; each grant is a change request an admin approves (pack: "Each grant is a change request an admin approves. The user must sign in again afterwards: the role is read from their credential").

| User | Realm roles to assign |
|---|---|
| `volunteer` | `_tide_encryptor`, `_tide_decryptor` |
| `hospital` | `_tide_decryptor` |

Console, Users, user, Role mapping, Assign role, filter by realm roles. Then Change requests: approve and commit. From now on the approving needs the quorum (with 3 council members, 2 approvals).

## 5. Create the case and its empty payout group

The group name contains the case id, so decide the id first. The volunteer types it when opening the case.

1. As `volunteer`, open http://localhost:3000/volunteer and fill in the "Open a case" form with synthetic data: Province "Quang Binh", Household size 4, Requested amount (VND) 50000000. The **Case id** is a field of this form, and the volunteer types it. The form suggests one (the province initials and four digits, such as `qb-4821`). Replace it with a readable id, for example `lan-quang-binh`. Allowed: 2 to 31 lowercase letters, digits and dashes, starting with a letter or digit. An id that already exists is refused. Click "Create case".
   - The app shows the id in the volunteer's case list and case header, in the case picker on `/council` (which also prints the exact group name once you pick the case), on `/hospital` and on `/public`.
   - The id is public. The demo's `lan-quang-binh` is fine only because Ms. Lan is made up. For a real case, use a neutral id.
2. Console, Groups, Create group, name exactly `payout-case-<id>` (top level; the full path becomes `/payout-case-<id>`, which is what the app, the bank and the `groups` token claim use) (pack: full group path is required). The app does not create this group.
3. Approve and commit the group-creation change request (pack: group creation on an IGA realm is a change request). With three admins this needs 2 approvals, for example `council1` and then `council2`.
4. Do **not** add any members. The group must stay empty until the council approves the payout.

For the filmed take, do steps 1 to 4 for Ms. Lan's case ahead of time (case id `lan-quang-binh`, group `payout-case-lan-quang-binh`), and do section 7 step 1 too. On camera, the volunteer then only adds the sealed items.

## 6. Everybody signs in once

Until a user signs in at the app they have no registered Tide key for it (pack: "Each user who will be given records signs in once"). Open http://localhost:3000 in a separate Chrome profile per person and sign in as `council1` (the `admin` account), then `council2`, then `council3`, then `volunteer` and `hospital` (the volunteer already signed in during section 5). Do the council members in that order: the app gives the three council seats by order of first sign-in ("Fund lead", "Local Red Cross", "Donor representative"), and the seats appear as seals on the public page. Allow popups for `localhost` (the Tide enclave opens in a popup). After roles or groups change later, the person signs in again.

## 7. Set up the case and test the refusals

1. As `council1`, open http://localhost:3000/council and choose the case. Open the collapsed section "Optional: sealed-file access rules" and click "Set up case" (this is the council's optional step for the sealed file). The Tide enclave popup opens twice in a row. Approve both. The first signs the volunteer's read-write policy for this case (policy A). The second signs the read-only policy for the group `/payout-case-<id>`, which is still empty (policy B). Both are under `RelationshipAttestation:1` (pack: one policy per subject and record, each approved in the enclave). The server stores them. If the browser blocks the second popup, click Retry on that step. Until this step is done, the volunteer sees "Waiting for the council to set up the case" and cannot seal anything. The volunteer must have signed in once before this step.
2. The mock bank (`/api/bank/payout`) needs no setup of its own. It verifies the Tide signature with the realm's key in `data/tidecloak.json` (exported by the init script) and checks the DPoP proof.
3. As `volunteer`, open `/volunteer`, pick the case and seal a test item with "Encrypt and send" to confirm that encryption works (extension). For the filmed case, do this on camera instead, or use a rehearsal case.
4. As `council3`, open `/operator`: you see ciphertext only, and trying to open the file is refused (extension).
5. As `hospital`, open `/hospital` and click "Collect payout". The bank must refuse with the panel "Payout refused" (no payout group in the token). "Open sealed file" (inside the collapsed section "Optional: open the sealed file") must also be refused by the ORKs (extension; group still empty).
6. Open `/public` ("Public ledger"): the case appears with its status ("Sealed") and no personal data. A donor can click "Donate (mock)" there.

## 8. Approval flow (what you do on camera)

1. **Volunteer seals the file** (extension). As `volunteer` on `/volunteer`, open Ms. Lan's case and add the sealed items (ID, address, circumstances and medical file, bill reference) with "Encrypt and send", all synthetic. Each item is encrypted in the browser before it is sent.
2. **Fund owner.** As `council3`, open `/operator`. The page shows aggregate progress, while trying to open a file with your own access is refused (extension).
3. **Fund lead proposes.** As the fund lead (`council1`), on `/council`, choose the case, enter 50000000 as the Amount (VND), set the Public payee name to "Hoa Binh Hospital (mock)", enter `hospital` as the Hospital username, and click "Propose payout". This only records the proposal: nothing is paid and nothing is unlocked. The status becomes "Payout proposed".
4. **Fund lead adds the hospital to the group.** In the console: Groups, `payout-case-<id>`, Members, Add member, `hospital` (labels may differ slightly in your TideCloak version). This creates the change request that adds `hospital` to `/payout-case-<id>`. It does not apply yet.
5. **Hospital is refused.** `hospital` clicks "Collect payout": the refusal panel "Payout refused" appears. "Open sealed file" (inside the collapsed "Optional: open the sealed file") is refused too (extension).
6. **Council member 1 approves.** Console, Change requests, the new request: `council1` approves in the enclave popup (1 of 2). `hospital` tries again: still refused.
7. **Council member 2 approves.** `council2` signs in to the console, opens the same request and approves (2 of 2). The quorum is reached and the request commits. If it does not commit on its own, click Commit (pack: commit once `readyToCommit`).
8. **Hospital collects.** `hospital` signs out and signs in again (or waits up to 120 s), then clicks "Collect payout". The bank verifies the token and DPoP proof and pays the hospital directly (mock). The status becomes "Paid out". The hospital can now expand "Optional: open the sealed file", click "Open sealed file" and read the file, read-only (extension).
9. **Public ledger.** Open `/public`. A donor can click "Donate (mock)" to see progress move. The ledger shows the payout with a transaction reference and "2 of 3 council", and no personal data.
10. **Forged token.** As `council3` on `/operator`, click "Try to forge payout authority". The result reads "Forged token rejected" (section 9).

Optional: after approving in TideCloak, each member can click "Log my approval publicly" on `/council`. It only writes a public log entry, which adds a seal to the public page. It is not the approval: the binding approval is the one in TideCloak under Change requests.

## 9. Forged-token test

On `/operator`, signed in with any account (`council3` in the demo), click "Try to forge payout authority". The page takes your real access token, adds the payout group of the first case in the database to the payload, keeps the old signature, and sends both the forged token and your real token to `/api/bank/verify-token`. The real token is reported as valid, with its real groups. The forged token must be reported as invalid ("Forged token rejected"), because the signature no longer matches the payload. This shows that nobody can invent the payout permission without the Tide network's signature. The verifier itself needs no login. The page does, because it needs a token to edit.

## Troubleshooting

Adapted from the scenario's key diagnostics (pack).

| Symptom | Cause | Fix |
|---|---|---|
| Nothing happens when approving, or the enclave never appears | Popup blocked in the browser | Allow popups for localhost:3000 and localhost:8080, then retry |
| Bank still refuses after 2 approvals | Request not committed, hospital not a member, or the hospital's token was issued before the commit (no `groups` entry for `/payout-case-<id>`), or the `groups` mapper is missing | Confirm the change request is committed and `hospital` is a member; `hospital` signs in again (token refresh takes up to 120 s); the `groups` mapper (claim exactly `groups`, access token on, full path on) ships in the realm template |
| The hospital page says the fund has not proposed a payout yet (HTTP 409 from the bank) | The token has the group, but nobody clicked "Propose payout" for this case | The fund lead proposes on `/council`, then the hospital tries again |
| Bank answers 401 (the response has an `error` with the reason) | Missing DPoP proof, clock skew between browser and server, or a token from another realm or client | Sign in again from a fresh tab; check the laptop clock; use the realm `clearaid` and client `clearaid-client` |
| `/council` says the page is for council members | The account has no `tide-realm-admin` role, or the session predates the grant | Assign the role, approve and commit the change request, sign in again |
| The volunteer sees "Waiting for the council to set up the case" | The case's volunteer policy is not signed yet | `council1` clicks "Set up case" on `/council` (section 7 step 1) |
| `'/payout-case-<id>' group not found in doken.` (extension) | Expected before approval. After approval: the hospital's token has no `groups` entry (see above) | Same fixes as above |
| `'_tide_decryptor' role not found for this decryption request.` | `hospital`/`volunteer` lacks the realm role, or the session predates the grant | Assign the realm role, approve and commit the change request, sign in again |
| `'...' role not found in doken.` | Role missing or session predates the grant | Same as above |
| `_tide_decryptor not found in list of roles.` | The policy does not permit that operation (a read-only policy cannot encrypt) | Re-run the case set-up so the policy is signed with the right access |
| Unknown contract, or policy signing fails for `RelationshipAttestation:1` | The Tide network behind the container may not have this new built-in contract yet | Ask the Tide team on Discord (#support, https://discord.gg/XBMd9ny2q5). The core demo still works; the extension is roadmap |
| `TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of N required, ...)` right after a request the contract should refuse | That is the refusal: every ORK answered with an error, and the SDK reports it as a reachability failure | Read the error's `cause`; do not retry and do not treat it as an outage. For the demo, this is "the hospital is refused" |
| `Tags do not contain assignmentId.` | An item's tag is not exactly the record id the policy names (the app tags each item with `case-<id>` and nothing else) | App bug if seen: tag each item with the record id and nothing else |
| Works for the council but not for the volunteer | The volunteer's policy names another user's `tideuserkey`, or the volunteer had not signed in when the case was set up (the app refuses and says the volunteer has not signed in yet) | The volunteer signs in once, then `council1` runs the case set-up again |
| Change request stays PENDING | Missing commit, or under quorum | Collect another approval (412 under threshold), then commit |
| `npm run doctor` fails on Docker | Docker Desktop is not running, or the engine is still starting | Start Docker Desktop, wait until it says it is running, then run `npm run doctor` again |
| `npm run doctor` says Git Bash not found (Windows) | Git for Windows is not installed, or the terminal was opened before it was | Install Git for Windows, open a new terminal, run `npm run doctor` again |
| `npm run doctor` says `jq` not found | `jq` is not installed, or the terminal was opened before it was | macOS: `brew install jq`. Windows: `winget install jqlang.jq`, then open a new terminal |
| `npm run doctor` or `npm run init` reports CRLF in `.env` | `.env` was saved with CRLF line endings (for example in Notepad) | Re-save it with LF (VS Code: click "CRLF" in the status bar, choose "LF") and run `npm run doctor` again |
| `npm run doctor` says port 8080 or 3000 is in use | An old TideCloak container or another service | `docker stop tidecloak; docker rm tidecloak`, or stop the other service, then run `npm run doctor` again |
| Apple Silicon: the first `npm run init` is very slow | The TideCloak image runs emulated (x86 on ARM) and has to download first | Wait. The first start can take several minutes; later starts are faster |
| Fallback (Windows): `npm run init` still cannot run the script | The script could not find or start Git Bash | Open Git Bash and run `bash scripts/init-tidecloak.sh` by hand |
| `\r: command not found`, or odd errors reading `.env` | `.env` was saved with CRLF line endings (for example in Notepad) | Re-save it with LF (VS Code: click "CRLF" in the status bar, choose "LF"), or run `sed -i 's/\r$//' .env` in Git Bash |
| `jq: command not found` after `winget install jqlang.jq` | The terminal was open during the install | Close it and open a new terminal |
| Fresh start | Corrupt state | Run `npm run init` again; it recreates the container and realm (it removes `data/keycloakdb*`); re-do this document. To clear the demo cases only, stop the app and delete `data/clearaid-db.json`; the app recreates it, and each person's next page load registers them again (sign in as `council1`, `council2`, `council3` in that order) |
