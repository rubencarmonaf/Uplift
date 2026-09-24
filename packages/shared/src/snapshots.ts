import { z } from 'zod';
import type { ElementKind } from './elements.js';

/** A rendered, script-free copy of the project's page, used by the visual element picker. */
export const snapshotSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  url: z.string(),
  finalUrl: z.string(),
  title: z.string(),
  createdAt: z.iso.datetime(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

/** What the picker running inside the snapshot iframe reports when the user clicks an element. */
export type PickedElement = {
  selector: string;
  text: string;
  tagName: string;
  suggestedType: ElementKind;
};

/** Messages between the snapshot iframe (picker) and the app. */
export type PickerToAppMessage =
  | { source: 'uplift-picker'; type: 'ready' }
  | { source: 'uplift-picker'; type: 'pick'; element: PickedElement }
  | { source: 'uplift-picker'; type: 'cancel' };

export type AppToPickerMessage = {
  source: 'uplift-app';
  type: 'highlight';
  selectors: string[];
};

/** Reasons a snapshot can fail, so the UI can explain them. */
export const SNAPSHOT_ERRORS = ['blocked_url', 'timeout', 'unreachable', 'too_large'] as const;
export type SnapshotError = (typeof SNAPSHOT_ERRORS)[number];
