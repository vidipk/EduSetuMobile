# Mobile Security

Passwords and access tokens are never persisted. Refresh tokens are environment-namespaced in SecureStore and are rotated by `/auth/mobile/refresh`. Installation IDs are randomly generated UUIDs, not hardware identifiers.

The mobile client never uses browser cookies, localStorage, or blob URLs. Protected downloads carry the in-memory bearer token. Logout clears memory, SecureStore, Query cache, and role-specific transient state even offline. Deep links and file routes still require backend authorization.

Telemetry is optional. Sentry initializes only with a DSN and drops request payloads and sensitive headers. Do not log credentials, tokens, or student data.

Android release-like builds must use a trusted HTTPS API endpoint. Local LAN HTTP, when needed for development, must be intentionally isolated to a development build; it must not become a production network-security exception. Internal APK signing is not production Play Store signing.
