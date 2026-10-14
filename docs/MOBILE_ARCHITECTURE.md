# Mobile Architecture

The data path is Screen -> feature hook -> TanStack Query -> feature API -> Axios -> NestJS. TanStack Query owns server state; Zustand only owns small client state such as the selected parent child profile.

`SessionManager` owns authentication. The access token is memory-only, while the rotating refresh token is stored by Expo SecureStore. An epoch guards bootstrap and refresh work so a stale response cannot revive a logged-out session. Query cache and parent context are cleared when a session ends.

Expo Router route groups provide separate Student, Parent, and Teacher shells. They organize navigation only; the backend remains authoritative for authorization. Organization branding overlays the EduSetu fallback tokens.
