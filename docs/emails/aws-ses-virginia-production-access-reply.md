# Reply to AWS SES Production Access Request (us-east-1 / N. Virginia)

**From:** luis.rodriguez@strixai.es (or whatever the original submitter was)
**To:** AWS SES support (reply to the original ticket thread)
**Subject:** (reply on same thread — AWS will match automatically)
**Date drafted:** 2026-04-21

---

Hello,

Thank you for the quick response. Please find below the detailed information you requested about our planned use of Amazon SES in the us-east-1 region.

## Who we are

We are **STRIX AI SL** (Spain, VAT B22477020), an early-stage B2B SaaS company building **LUCI Customs Agent** (https://aduanas.strixai.es), an AI-assisted customs-declaration platform used by Spanish and EU customs brokers (H1/H7/AES/ENS filings with AEAT España). Our first paying customer is AIRGO EXPRESS (express parcel courier, NL+ES operations). We also operate two sibling products on the same infrastructure — **AXEL** (freight quoting) and a Lambda-based notification service for **300dec / Correos** (state-owned Spanish postal carrier, customs notifications workflow).

All three products send **transactional email only** from the verified domain `strixai.es` (already in SES as a domain identity with DKIM). There is no marketing, no newsletters, no cold outreach, and no purchased lists.

## Verified identities

- Domain identity: `strixai.es` (DKIM verified, DMARC configured).
- From addresses in use:
  - `noreply@strixai.es` — LUCI + AXEL product emails
  - `luci@strixai.es` — 300dec / Correos notification service
  - `despacho@strixai.es` — human correspondence with AEAT and clients

## How often we send email

Combined across all three products, our current and projected steady-state volume is **40–85 emails per day**, broken down as:

| Source | Event types | Typical volume |
|---|---|---|
| LUCI (customs declarations) | AEAT submission confirmation, MRN received, channel assigned (green/orange/red), correction required, client document portal links, account welcome, password reset, new document uploaded notification, declaration ready for approval | 25–55 /day |
| 300dec / Correos | New AEAT notification received, deadline-approaching warnings, escalations on expired deadlines, scheduled-action notifications | 15–30 /day |
| 300dec weekly digest | One summary email per Monday 08:00 UTC to a small ops list | 1 /week |
| AXEL | Quote-status notifications | 1–5 /day |

Absolute cap we expect to hit in the next 12 months: ~500 emails/day. Well below the SES production account limit.

## How we maintain recipient lists

- Every recipient is either (a) a **registered user of our platform** who signed up and verified their email as part of account creation, or (b) a **customs-broker employee on the operations side** whose email was explicitly added by a tenant administrator via the admin UI.
- There is no purchased, scraped, or cold list. There is no "marketing opt-in".
- Recipient addresses are stored in MongoDB per-tenant and can be edited/removed by the tenant admin at any time.
- The `300dec` notification recipients are configured as environment variables by 300dec's own IT team (their employees only).

## Type and example of content

All messages are **transactional** (a user action or a dated business event triggers a single 1:1 email). Examples:

- **AEAT declaration accepted**: "Your H7 declaration for expedition AIRGO-2026-0423 has been accepted by AEAT with MRN 26ES002801... Channel: GREEN (immediate release). Duties: €2.63."
- **Channel changed to ORANGE**: "AEAT has assigned ORANGE channel to expedition X. Please upload the requested documentation by DD/MM/YYYY."
- **Deadline warning** (300dec): "The 15-day response window for AEAT notification NOT-2026-001234 expires in 3 days. Please review and submit a reply."
- **Client portal link**: a one-time tokenised URL where the end-client uploads commercial invoice / packing list.
- **Password reset** / **new account welcome**: standard account lifecycle.

There are no images, no tracking pixels. HTML body is plain with a small branded header. We can provide rendered samples if that helps.

## How we manage bounces, complaints and unsubscribes

**Honest status today (us-east-1 sandbox / eu-west-1 production):**

- SES bounces and complaints are visible in the SES console and CloudWatch, but we have **not yet wired them back into our applications**. This is the first gap we are closing as part of this production-access rollout. Concretely, within two weeks we will:
  1. Create an **SNS topic** `luci-ses-feedback` and subscribe it to SES bounce + complaint events.
  2. Add a **Lambda processor** that writes bounce/complaint addresses into a **DynamoDB suppression table** (`ses-suppressed-recipients`).
  3. Before every `SendEmail` call, our `emailService` will query the suppression table and skip any address listed there.
  4. Hard bounces and any complaint suppress the address permanently; soft bounces suppress after 3 repeated failures within 7 days.
- For **unsubscribe**, since our traffic is transactional (not bulk), a generic unsubscribe link is not appropriate for every message — a user who unsubscribes from "your AEAT customs declaration was accepted" would stop receiving legally required operational notices. Nevertheless, we will implement:
  1. A **`List-Unsubscribe` header** (RFC 8058, with both `mailto:` and `https://` endpoints) on every outbound message, pointing to a per-tenant preferences page that lets the recipient turn off non-critical notifications (deadline reminders, weekly digest) while preserving account-critical messages.
  2. An account-level "delete my account" flow (already live under GDPR Art. 17) that fully purges the email from future sends.

We will finish both items before we start sending significant volume from the us-east-1 account, and are happy to share the CloudFormation / CDK once deployed if that is useful to your review.

## Why us-east-1 in addition to eu-west-1

Our eu-west-1 SES is still in the sandbox; we were denied production access in eu-west-1 on an earlier review and are preparing a separate appeal for that region. In the meantime, us-east-1 lets us unblock customer-facing transactional email for our first paying customer (AIRGO EXPRESS) while we work through the EU review. Our recipients are almost entirely in Spain; from-domain is `strixai.es`.

## Additional technical context

- We send via the AWS SDK v3 `@aws-sdk/client-ses` from Node.js 20 (LUCI/AXEL) and Node.js 18 (AWS Lambda, 300dec).
- No third-party relay, no self-hosted SMTP bridge — directly SES API.
- All production keys are stored in AWS Secrets Manager (`luci/pii-encryption-key` etc., scoped IAM policy per service).
- Monitoring: every send/bounce is logged via Winston + Sentry. CloudWatch alarms are planned once the SNS feedback loop is live.

## Summary request

Please grant production access for SES in us-east-1 under the verified `strixai.es` identity, initial rate cap of our choosing (10 emails/second is more than enough). We will close the bounce/complaint and List-Unsubscribe gaps within two weeks of approval and are happy to follow up with confirmation once done.

Thank you very much for the review.

Best regards,

Luis Rodríguez
Tech Lead, STRIX AI SL
luis.rodriguez@strixai.es
+34 ___ ___ ___  (add phone if you want them to have one)
https://aduanas.strixai.es
