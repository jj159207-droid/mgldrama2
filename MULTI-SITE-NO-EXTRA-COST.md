# Multi-site plan — no new paid services

This branch develops multi-site support without creating new Supabase, Vercel, Bunny, or GitHub projects.

## Sites

- taza — existing production site
- kino-drama — Кино Драма
- kinochid — Киночид
- fire — Fire

## Shared infrastructure

- One GitHub repository
- One Vercel project
- One Supabase project
- One Bunny account/library infrastructure

## Isolation model

Every site-owned row will be scoped by `site_id`:
- films
- users / guest identity mapping
- pending payments
- wallet ledger
- access rights
- chats / support
- analytics
- site settings
- appearance
- push subscriptions

Admins will be scoped to one site. A master admin can access all sites.

## URLs

No new domain purchase is required. Start with either:
- paths on the existing domain: `/kino-drama`, `/kinochid`, `/fire`; or
- subdomains of the existing domain later, if DNS/Vercel configuration allows it.

## Safety rollout

1. Keep `main` / TAZA production unchanged.
2. Build and test multi-site code on `multi-site`.
3. Add database migration with existing rows defaulted to `taza`.
4. Verify payment, wallet, playback, chat, admin and analytics by site.
5. Only then merge to `main`.

## Important

Using shared infrastructure avoids creating new fixed-cost projects, but all sites share the same existing usage quotas. Traffic, bandwidth, storage, database, and video usage can still increase consumption.
