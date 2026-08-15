# Global Market Legal Checklist — Life in a Sound

This is a factual checklist of legal review questions for the intended closed
beta markets of Life in a Sound. **This is not legal advice and not
jurisdiction-specific legal advice.** Each item is a question for a qualified
lawyer in the relevant jurisdiction. Nothing here is marked "complete."

Companion documents:
- `IP_INVENTORY.md`
- `INVENTION_DISCLOSURE.md`
- `DATA_FLOW_AND_PRIVACY_MAP.md`

Intended markets: Türkiye, EU/EEA, United Kingdom, United States, Canada,
Australia.

---

## How to use this checklist

For each market, the same review areas are listed. Answer each with the help of
qualified local counsel. An unanswered item is an open question, not a pass.

Review areas (applied per market):
1. Privacy / data protection
2. AI disclosure
3. Consumer terms
4. Subscription terms (future)
5. Children / minors
6. Data deletion / export
7. Cross-border transfers
8. Cookies / analytics
9. Intellectual property
10. Trademarks
11. Software ownership
12. Contractor IP assignment

---

## 1. Türkiye (KVKK + relevant AI/e-commerce law)

| Area | Open review question |
|------|----------------------|
| Privacy / data protection | Does processing comply with KVKK (Law No. 6698)? What are the lawful bases (explicit consent vs. other KVKK conditions) per category? Is "special quality personal data" processed, triggering KVKK Art. 6 safeguards? Is a data-processing registry obligation triggered? Are VERBIS registrations required? |
| AI disclosure | Is there disclosure/notice required for AI-generated content or AI interaction under Turkish law or KVKK? How should the Companion's AI nature be disclosed? |
| Consumer terms | Do consumer-facing terms comply with Turkish consumer protection and distance-contracts/e-commerce rules? Turkish-language requirements? |
| Subscription terms (future) | If paid subscriptions are introduced: distance-selling, recurring-billing, and cancellation rules under Turkish law? |
| Children / minors | Age thresholds and parental-consent requirements under KVKK for minors? |
| Data deletion / export | KVKK deletion/rectification/objection rights implementation? Data portability under KVKK? |
| Cross-border transfers | KVKK cross-border transfer rules (countries with adequate protection / explicit consent / other conditions) for Supabase, Cloudflare, and AI providers? |
| Cookies / analytics | Turkish cookie/electronic-communication notice requirements? |
| Intellectual property | Copyright in code/content under Turkish law; absent licence file implications? |
| Trademarks | "Life in a Sound" / "SoundMap" / tagline clearance at Türk PatentMarka? |
| Software ownership | Authorship/ownership presumption under Turkish law; employment/contractor assignment? |
| Contractor IP assignment | Are AI-assisted contributions (gpt-engineer-app bot, OpenHands) and contractor work assigned in writing under Turkish law? |

---

## 2. EU / EEA (GDPR + AI Act + consumer law)

| Area | Open review question |
|------|----------------------|
| Privacy / data protection | GDPR lawfulness of processing per category; Art. 6 lawful basis (consent vs. contract vs. legitimate interests); special-category Art. 9 if sensitive content; transparency Art. 13/14; DPIA Art. 35 (given profiling + sensitive emotional content)? |
| AI disclosure | EU AI Act risk classification of the Companion (limited/high risk?); transparency obligations for AI interaction/content; anticipated compliance timeline? |
| Consumer terms | Unfair terms directive; Omnibus Directive / "Digital Services Act" transparency for digital content services? |
| Subscription terms (future) | Recurring payments, cancellation, pre-contract information for digital content subscriptions? |
| Children / minors | GDPR Art. 8 digital-consent age (member-state-specific, 13–16); "best interests of the child" for emotional content? |
| Data deletion / export | Right to erasure Art. 17 (incl. provider-side feasibility); data portability Art. 20? |
| Cross-border transfers | Chapter V transfers to Supabase/Cloudflare/AI providers; SCCs/adequacy (e.g., EU-US Data Privacy Framework for US providers)? |
| Cookies / analytics | ePrivacy consent for cookies/localStorage; cookie banner? |
| Intellectual property | Software directive/Copyright directive; authorship of AI-assisted code in EU? |
| Trademarks | EUIPO clearance + national registers; Madrid Protocol? |
| Software ownership | Authorship/first ownership presumption; work-for-hire doctrine limits in EU? |
| Contractor IP assignment | Written assignment of contractor + AI-assisted contributions under member-state law? |

---

## 3. United Kingdom (UK GDPR + DPA 2018 + AI/cconsumer)

| Area | Open review question |
|------|----------------------|
| Privacy / data protection | UK GDPR lawfulness; special-category data; transparency; DPIA? |
| AI disclosure | UK AI regulatory approach (sectoral, principles-based); ICO guidance on AI/automated decision-making and transparency? |
| Consumer terms | Consumer Rights Act 2015 (digital content); CRA 2015 unfair terms; Digital Markets/Consumer rights reforms? |
| Subscription terms (future) | Recurring billing/cancellation under UK consumer law? |
| Children / minors | UK age-appropriate design code (Children's Code) — age assurance, best interests? |
| Data deletion / export | UK GDPR erasure/portability; provider-side feasibility? |
| Cross-border transfers | UK transfers (IDTA / UK Addendum to SCCs; UK-US data bridge)? |
| Cookies / analytics | PECR cookie consent? |
| Intellectual property | CDPA 1988; computer-generated works/authorship questions (s.9/s.178)? |
| Trademarks | UKIPO clearance; Madrid? |
| Software ownership | CDPA first ownership; employee vs. contractor defaults? |
| Contractor IP assignment | Written assignment + AI-assisted contribution treatment under UK law? |

---

## 4. United States (federal + state)

| Area | Open review question |
|------|----------------------|
| Privacy / data protection | Patchwork: state laws (e.g., California CCPA/CPRA; Colorado, Virginia, etc.); sensitive-data handling; privacy notice requirements; do-not-signal obligations? |
| AI disclosure | State AI laws (e.g., Colorado AI Act); FTC AI/automated decision guidance; disclosure of AI interaction? |
| Consumer terms | State consumer-protection / unfair-and-deceptive-practices (UDAP); digital content terms? |
| Subscription terms (future) | Recurring billing / negative-option rules (FTC, state auto-renewal laws)? |
| Children / minors | COPPA if under 13; state age-appropriate codes (e.g., California Age-Appropriate Design Code)? |
| Data deletion / export | CCPA/CPRA deletion + portability for covered businesses? |
| Cross-border transfers | US privacy law perspective; onward transfers from EU/UK under DPF? |
| Cookies / analytics | State cookie/tracker notice requirements; CCPA "do not sell/share"? |
| Intellectual property | US Copyright Act; work made for hire; AI-assisted authorship (US Copyright Office guidance)? |
| Trademarks | USPTO clearance; common-law rights? |
| Software ownership | Work-for-hire statutory + written assignment? |
| Contractor IP assignment | Written assignment of contractor + AI-assisted contributions? |

---

## 5. Canada (PIPEDA + provincial + Quebec Law 25)

| Area | Open review question |
|------|----------------------|
| Privacy / data protection | PIPEDA + provincial (e.g., BC, Alberta); Quebec Law 25 (consent, automated decisions, privacy impact assessment)? |
| AI disclosure | CSA/ISED AI guidance; Quebec Law 25 automated-decision profiling disclosure? |
| Consumer terms | Provincial consumer-protection; Quebec language requirements (French)? |
| Subscription terms (future) | Provincial auto-renewal/cancellation rules? |
| Children / minors | Provincial minors' consent ages? |
| Data deletion / export | PIPEDA access/correction; deletion expectations? |
| Cross-border transfers | PIPEDA accountability for transfers abroad; Quebec restrictions? |
| Cookies / analytics | Provincial cookie/consent expectations? |
| Intellectual property | Copyright Act; AI-assisted authorship (CCH/Copyright Board guidance)? |
| Trademarks | CIPO clearance; Madrid? |
| Software ownership | First ownership; moral rights; assignment in writing? |
| Contractor IP assignment | Written assignment + AI-assisted contributions under Canadian law? |

---

## 6. Australia (Privacy Act + consumer/AI)

| Area | Open review question |
|------|----------------------|
| Privacy / data protection | Privacy Act 1988 (APPs); Australian Privacy Act reforms + potential sensitive-data/children provisions; Privacy Act review status? |
| AI disclosure | Voluntary AI Ethics Framework; emerging mandatory guardrails for high-risk AI? |
| Consumer terms | Australian Consumer Law (ACL) — unfair terms, consumer guarantees for digital services? |
| Subscription terms (future) | Recurring billing/cancellation under ACL + ASIC guidance? |
| Children / minors | APP guidance on children; Online Safety Act considerations? |
| Data deletion / export | APP access/correction; deletion expectations? |
| Cross-border transfers | APP 8 cross-border disclosure accountability? |
| Cookies / analytics | eMarketing/cookie consent expectations? |
| Intellectual property | Copyright Act 1968; AI-assisted authorship questions? |
| Trademarks | IP Australia clearance; Madrid? |
| Software ownership | First ownership; assignment in writing? |
| Contractor IP assignment | Written assignment + AI-assisted contributions under Australian law? |

---

## 7. Ownership review (verified facts + open questions)

Verified facts from repository history (`git log --all`):

- **Source repository:** `github.com/mascarillion8888/life-in-sound-4051019b`
  (remote `origin`).
- **Contributors found in git history (all commits):**
  - `openhands <openhands@all-hands.dev>` — 11 commits.
  - `gpt-engineer-app[bot] <159125892+gpt-engineer-app[bot]@users.noreply.github.com>`
    — 1 commit (the initial `e08ad47 "AI Personality Card v 0.40"`).
- **Total commits visible:** 12 (the repository is a **shallow clone**;
  earlier history may exist upstream but is not present here).
- **No licence file** is present (verified: no `LICENSE*`).
- **No `CONTRIBUTING.md` or CLA** is present.
- **No assignment/employment/contractor agreements** are present in the
  repository.

Open ownership questions (not asserted as resolved):

- The package.json `name` is `tanstack_start_ts` (a scaffold name), not the
  product name; `license` and `author` fields are absent.
- AI-assisted contributions are present (gpt-engineer-app bot, OpenHands).
  Whether AI-assisted code is ownable/assignable, and who owns it, is a legal
  question per jurisdiction.
- No written IP assignment from any human contributor or contractor is
  evidenced in-repo.

> **Ownership documentation not verified — legal review required.**

---

## 8. Cross-cutting items (all markets)

- **Beta tester confidentiality:** Are beta testers bound by confidentiality
  before experiencing potentially novel mechanisms (see Invention Disclosure)?
  This bears on patent novelty and trade-secret preservation.
- **Terms of service + privacy policy:** No end-user Terms or Privacy Policy
  are present in the repository. **Requires legal review** — these must be
  drafted and published before any real-user beta.
- **AI-provider data-processing review:** Each provider's current DPA/privacy
  terms, retention, training-use, and transfer terms must be reviewed
  individually; do not assume any provider's policy.
- **DPIA / risk assessment:** Given emotional/personal content + profiling
  (Music DNA, Patterns, Companion), a DPIA (or equivalent) is likely required
  in EU/UK and may be advisable elsewhere.
- **Cookies/localStorage:** The app uses `localStorage` for session +
  offline fallback; ePrivacy/cookie-consent obligations may apply.

---

## 9. What this checklist is NOT

- Not definitive jurisdiction-specific legal advice.
- Not a representation that any item is satisfied.
- Not exhaustive; markets and laws evolve.

_End of Global Market Legal Checklist._
