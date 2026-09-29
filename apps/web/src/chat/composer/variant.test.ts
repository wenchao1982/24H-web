import { describe, expect, it } from "vitest";
import { deriveComposerVariant } from "./variant";

describe("deriveComposerVariant", () => {
  it("is hero when there is no active session and no items", () => {
    expect(deriveComposerVariant({ activeId: null, itemCount: 0 })).toBe("hero");
  });

  it("is docked once an active session exists", () => {
    expect(deriveComposerVariant({ activeId: "s1", itemCount: 0 })).toBe("docked");
  });

  it("is docked when a hero session already has items", () => {
    expect(deriveComposerVariant({ activeId: null, itemCount: 1 })).toBe("docked");
    expect(deriveComposerVariant({ activeId: null, itemCount: 9 })).toBe("docked");
  });

  it("is docked for an active session with items", () => {
    expect(deriveComposerVariant({ activeId: "s1", itemCount: 3 })).toBe("docked");
  });

  it("is mutually exclusive and exhaustive over the input matrix", () => {
    const ids: (string | null)[] = [null, "s1"];
    const counts = [0, 1, 7];
    let heroCount = 0;
    for (const activeId of ids) {
      for (const itemCount of counts) {
        const variant = deriveComposerVariant({ activeId, itemCount });
        expect(["hero", "docked"]).toContain(variant);
        if (variant === "hero") {
          heroCount += 1;
          expect(activeId).toBeNull();
          expect(itemCount).toBe(0);
        }
      }
    }
    expect(heroCount).toBe(1);
  });
});
