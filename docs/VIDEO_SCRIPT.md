# WholeLeaf - 2-minute video plan

Structure (official): The possibility, The constraint, The prototype (with TideCloak's role), What changes.

Voiceover length: 273 words (target 260-280, about 2 minutes at a slow, clear pace). Ms. Lan is a made-up person; every name, file and number on screen is synthetic. The demo follows the same sequence as the README walkthrough and the approval flow in DEMO_SETUP.md.

| Time | Beat | On screen | Voiceover |
|---|---|---|---|
| 0:00-0:14 | The possibility | Title card "WholeLeaf - Charity without trusting a hero." Then the line "Named after a Vietnamese proverb: the whole leaf shelters the torn one." with a leaf drawing. Cut to a drawn hospital corridor (no real patients). | Ms. Lan lives in Quang Binh. Her child needs surgery. What if a small group could raise the money, and it could only reach the hospital, whatever one person wants? This is WholeLeaf. |
| 0:14-0:38 | The constraint | Three cards: "Transparency", "Privacy", "Control" with "pick two". Then a blurred page of bank statements ("12,000+ pages") and a Facebook post with an ID card blurred. | Charity offers transparency, privacy or control. Pick two. In September 2024, more than 12,000 pages of Typhoon Yagi bank statements were published, showing donors' names and messages. Families post ID cards and photos of sick children on Facebook, just to be believed. So people send money to one famous name, because a small group cannot be trusted. |
| 0:38-0:54 | The prototype | Open `/demo`, ask the hospital to collect before approval, add the first council seal, then the second. Collect again and show the donor receipt. | Here is one case you can try yourself. One approval cannot release the money. After two council seals, the hospital receives the mock payout and donors get a receipt without seeing the family's private file. |
| 0:54-1:06 | The prototype (TideCloak's role: the change request) | TideCloak admin console: the fund lead adds the hospital to Groups, `payout-case-lan-quang-binh`, Members. A pending change request appears, not applied yet. Hospital window: clicks "Collect payout". Red refusal panel "Payout refused" with the bank's reason: no payout group in the token. | The fund lead adds the hospital to the case's payout group in TideCloak. The hospital clicks collect. The mock bank refuses: no payout group in the token. |
| 1:06-1:34 | The prototype (TideCloak's role: approval, signature, bank check) | TideCloak admin console, Change requests. Council member 1 approves in the Tide enclave popup: 1 of 2, hospital tries again, still refused. Council member 2 approves: 2 of 2, committed. Hospital signs out and in again, clicks "Collect payout": green "Paid out" receipt (mock) with a transaction reference. Then (extension) the hospital expands "Optional: open the sealed file", clicks "Open sealed file" and the file opens, read-only. | Here is TideCloak's role. Authority is a group. Adding the hospital needs two of three council members. Member one approves in the Tide enclave. Still refused. Member two approves. The hospital signs in again. Its token now carries the group, signed by the Tide network with a key no single server or admin holds. The mock bank checks the signature and pays the hospital directly. |
| 1:34-2:00 | What changes | Public ledger page: a donor clicks "Donate (mock)", and a new ledger line shows the transaction reference and "2 of 3 council", no personal data. Fund owner page (`/operator`): click "Try to forge payout authority", result "Forged token rejected". Split screen with the three cards, then end card with team name. Small text: "Limit: two members could collude." | The public ledger shows the payout, approved by two of three, with no personal data. A forged token is rejected. What changes? Donors see proof, families keep privacy, and no hero is needed. Two members could collude, and a real bank must check Tide tokens. This is what we build when trust is no longer the bottleneck. |

## Filming notes

### Roles (team of 4)
- **Person 1, screen driver:** drives the mouse, switches between windows and starts the recording.
- **Person 2, voiceover:** reads the voiceover (it can be recorded separately later and added to the video).
- **Person 3, Volunteer, Fund owner and public page:** prepares `/volunteer` ("Create case" and "Encrypt and send"), `/operator` (God mode and "Try to forge payout authority", signed in as `council3`) and `/public`; checks Ms. Lan's sample data.
- **Person 4, Council and Hospital:** prepares `council1`, `council2` and `hospital`; calls out the steps in the right order.
- While filming, Person 1 can switch between all windows alone to save time. Persons 3 and 4 stand next to them and prompt the script.

### Browser windows to have open
Run TideCloak and the app on **one laptop** (localhost). Give each role its own Chrome profile, already signed in and clearly named. You can use one incognito window, but incognito windows share one login session, so use at most one.
1. Volunteer: `/volunteer` ("Encrypt and send" for Ms. Lan's file)
2. Fund lead: `/council` (click "Propose payout" for 50,000,000 VND to "Hoa Binh Hospital (mock)"). The fund lead is `council1` (the `admin` account), so this profile is also council member 1. Keep a second tab open on the TideCloak admin console, Groups, to add the hospital to the case's group.
3. Hospital: `/hospital` ("Collect payout" button; "Open sealed file" is inside the collapsed section "Optional: open the sealed file", so expand it before the take)
4. Council member 1: the same profile as window 2, on the TideCloak admin console, Change requests
5. Council member 2: `council2`, TideCloak admin console, Change requests
6. Fund owner: `/operator`, signed in as `council3` (the God mode view, and the "Try to forge payout authority" button)
7. Donor: `/public` ("Public ledger", with "Donate (mock)")

Arrange the windows at the same size and set browser zoom to 110-125% so the text is easy to read.

### Recording tips
- Windows: OBS or Xbox Game Bar (Win+Alt+R). macOS: Cmd+Shift+5.
- 1080p, 30 fps. Turn on Do Not Disturb so no notifications pop up.
- Record the voiceover in a quiet room with a headset mic. Read slowly, in short sentences.
- Export an .mp4 under 100 MB, for example with HandBrake (preset "Fast 1080p30", RF about 24-26). Save it as `demo/wholeleaf-demo.mp4`.
- Rehearse the whole flow at least once. The final video must be no longer than 2 minutes.
- When the bank refuses (the hospital's first and second "Collect payout"), keep the error message on screen for about 3 seconds so viewers can read it.
- Use only fake data and illustrations. Do not name any real person or celebrity, even on screen. Say clearly in the video that the bank and payments are mock (the voiceover says "mock bank").
- If the video runs over 2 minutes, cut the hospital's "Open sealed file" shot first. No voiceover covers it.
- If the Tide network does not have the contract `RelationshipAttestation:1`, the sealing (encryption) cannot run, because it is the extension. Then cut the sealing scene and the sentence "A volunteer seals Ms. Lan's file. The fund owner's God mode page shows only ciphertext." (15 words), and keep everything else. The core (group, token, bank) does not depend on this contract.

### Checklist before filming
- [ ] The hospital is NOT yet in group `/payout-case-<id>` of Ms. Lan's case.
- [ ] No old change requests are waiting in the admin console.
- [ ] Ms. Lan's file (national ID, medical summary) is fake data; children's photos are illustrations, not real photos.
- [ ] All 3 council members can sign in to the TideCloak admin console (the council is 3 realm admins; 2 of 3 must approve).
- [ ] Ms. Lan's case is created ("Create case") and set up on `/council` ("Set up case", so the volunteer can use "Encrypt and send"), and her payout group exists and is empty.
- [ ] The fund owner's God mode page (`/operator`, signed in as `council3`) shows only ciphertext. "Try to forge payout authority" has been tried and the forged token is rejected.
- [ ] "Collect payout" has been tried with the hospital account (on a rehearsal case) and the bank refused.
- [ ] `/public` shows no personal data (name, ID number, address, medical file, photo). The ledger line shows a transaction reference and "2 of 3 council".
- [ ] Close extra tabs, hide bookmarks, turn off notifications, battery full or plugged in.
- [ ] Stable network; microphone and volume tested.
- [ ] After a rehearsal, reset before the real take. Rehearse on a different case id (for example `rehearsal-1`), so Ms. Lan's group stays empty. Then stop the app and delete `data/clearaid-db.json` (this clears the rehearsal case, its ledger line and any sample cases), restart the app, and reload each profile once (`council1`, `council2`, `council3` in that order) so the accounts register again. Then set up Ms. Lan's case again (DEMO_SETUP.md, sections 5 and 7). Her group in the console can stay: it is still empty.
