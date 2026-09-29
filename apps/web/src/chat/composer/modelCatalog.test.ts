import { describe, expect, it } from "vitest";
import { normalizeModelCatalog } from "./modelCatalog";

const EMPTY = { options: [], current: { model: null, provider: null } };

describe("normalizeModelCatalog – hostile inputs", () => {
  const garbage: unknown[] = [
    null,
    undefined,
    0,
    42,
    "",
    "not-json",
    true,
    [],
    [1, 2, 3],
    { providers: {} },
    { providers: [null, 1, "x"] },
    { models: "x" },
    { options: { a: 1 } },
    { providers: [{ models: [[]] }] },
    { providers: [{ models: [{}] }] },
    { providers: [{ models: [{ id: 123 }] }] },
    { providers: [{ models: [42] }] },
  ];

  it("never throws and yields an empty catalog for junk", () => {
    for (const input of garbage) {
      expect(() => normalizeModelCatalog(input)).not.toThrow();
      expect(normalizeModelCatalog(input)).toEqual(EMPTY);
    }
  });
});

describe("normalizeModelCatalog – providers[].models", () => {
  it("maps provider, model, label, capabilities and authenticated", () => {
    const catalog = normalizeModelCatalog({
      model: "m-b",
      provider: "openai",
      providers: [
        {
          slug: "openai",
          authenticated: true,
          capabilities: { "m-b": { fast: true, reasoning: true } },
          models: ["m-a", { id: "m-b", label: "Model B" }],
        },
        { name: "anthropic", models: [{ model: "claude" }] },
      ],
    });

    expect(catalog.current).toEqual({ model: "m-b", provider: "openai" });
    expect(catalog.options).toHaveLength(3);
    expect(catalog.options[0]).toEqual({
      id: "m-a",
      provider: "openai",
      label: "m-a",
      capabilities: {},
      authenticated: true,
    });
    expect(catalog.options[1]).toEqual({
      id: "m-b",
      provider: "openai",
      label: "Model B",
      capabilities: { fast: true, reasoning: true },
      authenticated: true,
    });
    expect(catalog.options[2]).toEqual({
      id: "claude",
      provider: "anthropic",
      label: "claude",
      capabilities: {},
      authenticated: false,
    });
  });

  it("falls back provider to empty string when no identifier is present", () => {
    const catalog = normalizeModelCatalog({ providers: [{ models: ["m"] }] });
    expect(catalog.options[0].provider).toBe("");
  });

  it("accepts id / name / provider as provider identifiers", () => {
    const byId = normalizeModelCatalog({ providers: [{ id: "p-id", models: ["m"] }] });
    const byProvider = normalizeModelCatalog({ providers: [{ provider: "p-prov", models: ["m"] }] });
    expect(byId.options[0].provider).toBe("p-id");
    expect(byProvider.options[0].provider).toBe("p-prov");
  });

  it("uses model.authenticated when the provider omits it", () => {
    const catalog = normalizeModelCatalog({
      providers: [{ slug: "p", models: [{ id: "m", authenticated: true }] }],
    });
    expect(catalog.options[0].authenticated).toBe(true);
  });

  it("lets provider.authenticated override model.authenticated", () => {
    const catalog = normalizeModelCatalog({
      providers: [{ slug: "p", authenticated: false, models: [{ id: "m", authenticated: true }] }],
    });
    expect(catalog.options[0].authenticated).toBe(false);
  });

  it("reads capabilities keyed by model id and omits absent keys", () => {
    const catalog = normalizeModelCatalog({
      providers: [
        {
          slug: "p",
          capabilities: { m1: { fast: true }, m2: { reasoning: false } },
          models: ["m1", "m2", "m3"],
        },
      ],
    });
    expect(catalog.options[0].capabilities).toEqual({ fast: true });
    expect(catalog.options[1].capabilities).toEqual({ reasoning: false });
    expect(catalog.options[2].capabilities).toEqual({});
  });

  it("ignores non-boolean capability values", () => {
    const catalog = normalizeModelCatalog({
      providers: [{ slug: "p", capabilities: { m: { fast: "yes" } }, models: ["m"] }],
    });
    expect(catalog.options[0].capabilities).toEqual({});
  });
});

describe("normalizeModelCatalog – top-level models/options", () => {
  it("accepts a top-level models array of strings", () => {
    const catalog = normalizeModelCatalog({ models: ["a", "b"] });
    expect(catalog.options).toEqual([
      { id: "a", provider: "", label: "a", capabilities: {}, authenticated: false },
      { id: "b", provider: "", label: "b", capabilities: {}, authenticated: false },
    ]);
  });

  it("accepts a top-level options array of objects with display_name", () => {
    const catalog = normalizeModelCatalog({
      options: [{ id: "z", provider: "p", display_name: "Zed", authenticated: true }],
    });
    expect(catalog.options[0]).toEqual({
      id: "z",
      provider: "p",
      label: "Zed",
      capabilities: {},
      authenticated: true,
    });
  });

  it("reads name/model as fallbacks for the id", () => {
    const catalog = normalizeModelCatalog({ models: [{ name: "n" }, { model: "mo" }] });
    expect(catalog.options.map((o) => o.id)).toEqual(["n", "mo"]);
  });

  it("does not fabricate models from entries without an id", () => {
    const catalog = normalizeModelCatalog({ models: [{ label: "no id" }, 1, null] });
    expect(catalog.options).toEqual([]);
  });
});

describe("normalizeModelCatalog – dedupe and current", () => {
  it("dedupes by provider::id keeping the first occurrence", () => {
    const catalog = normalizeModelCatalog({
      providers: [{ slug: "p", models: [{ id: "m", label: "first" }, { id: "m", label: "second" }] }],
    });
    expect(catalog.options).toHaveLength(1);
    expect(catalog.options[0].label).toBe("first");
  });

  it("keeps the same id under different providers", () => {
    const catalog = normalizeModelCatalog({
      providers: [
        { slug: "p1", models: ["m"] },
        { slug: "p2", models: ["m"] },
      ],
    });
    expect(catalog.options.map((o) => `${o.provider}::${o.id}`)).toEqual(["p1::m", "p2::m"]);
  });

  it("produces unique provider::id keys for any input", () => {
    const catalog = normalizeModelCatalog({
      providers: [
        { slug: "p", models: ["m", "m", { id: "m" }] },
        { slug: "p", models: [{ model: "m" }] },
      ],
    });
    const keys = new Set(catalog.options.map((o) => `${o.provider}::${o.id}`));
    expect(keys.size).toBe(catalog.options.length);
  });

  it("reads current model/provider and defaults to null", () => {
    expect(normalizeModelCatalog({ model: "m", provider: "p" }).current).toEqual({
      model: "m",
      provider: "p",
    });
    expect(normalizeModelCatalog({ providers: [] }).current).toEqual(EMPTY.current);
    expect(normalizeModelCatalog({ model: "", provider: 5 }).current).toEqual(EMPTY.current);
  });
});
