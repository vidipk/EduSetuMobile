import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { AppButton, AppScreen, AppText } from '@/design-system/components';

export default function Unsupported() {
  const { user, logout } = useAuth();

  if (!user) return <Redirect href="/(auth)/login" />;

  return <AppScreen style={{ justifyContent: 'center', gap: 16 }}>
    <AppText style={{ fontSize: 24, fontWeight: '700' }}>EduSetu Mobile</AppText>
    <AppText>This {user.role.toLowerCase().replace('_', ' ')} account is currently supported on EduSetu Web.</AppText>
    <AppButton title="Sign out" onPress={() => void logout()} />
  </AppScreen>;
}
