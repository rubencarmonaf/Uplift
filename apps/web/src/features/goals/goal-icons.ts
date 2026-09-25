import type { GoalKind } from '@uplift/shared';
import { Activity, Link2, MousePointerClick } from 'lucide-react';

export const GOAL_ICONS: Record<GoalKind, typeof Activity> = {
  click: MousePointerClick,
  pageview: Link2,
  event: Activity,
};
