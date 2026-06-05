# Transactional Email DNS (SPF, DKIM, DMARC)

Eurtisan sends transactional email through **Brevo** (`api.brevo.com`). Deliverability depends on DNS records for your sending domain (e.g. `eurtisan.eu`).

## 1. SPF

Publish a TXT record on the root domain:

| Host | Type | Value |
|------|------|-------|
| `@` | TXT | `v=spf1 include:spf.sendinblue.com ~all` |

If you already have SPF, merge includes: only one SPF TXT record is allowed per domain.

## 2. DKIM

In the Brevo dashboard (**Senders & IP → Domains**), add `eurtisan.eu` and copy the DKIM CNAME records Brevo provides (typically two selectors under `mail._domainkey` or similar).

Example pattern (use exact values from Brevo):

| Host | Type | Value |
|------|------|-------|
| `mail._domainkey` | CNAME | `<selector>.dkim.brevo.com` |

Wait for Brevo to show the domain as **Authenticated**.

## 3. DMARC

Start with monitoring, then tighten after a stable sending history:

| Host | Type | Value |
|------|------|-------|
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@eurtisan.eu; pct=100; adkim=s; aspf=s` |

After 2–4 weeks of clean alignment, move to `p=quarantine` or `p=reject` per your deliverability review.

## 4. Verification

```bash
dig TXT eurtisan.eu +short
dig TXT _dmarc.eurtisan.eu +short
dig CNAME mail._domainkey.eurtisan.eu +short
```

Send a test message from staging and confirm:

- Gmail **Show original** → SPF pass, DKIM pass, DMARC pass
- Brevo dashboard shows no authentication warnings

## 5. Brevo sender address

Set `EMAIL_FROM` / Brevo sender to an address on the authenticated domain (e.g. `noreply@eurtisan.eu`). See `docs/DEPLOYMENT.md` for environment variables.

## Brevo webhooks

Configure Brevo transactional webhooks to `POST https://<domain>/api/webhooks/brevo?token=<BREVO_WEBHOOK_TOKEN>`.
Set `BREVO_WEBHOOK_TOKEN` in production `.env` (required). Hard bounces and spam complaints suppress the address in `email_suppression`.
