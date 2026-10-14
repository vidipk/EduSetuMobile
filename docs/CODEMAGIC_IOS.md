# Codemagic iOS

Codemagic should run `npm ci`, `npx expo prebuild --platform ios`, and `pod install` when required before an Xcode archive. Keep Apple credentials, provisioning data, and App Store Connect credentials in Codemagic secrets. No EAS Build or Submit configuration is required.
