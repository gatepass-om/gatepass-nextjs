import { notFound } from 'next/navigation';
import { isWorkflowStudioEnabled } from '@/lib/features';

export default function WorkflowsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isWorkflowStudioEnabled()) notFound();

  return children;
}
