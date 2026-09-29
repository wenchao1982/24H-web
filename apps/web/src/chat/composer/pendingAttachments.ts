/**
 * 待发送附件的前端纯逻辑层（TASK-005 / REQ-005 / REQ-007）。
 *
 * 硬约束：
 * - `screenFiles` **不得读取文件内容**（只读 name/size/type），在生成 chip 之前完成校验；
 * - 10MB 上限与单批 10 个上限均在此层拦截，超限逐项报错且不影响合法项；
 * - base64 编码只经异步 `FileReader.readAsDataURL`，禁止主线程同步 `btoa` 循环。
 */

export type AttachmentKind = "image" | "file" | "pdf";

export interface PendingAttachment {
  id: string;
  kind: AttachmentKind;
  file: File;
  name: string;
  size: number;
  /** 仅 image 且环境支持时创建；由调用方负责 revoke。 */
  previewUrl?: string;
}

/** 单文件上限 10MB。 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 单批（含已暂存）上限 10 个。 */
export const MAX_BATCH = 10;

/** 人类可读的上限文案（测试与错误信息共用，避免漂移）。 */
export const MAX_FILE_LABEL = "10MB";

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `att-${sequence}-${Math.random().toString(36).slice(2, 8)}`;
}

function displayName(file: File): string {
  const name = typeof file.name === "string" ? file.name.trim() : "";
  return name !== "" ? name : "未命名文件";
}

/** `image/*` → image；`application/pdf` → pdf；其余 → file（含缺失 MIME）。 */
export function kindOf(file: File): AttachmentKind {
  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  if (type.startsWith("image/")) {
    return "image";
  }
  if (type === "application/pdf") {
    return "pdf";
  }
  return "file";
}

/**
 * 在读取内容之前按 size / 批量上限筛选文件。
 *
 * @param files         用户一次选择 / 拖拽 / 粘贴得到的文件
 * @param existingCount 已在 chip 中的数量（批量上限含此数）
 * @returns `accepted` 为可入 chip 的文件；`errors` 为逐项可读错误（不影响合法项）
 */
export function screenFiles(
  files: File[],
  existingCount = 0,
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];
  const already = Number.isFinite(existingCount) ? Math.max(0, Math.floor(existingCount)) : 0;
  const remaining = Math.max(0, MAX_BATCH - already);

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${displayName(file)} 超过 ${MAX_FILE_LABEL} 上限，已跳过`);
      continue;
    }
    if (accepted.length >= remaining) {
      errors.push(`${displayName(file)} 超出单批 ${MAX_BATCH} 个上限，已跳过`);
      continue;
    }
    accepted.push(file);
  }

  return { accepted, errors };
}

/** 按 `name + size + lastModified` 去重，保留首次出现的文件。 */
export function dedupe(files: File[]): File[] {
  const seen = new Set<string>();
  const result: File[] = [];
  for (const file of files) {
    const key = `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(file);
  }
  return result;
}

/**
 * 以异步 `FileReader.readAsDataURL` 产出 data URL（base64）。
 * 禁止使用同步 `btoa(String.fromCharCode(...))`，避免阻塞主线程。
 */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("当前环境不支持 FileReader"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("读取文件内容失败"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("读取文件内容失败"));
    };
    reader.readAsDataURL(file);
  });
}

/** 由 File 生成待发送 chip；仅 image 且环境支持时创建 previewUrl。 */
export function createPendingAttachment(file: File): PendingAttachment {
  const kind = kindOf(file);
  const attachment: PendingAttachment = {
    id: nextId(),
    kind,
    file,
    name: file.name,
    size: file.size,
  };
  if (kind === "image" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    attachment.previewUrl = URL.createObjectURL(file);
  }
  return attachment;
}
