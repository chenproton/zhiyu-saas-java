#!/bin/bash
#
# deploydemo.sh - 演示环境部署（兼容旧脚本名，实际调用 deploy.sh）
#
# 用法：同 ./deploy.sh [参数]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/deploy.sh" "$@"
