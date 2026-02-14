# NSRC / PDRM Direct Target Map

Date re-verified: February 14, 2026 (live endpoint checks)

## NSRC (NFCC) Targets

| Channel | Target | Type | Live finding |
|---|---|---|---|
| Emergency hotline | `997` | Voice hotline | Present on both NFCC NSRC pages (`/ms/nsrc` and `/en/about-nsrc`) |
| Info page (EN) | `https://nfcc.jpm.gov.my/index.php/en/about-nsrc` | Content page | 200; no public `<form method="post">` and no `/api/` references in page HTML |
| Info page (BM) | `https://nfcc.jpm.gov.my/index.php/ms/nsrc` | Content page | 200; informational workflow page for hotline and response flow |

Conclusion: NSRC public integration is still hotline-first. No direct public machine-ingest API/Form-POST target is exposed on NFCC NSRC pages.

## PDRM / CCID SemakMule Targets

SemakMule runtime config (`https://semakmule.rmp.gov.my/config.js`) currently exposes:

- `apiEndPointMule = "https://semakmule.rmp.gov.my/api/mule/"`
- `apiEndPoint = "https://mule.the-oaks.my/api/p/"`

Main bundle (`/static/js/main.188e200d.js`) references:

- `get_homepage_stats`
- `get_latest_data.php`
- `get_search_data.php`
- `get_captcha.php`
- `get_article`

Live endpoint checks:

| Endpoint | Method | Status (2026-02-14) | Notes |
|---|---|---|---|
| `https://semakmule.rmp.gov.my/api/mule/get_homepage_stats` | `GET` | 200 | Homepage aggregate stats |
| `https://semakmule.rmp.gov.my/api/mule/get_latest_data` | `GET` | 200 | Rolling/refresh stats path |
| `https://semakmule.rmp.gov.my/api/mule/get_latest_data.php` | `GET` | 200 | JS-referenced variant |
| `https://semakmule.rmp.gov.my/api/mule/get_search_data` | `POST` JSON | 200 | Search accepts JSON body (`{"data":{...}}`) |
| `https://semakmule.rmp.gov.my/api/mule/get_search_data.php` | `POST` JSON | 200 | JS-referenced variant |
| `https://semakmule.rmp.gov.my/api/mule/get_captcha` | `GET` | 500 | Captcha endpoint available but returns server error in checks |
| `https://semakmule.rmp.gov.my/api/mule/get_captcha.php` | `GET` | 500 | JS-referenced variant |
| `https://mule.the-oaks.my/api/p/home` | `GET` | 200 | Ancillary content/home feed |
| `https://mule.the-oaks.my/api/p/get_article` | `POST` JSON | 200 | Ancillary article endpoint (response body can be policy-gated) |

## PDRM e-Reporting Form Targets (WebForms)

| Endpoint | Live status | Form method/action | Notes |
|---|---|---|---|
| `https://ereporting.rmp.gov.my/index.aspx/` | 200 | `method="post"`, `action="./"` | Login shell page |
| `https://ereporting.rmp.gov.my/modules/er/index.aspx` | 200 | `method="post"`, `action="./index.aspx?ReturnUrl=%2fmodules%2fer%2findex.aspx"` | Module landing |
| `https://ereporting.rmp.gov.my/modules/er/ereport.aspx` | 200 | `method="post"`, `action="./index.aspx?ReturnUrl=%2fmodules%2fer%2fereport.aspx"` | Protected report flow |

Operational note: e-Reporting remains stateful ASP.NET WebForms (`__VIEWSTATE`, `__EVENTTARGET`), not a documented REST submission API.
