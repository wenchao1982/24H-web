import { describe, expect, it } from "vitest";
import { normalizeConfigSchema, schemaFieldsForPrefix } from "./schema";

describe("normalizeConfigSchema", () => {
  it("normalizes fields, options and category order", () => {
    const schema = normalizeConfigSchema({
      fields: {
        "tools.tool_search.enabled": {
          type: "string",
          description: "模式",
          category: "tools",
          options: ["auto", "on"],
        },
        "x.y": { type: "boolean" },
      },
      category_order: ["tools", "general"],
    });
    expect(schema.fields["tools.tool_search.enabled"]).toEqual({
      type: "string",
      description: "模式",
      category: "tools",
      options: ["auto", "on"],
    });
    expect(schema.fields["x.y"]).toMatchObject({
      type: "boolean",
      description: "x.y",
      category: "general",
    });
    expect(schema.categoryOrder).toEqual(["tools", "general"]);
  });

  it("tolerates garbage", () => {
    expect(normalizeConfigSchema(null).fields).toEqual({});
    expect(normalizeConfigSchema("nope").categoryOrder).toEqual([]);
  });
});

describe("schemaFieldsForPrefix", () => {
  it("includes the prefix itself and dotted descendants only", () => {
    const schema = normalizeConfigSchema({
      fields: {
        "a.b": { type: "boolean", description: "AB", category: "a" },
        "a.bc": { type: "string", description: "ABC", category: "a" },
        a: { type: "object", description: "A", category: "a" },
      },
      category_order: [],
    });
    expect(schemaFieldsForPrefix(schema, "a.b").map((field) => field.path)).toEqual(["a.b"]);
  });

  it("maps options to a select field", () => {
    const schema = normalizeConfigSchema({
      fields: { "s.e": { type: "string", description: "E", category: "s", options: ["x"] } },
      category_order: [],
    });
    expect(schemaFieldsForPrefix(schema, "s")[0]).toMatchObject({
      path: "s.e",
      type: "select",
      options: ["x"],
      label: "E",
    });
  });
});
