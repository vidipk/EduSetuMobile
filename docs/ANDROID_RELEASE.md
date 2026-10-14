# Android Release

Use JDK 17 with an Android SDK configured through `ANDROID_HOME` or `ANDROID_SDK_ROOT`. Run `npx expo prebuild --platform android` when native project generation is required. The current generated internal testing package is `com.edusetu.mobile.internal`, version code `1`; it is temporary and not a Play Store-approved identifier.

`assembleDebug` is useful for development but may rely on Metro. A release-like internal APK must be verified to contain the JavaScript bundle before being called standalone. Configure an approved phone-reachable API URL at build time, then inspect Gradle tasks and build the appropriate variant. Release bundles normally land under `android/app/build/outputs/apk/` and production AABs under `android/app/build/outputs/bundle/release/`.

Configure signing securely outside source control. Do not commit keystores or signing secrets. Production AAB signing and Play Store publishing remain separate work.
