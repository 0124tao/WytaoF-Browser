# WytaoF Browser

> 个人自用本地指纹浏览器环境管理工具，支持 Windows / Linux / macOS。

<img src="images/readme/001-首页.png" alt="控制台" width="100%" />

## 核心特性

- **实例隔离** — 每个账号独立浏览器环境，互不干扰
- **代理池** — 统一管理代理节点，支持 HTTP / SOCKS5 / 链式代理 / Clash 导入
- **内核管理** — 多版本 Chrome 指纹内核，应用内下载或手动导入
- **Launch API** — 本地 HTTP 接口，支持外部系统调用（创建/启动/停止/CDP 连接）
- **自动化脚本** — 内置脚本引擎，支持按实例运行自定义自动化任务
- **快捷操作** — `Ctrl+K` 全局搜索，按 Code / 名称 / 标签秒开实例
- **跨平台** — Windows 安装版/便携版、Linux deb/tar.gz、macOS unsigned app

## 技术栈

Go 1.22+ · Wails v2 · Vue 3 + Vite · SQLite · xray/sing-box 代理桥接

## 快速开始

### 安装版

1. 在 Releases 或 `publish/output/` 获取安装包
2. Windows: 运行 `WytaoFBrowser-Setup-*.exe`
3. Linux: `sudo dpkg -i wytaof-browser_*.deb` 或解压 tar.gz
4. macOS: 解压后运行 `.app`（如被拦截执行 `xattr -dr com.apple.quarantine <app路径>`）

### 从源码开发

```bash
# 依赖：Go 1.22+, Node.js 18+, Wails CLI v2
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails doctor  # 检查环境

# Windows
bat\dev.bat

# Linux / macOS
bash dev.sh
```

首次启动自动初始化 `config.yaml`（含随机 Launch API Key）和 `data/app.db`。

### 准备内核

应用内 `内核管理` 页面支持在线下载，或手动放入 `chrome/Chrom-XXX/chrome.exe`。

推荐内核来源：[fingerprint-chromium](https://github.com/adryfish/fingerprint-chromium/releases)

## Launch API

启动后默认监听 `127.0.0.1:19876`，认证 header: `X-Ant-Api-Key`。

```bash
# 健康检查
curl -H "X-Ant-Api-Key: <key>" http://127.0.0.1:19876/api/health

# 列出实例
curl -H "X-Ant-Api-Key: <key>" http://127.0.0.1:19876/api/profiles

# 启动实例
curl -X POST -H "X-Ant-Api-Key: <key>" -H "Content-Type: application/json" \
  -d '{"profileId": "<id>"}' http://127.0.0.1:19876/api/launch
```

完整接口参考 `backend/internal/launchcode/server_http.go`。

## 常见问题

| 问题 | 解决 |
|------|------|
| 应用无法启动 | 检查内核路径下是否有 `chrome.exe` |
| 代理未生效 | 确认代理节点可用 + 实例已绑定代理，启动后访问 IP 检测站验证 |
| 快速找实例 | `Ctrl+K` 按 Code/名称/标签搜索 |
| 避免串号 | 一账号一实例、一实例一代理，不混用环境 |

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## License

MIT
