import * as Sentry from '@sentry/react-native';

import { env } from '@/config/env';

const sensitive = /authorization|password|token|refreshToken|accessToken/i;

export function initializeObservability() {
  if (!env.EXPO_PUBLIC_SENTRY_DSN) return;
  Sentry.init({
    dsn: env.EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) event.request.headers = Object.fromEntries(Object.entries(event.request.headers).filter(([key]) => !sensitive.test(key)));
      event.request = undefined;
      return event;
    },
  });
}

export function reportError(error: unknown) {
  if (env.EXPO_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
}
