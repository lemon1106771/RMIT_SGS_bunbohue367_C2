## Project overview

**WholeLeaf is a charity fund that pays a hospital only after 2 of 3 council members approve, so no hero, admin or AI can decide alone.**

### Vision & originality
Small charities depend on donors trusting one person. WholeLeaf replaces that person with a rule: a case's payout group starts empty, and the bank pays only once the hospital is in it. A charity product, not a login demo.

### Trust constraint insight
Charity offers transparency, privacy or control: pick two. In September 2024, 12,000+ pages of Typhoon Yagi bank statements were published, exposing donors' names and messages. Decree 93/2021/ND-CP only requires results after collection or distribution ends. Families post ID cards and medical records on Facebook to be believed. Remove the need to trust a hero: donors verify, families stay private.

### Value & impact
Ms. Lan in Quang Binh needs 50,000,000 VND for her child's surgery. Donors see the payout on a public ledger with no personal data; her files stay private. Money goes only to Hoa Binh Hospital (mock).

### Why TideCloak matters
- **Approval:** adding the hospital to group `/payout-case-<id>` is an IGA change request needing 2 of 3 council approvals in the Tide enclave.
- **Signature:** tokens are signed by the Tide network's threshold key, so no admin or server can mint the payout permission.
- **Enforcement:** the mock bank verifies signature and DPoP, paying only if the token carries `/payout-case-<id>`.

### Prototype & storytelling
The hospital clicks "Collect payout": "Payout refused". Two council members approve in TideCloak. It collects again: "Paid out". Watch refusal become payment after the second approval. "Try to forge payout authority" shows "Forged token rejected".

Limits: a colluding 2-of-3 quorum can approve; a real bank must verify Tide tokens; council members are realm admins; payments are mocked.
