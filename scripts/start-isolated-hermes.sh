#!/usr/bin/env bash
#
# 启动一个**隔离**的 `hermes serve`：全新临时 HERMES_HOME，绝不触碰 ~/.hermes。
# 用于本地/CI 冒烟，或给 BFF 提供一个干净的上游。
#
# 用法：
#   scripts/start-isolated-hermes.sh [port]
#
# 环境变量：
#   OS_SMOKE_HERMES_CLI   hermes CLI 路径（默认 hermes）
#   OS_SMOKE_HERMES_PORT  监听端口（默认 9119，可被第一个位置参数覆盖）
#   HERMES_HOME           透传给 hermes 的主目录（默认自动 mktemp）
#
# 退出/中断时自动删除临时 HERMES_HOME。
set -euo pipefail

PORT="${1:-${OS_SMOKE_HERMES_PORT:-9119}}"
CLI="${OS_SMOKE_HERMES_CLI:-hermes}"

if [[ -n "${HERMES_HOME:-}" ]]; then
  HOME_DIR="$HERMES_HOME"
else
  HOME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/24h-hermes-home.XXXXXX")"
fi

cleanup() {
  if [[ -z "${HERMES_HOME:-}" && -n "${HOME_DIR:-}" ]]; then
    rm -rf "$HOME_DIR"
  fi
}
trap cleanup EXIT INT TERM

echo "HERMES_HOME=$HOME_DIR"
echo "exec: $CLI serve --host 127.0.0.1 --port $PORT"
echo "(loopback only；BFF 需以 HERMES_BASE_URL=http://127.0.0.1:$PORT 指向本实例)"

exec env HERMES_HOME="$HOME_DIR" "$CLI" serve --host 127.0.0.1 --port "$PORT"
