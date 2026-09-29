/**
 * Composer 双态派生（TASK-006A 附属 / REQ-001）。
 * hero ⟺ `activeId === null && itemCount === 0`，与 docked 互斥且穷尽。
 */

export type ComposerVariant = "hero" | "docked";

export function deriveComposerVariant(input: {
  activeId: string | null;
  itemCount: number;
}): ComposerVariant {
  return input.activeId === null && input.itemCount === 0 ? "hero" : "docked";
}
