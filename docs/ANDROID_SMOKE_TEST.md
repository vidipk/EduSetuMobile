# Android Smoke Test

- Install the internal APK with `adb install -r <APK_PATH>` without uninstalling an existing app.
- Launch the app without Metro and confirm the login screen, branding, field validation, password visibility control, and keyboard layout.
- Confirm the configured API URL is reachable from the phone and ends in `/api/v1`.
- With authorized non-production accounts, sign in existing Web Student, Parent, and Teacher users; verify the correct role shell and organization context.
- Restart to verify session restoration, then log out and verify the login route returns.
- Test invalid password, offline behavior, expired-session behavior, and unsupported Web-only roles.
- Use `adb logcat` to capture any startup crash. Do not log passwords or tokens.
