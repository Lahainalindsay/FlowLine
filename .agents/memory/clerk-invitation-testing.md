---
name: Clerk invitation testing
description: How to preserve email-bound invitations with Replit-managed Clerk and synthetic browser test identities.
---

Keep invitation acceptance bound to the authenticated recipient email. In production, resolve a missing session email through Clerk's server-side user record rather than trusting request input.

**Why:** Synthetic Clerk test identities can authenticate with a user ID while omitting email claims and may not exist in Clerk's backend user directory. That correctly causes a secure invitation check to reject them even when a testing helper was given a display email.

**How to apply:** For browser tests of invitation acceptance, explicitly override the test session's email claim to the exact invited address. Never weaken recipient matching or accept a client-submitted email to make automation pass.