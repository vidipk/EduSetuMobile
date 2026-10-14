# EduSetu Mobile

Native Expo application for EduSetu student, parent, and teacher foundations. It uses Expo SDK 57, React Native 0.86, Node 22, and npm 10. No EAS service is required.

## Setup

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the reachable Nest API URL ending in `/api/v1`. A physical device cannot reach a development computer through `localhost`; use a LAN IP or a secure tunnel.

Run `npm install`, then `npm start`. Use `npm run android` for Android. iOS builds run on macOS or Codemagic.

## Android Internal Testing APK

Install Android SDK platform tools, an Android SDK platform, Build Tools, and JDK 17. Set `ANDROID_HOME` to the SDK directory, run `npx expo prebuild --platform android`, then build with the generated Gradle wrapper. The temporary internal package is `com.edusetu.mobile.internal`; it is not an approved Play Store identifier. Configure a real, phone-reachable API URL before bundling. Do not use `localhost` or `127.0.0.1` for a physical device.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npx expo-doctor`.

## Architecture

Screens call feature hooks, which use TanStack Query and feature APIs over the shared Axios client. SecureStore holds only refresh tokens. Access tokens remain in memory. See `docs/MOBILE_ARCHITECTURE.md` and `docs/MOBILE_SECURITY.md`.

## OpenAPI

Set `OPENAPI_URL` to the backend Swagger JSON endpoint or `OPENAPI_FILE` to an exported schema, then run `npm run api:generate`. Backend Swagger UI is configured at `/api/docs`; the running server should be used to verify the JSON URL before generation.

## Deferred

Academic modules, push registration, LiveKit, analytics, offline sync, Maestro, EAS Build/Submit/Update, and store identifiers are deliberately deferred.
