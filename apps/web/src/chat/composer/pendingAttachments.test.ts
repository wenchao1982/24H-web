import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BATCH,
  MAX_FILE_BYTES,
  createPendingAttachment,
  dedupe,
  kindOf,
  readAsDataUrl,
  screenFiles,
} from "./pendingAttachments";

/** 只读元数据的轻量 File 替身，避免为边界用例分配 10MB 内存。 */
function fakeFile(name: string, size: number, type = "", lastModified = 0): File {
  return { name, size, type, lastModified } as File;
}

/** `screenFiles` 绝不应读取内容：一旦被读即抛错。 */
function unreadableFile(name: string, size: number, type = ""): File {
  const file = fakeFile(name, size, type) as File & {
    arrayBuffer: () => Promise<ArrayBuffer>;
    text: () => Promise<string>;
  };
  file.arrayBuffer = () => {
    throw new Error(`不应读取文件内容: ${name}`);
  };
  file.text = () => {
    throw new Error(`不应读取文件内容: ${name}`);
  };
  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("kindOf", () => {
  it("maps image/* to image", () => {
    expect(kindOf(fakeFile("a.png", 1, "image/png"))).toBe("image");
  });

  it("is case-insensitive for image MIME", () => {
    expect(kindOf(fakeFile("a", 1, "IMAGE/PNG"))).toBe("image");
  });

  it("maps application/pdf to pdf", () => {
    expect(kindOf(fakeFile("a.pdf", 1, "application/pdf"))).toBe("pdf");
  });

  it("falls back to file for other MIME", () => {
    expect(kindOf(fakeFile("a.txt", 1, "text/plain"))).toBe("file");
  });

  it("falls back to file when MIME is missing", () => {
    expect(kindOf(fakeFile("a", 1, ""))).toBe("file");
    expect(kindOf({ name: "a", size: 1 } as File)).toBe("file");
  });
});

describe("screenFiles", () => {
  it("returns nothing for an empty batch", () => {
    expect(screenFiles([])).toEqual({ accepted: [], errors: [] });
  });

  it("accepts a zero-byte file", () => {
    const file = fakeFile("empty.txt", 0, "text/plain");
    const result = screenFiles([file]);
    expect(result.accepted).toEqual([file]);
    expect(result.errors).toEqual([]);
  });

  it("accepts a file exactly at the 10MB limit", () => {
    const file = fakeFile("edge.bin", MAX_FILE_BYTES);
    const result = screenFiles([file]);
    expect(result.accepted).toEqual([file]);
    expect(result.errors).toEqual([]);
  });

  it("rejects a file one byte over 10MB with a readable error", () => {
    const file = unreadableFile("huge.bin", MAX_FILE_BYTES + 1);
    const result = screenFiles([file]);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("huge.bin");
    expect(result.errors[0]).toContain("10MB");
  });

  it("does not read the content of an oversized file", () => {
    const spy = vi.spyOn(FileReader.prototype, "readAsDataURL");
    const large = unreadableFile("big.bin", MAX_FILE_BYTES + 1);
    const small = fakeFile("ok.txt", 10, "text/plain");
    const result = screenFiles([large, small]);
    expect(result.accepted).toEqual([small]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps valid files when an oversized file is mixed in", () => {
    const large = fakeFile("big.bin", MAX_FILE_BYTES * 2);
    const a = fakeFile("a.txt", 1, "text/plain");
    const b = fakeFile("b.txt", 2, "text/plain");
    const result = screenFiles([large, a, b]);
    expect(result.accepted).toEqual([a, b]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("big.bin");
  });

  it("caps a batch at 10 files, reporting the 11th", () => {
    const files = Array.from({ length: 11 }, (_, i) => fakeFile(`f${i}.txt`, 1, "text/plain"));
    const result = screenFiles(files);
    expect(result.accepted).toHaveLength(MAX_BATCH);
    expect(result.accepted).toEqual(files.slice(0, MAX_BATCH));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("f10.txt");
  });

  it("counts existing attachments against the batch cap", () => {
    const files = Array.from({ length: 5 }, (_, i) => fakeFile(`f${i}.txt`, 1, "text/plain"));
    const result = screenFiles(files, 8);
    expect(result.accepted).toEqual(files.slice(0, 2));
    expect(result.errors).toHaveLength(3);
  });

  it("rejects everything when the cap is already reached", () => {
    const files = [fakeFile("a.txt", 1, "text/plain")];
    const result = screenFiles(files, MAX_BATCH);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});

describe("dedupe", () => {
  it("removes files with the same name, size and lastModified", () => {
    const first = fakeFile("a.txt", 10, "text/plain", 100);
    const same = fakeFile("a.txt", 10, "text/plain", 100);
    expect(dedupe([first, same])).toEqual([first]);
  });

  it("keeps files whose lastModified differs", () => {
    const a = fakeFile("a.txt", 10, "text/plain", 100);
    const b = fakeFile("a.txt", 10, "text/plain", 200);
    expect(dedupe([a, b])).toEqual([a, b]);
  });

  it("keeps genuinely different files", () => {
    const a = fakeFile("a.txt", 10, "text/plain", 100);
    const b = fakeFile("b.txt", 10, "text/plain", 100);
    const c = fakeFile("a.txt", 11, "text/plain", 100);
    expect(dedupe([a, b, c])).toEqual([a, b, c]);
  });

  it("returns an empty array for an empty input", () => {
    expect(dedupe([])).toEqual([]);
  });
});

describe("readAsDataUrl", () => {
  it("resolves through FileReader.readAsDataURL (async API)", async () => {
    const spy = vi.spyOn(FileReader.prototype, "readAsDataURL");
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const dataUrl = await readAsDataUrl(file);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(dataUrl.startsWith("data:")).toBe(true);
    expect(dataUrl).toContain("base64");
  });

  it("rejects using FileReader without synchronous btoa", async () => {
    const btoaSpy = vi.fn();
    vi.stubGlobal("btoa", btoaSpy);
    const file = new File([new Uint8Array([1, 2, 3])], "x.bin", { type: "application/octet-stream" });
    await readAsDataUrl(file);
    expect(btoaSpy).not.toHaveBeenCalled();
  });
});

describe("createPendingAttachment", () => {
  it("carries kind, name and size", () => {
    const file = fakeFile("doc.pdf", 42, "application/pdf");
    const attachment = createPendingAttachment(file);
    expect(attachment.kind).toBe("pdf");
    expect(attachment.name).toBe("doc.pdf");
    expect(attachment.size).toBe(42);
    expect(attachment.file).toBe(file);
    expect(attachment.previewUrl).toBeUndefined();
  });

  it("creates a previewUrl for images when createObjectURL is available", () => {
    const createObjectURL = vi.fn(() => "blob:preview-1");
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    const attachment = createPendingAttachment(fakeFile("pic.png", 1, "image/png"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(attachment.previewUrl).toBe("blob:preview-1");
  });

  it("skips previewUrl for non-images", () => {
    const createObjectURL = vi.fn(() => "blob:preview-1");
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    expect(createPendingAttachment(fakeFile("a.txt", 1, "text/plain")).previewUrl).toBeUndefined();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("generates unique ids", () => {
    const ids = new Set(
      Array.from({ length: 5 }, () => createPendingAttachment(fakeFile("a.txt", 1, "text/plain")).id),
    );
    expect(ids.size).toBe(5);
  });
});
