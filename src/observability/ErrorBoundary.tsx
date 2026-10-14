import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/design-system/components';
import { reportError } from './sentry';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { reportError(error); }
  render() { return this.state.failed ? <ErrorState message="The app hit an unexpected problem. Please reopen it." /> : this.props.children; }
}
