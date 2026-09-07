---
name: Stripe proxy-only billing
description: Durable constraints for secure Stripe billing through a proxy-only Replit connection.
---

Treat the attached Stripe connection as proxy-only when it reports no SDK client and withholds raw API and webhook signing secrets. Use the authenticated connector proxy for Stripe operations, and authenticate webhook content by retrieving the canonical event from Stripe using only the constrained event ID from the raw payload.

**Why:** This project's healthy Stripe connection intentionally does not expose raw credentials. Attempts to use secret-key-based Stripe SDK or StripeSync clients fail even though proxy requests succeed. Canonical retrieval ensures application logic never trusts caller-supplied event fields.

**How to apply:** Keep Checkout and Customer Portal calls behind server-enforced workspace permissions and exact catalog allowlists. Make webhook reconciliation durable and replay-safe, reconcile current subscription state rather than event snapshots, and never persist or request raw Stripe credentials for this connection.