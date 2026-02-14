# NSRC / PDRM Direct Target Map

Date verified: February 14, 2026

## NSRC (NFCC) Targets

| Channel | Target | Type | Notes |
|---|---|---|---|
| Emergency hotline | `997` | Voice hotline | NSRC FAQ states 997 is emergency response, not a general case follow-up API portal |
| Information page | `https://nfcc.jpm.gov.my/index.php/en/about-nsrc` | Content page | Public FAQ + workflow guidance; no public JSON/Form API endpoint exposed |

Conclusion: NSRC public integration surface is hotline-first. No direct machine-ingest API/Form POST endpoint is publicly exposed on NFCC pages.

## PDRM / CCID SemakMule Targets

SemakMule frontend config exposes API bases:

- `https://semakmule.rmp.gov.my/api/mule/`
- `https://mule.the-oaks.my/api/p/`

Direct endpoints discovered from live JS and runtime checks:

| Endpoint | Method | Status (2026-02-14) | Purpose |
|---|---|---|---|
| `https://semakmule.rmp.gov.my/api/mule/get_homepage_stats` | `GET` | 200 | Home stats + top scam account/phone datasets |
| `https://semakmule.rmp.gov.my/api/mule/get_latest_data` | `GET` | 200 | Rolling stats refresh |
| `https://semakmule.rmp.gov.my/api/mule/get_search_data` | `POST` JSON | 200 | Search endpoint (`{"data":{...}}`) |
| `https://semakmule.rmp.gov.my/api/mule/get_captcha` | `GET` | 500 | Captcha endpoint present but currently returns server error during verification |
| `https://mule.the-oaks.my/api/p/home` | `GET` | Referenced | Ancillary home/content feed |
| `https://mule.the-oaks.my/api/p/get_article` | `POST` JSON | Referenced | Ancillary article content feed |

## PDRM e-Reporting Form Targets

| Endpoint | Method | Type | Notes |
|---|---|---|---|
| `https://ereporting.rmp.gov.my/index.aspx/` | `POST` form | ASP.NET WebForms | Primary login/reporting shell; form action uses postback |
| `https://ereporting.rmp.gov.my/modules/er/index.aspx` | `POST` form | ASP.NET WebForms | Module route, redirects to authenticated flow |
| `https://ereporting.rmp.gov.my/modules/er/ereport.aspx?Q=...` | `GET`/`POST` | ASP.NET page route | Referenced by portal script for report flow bootstrap |

Operational note: e-Reporting is stateful ASP.NET form workflow (`__VIEWSTATE`/`__EVENTTARGET`) rather than a documented REST API.
