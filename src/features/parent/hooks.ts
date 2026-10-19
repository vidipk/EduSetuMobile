import { performanceApi } from '@/api/academics/performance';
import { useAuth } from '@/auth/AuthProvider';
import { useRemoteData } from '@/features/performance/use-remote-data';
import { useParentContext } from '@/stores/parent-context';

/**
 * The parent's authorized children (from the backend) plus the shared selection. Only a child
 * returned by the server can ever be selected, so a revoked child silently falls back to the
 * first remaining one and no arbitrary id can be requested.
 */
export function useParentChildren() {
  const { user } = useAuth();
  const list = useRemoteData(user ? `parent-children:${user.id}` : null, () => performanceApi.listChildren());
  const selectedId = useParentContext((state) => state.selectedStudentProfileId);
  const select = useParentContext((state) => state.selectStudent);
  const children = list.data ?? [];
  const selected = children.find((child) => child.studentProfileId === selectedId) ?? children[0] ?? null;
  return { ...list, children, selected, select };
}
