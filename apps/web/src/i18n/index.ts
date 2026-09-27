import { zh, type TranslationKey } from "./zh";

export { zh };
export type { TranslationKey };

export type TranslationVars = Record<string, string | number>;

/** 把 `{{name}}` 占位符替换为变量值；缺省变量保留原样。 */
export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * 极简 i18n：从 `zh` 字典取文案，可选 `{{name}}` 插值。
 * 类型约束 key 必须存在（新增文案先加字典），保持全中文收口。
 */
export function t(key: TranslationKey, vars?: TranslationVars): string {
  return interpolate(zh[key], vars);
}
