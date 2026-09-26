import { config } from "../config";
import { openDb } from "../db";
import { migrate } from "../db/migrate";
import { ensureFirstAdmin } from "../users/repo";

const db = openDb(config.dbPath);
const version = migrate(db);
console.log(`已应用迁移，当前数据库版本：${version}`);

const result = await ensureFirstAdmin(db);
if (result.created) {
  console.log(`已创建 super_admin "${result.username}"`);
  if (result.generatedPassword) {
    console.log(`初始密码（仅显示一次，请立即修改）：${result.generatedPassword}`);
  } else {
    console.log("初始密码取自 OS_ADMIN_PASSWORD 环境变量。");
  }
} else {
  console.log("已存在用户，跳过");
}

db.close();
