import { ApiError } from "../http/errors";

export const MAX_AVATAR_BYTES = 256 * 1024;

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/;

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export interface ParsedAvatar {
  dataUrl: string;
  mime: string;
  bytes: number;
}

export function parseAvatarDataUrl(input: string): ParsedAvatar {
  const match = DATA_URL_PATTERN.exec(input);
  if (!match) {
    throw new ApiError(400, "INVALID_AVATAR", "仅支持 PNG/JPEG 的 base64 data URL");
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) {
    throw new ApiError(400, "INVALID_AVATAR", "头像数据为空");
  }
  if (buffer.length > MAX_AVATAR_BYTES) {
    throw new ApiError(400, "AVATAR_TOO_LARGE", "头像不能超过 256KB");
  }

  const valid = mime === "image/png" ? isPng(buffer) : isJpeg(buffer);
  if (!valid) {
    throw new ApiError(400, "INVALID_AVATAR", "头像文件内容与声明类型不符");
  }

  return { dataUrl: input, mime, bytes: buffer.length };
}
