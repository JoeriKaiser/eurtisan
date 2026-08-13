# Transactional Email DNS (SPF, DKIM, DMARC)

Eurtisan sends transactional email through **Brevo** (`api.brevo.com`). Deliverability depends on DNS records for your sending domain (e.g. `eurtisan.eu`).

## 1. Root-domain SPF

Publish a TXT record on the root domain:

| Host | Type | Value |
|------|------|-------|
| `@` | TXT | `v=spf1 include:spf.sendinblue.com ~all` |

If you already have SPF, merge includes: only one SPF TXT record is allowed per domain.

## 2. Root-domain DKIM

In the Brevo dashboard (**Senders & IP → Domains**), add `eurtisan.eu` and copy the DKIM CNAME records Brevo provides (typically two selectors under `mail._domainkey` or similar).

Example pattern (use exact values from Brevo):

| Host | Type | Value |
|------|------|-------|
| `mail._domainkey` | CNAME | `<selector>.dkim.brevo.com` |

Wait for Brevo to show the domain as **Authenticated**.

## 3. Root-domain DMARC

Start with monitoring, then tighten after a stable sending history:

| Host | Type | Value |
|------|------|-------|
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@eurtisan.eu; pct=100; adkim=s; aspf=s` |

After 2–4 weeks of clean alignment, move to `p=quarantine` or `p=reject` per your deliverability review.

## 4. Dedicated transactional subdomain

To protect the main domain's reputation, production sends from a dedicated transactional subdomain: `mail.eurtisan.eu`.

1. Add `mail.eurtisan.eu` as a sending domain in Brevo (**Senders & IP → Domains**).
2. Publish the DNS records Brevo provides for the subdomain.
3. Required records (verify exact DKIM values in Brevo):

| Host | Type | Value |
|------|------|-------|
| `mail` | A | Production VPS IP |
| `mail` | TXT | `v=spf1 include:spf.sendinblue.com ~all` |
| `_dmarc.mail` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@eurtisan.eu; pct=100; adkim=s; aspf=s` |
| `mail._domainkey.mail` | CNAME | `<selector>.dkim.brevo.com` |

4. Set `EMAIL_FROM_ADDRESS=noreply@mail.eurtisan.eu` in production.

During the transition, keep the root-domain SPF/DKIM records. Once the subdomain is warmed and trusted, you can remove the root-domain Brevo DKIM selectors or leave them in place for any non-transactional mail sent from the root domain. The final desired state is:

- Root domain SPF includes Brevo (or not, if no root-domain mail is sent).
- Root domain DKIM only if non-transactional mail is sent from the root domain.
- Subdomain `mail.eurtisan.eu` owns all transactional sending reputation.

## 5. Verification

```bash
dig TXT eurtisan.eu +short
dig TXT _dmarc.eurtisan.eu +short
dig CNAME mail._domainkey.eurtisan.eu +short
dig TXT mail.eurtisan.eu +short
dig TXT _dmarc.mail.eurtisan.eu +short
dig CNAME mail._domainkey.mail.eurtisan.eu +short
```

Send a test message from staging and confirm:

- Gmail **Show original** → SPF pass, DKIM pass, DMARC pass
- Brevo dashboard shows no authentication warnings
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers are present

## 6. Brevo sender address

Set `EMAIL_FROM_ADDRESS` / Brevo sender to an address on the authenticated subdomain (e.g. `noreply@mail.eurtisan.eu`). See `docs/DEPLOYMENT.md` for environment variables.

## 7. Subdomain warmup

Before high-volume sends:

1. Verify ownership of `mail.eurtisan.eu` in Brevo.
2. Add all DNS records and confirm authentication.
3. Send a test email and inspect headers in Gmail.
4. Gradually increase volume over 2–4 weeks while monitoring Brevo deliverability stats.

## Brevo webhooks

Configure Brevo transactional webhooks to `POST https://<domain>/api/webhooks/brevo?token=<BREVO_WEBHOOK_TOKEN>`.
Set `BREVO_WEBHOOK_TOKEN` in production `.env` (required). Hard bounces and spam complaints suppress the address in `email_suppression`.
