# pi-dotfiles

[`pi`](https://github.com/badlogic/pi-mono) 的可公开、可恢复个人配置。仓库只保存经过白名单筛选的设置，不保存认证、会话、缓存或自动生成的集成文件。

## 包含内容

- `pi/settings.json`：模型、思考等级、主题、启动显示和扩展来源
- `pi/pi-startup-header.json`：启动 Logo 的 Everforest 配色
- `pi/themes/omarchy-system.json`：Omarchy/Everforest 风格主题
- `pi/extensions/omarchy-system-theme.ts`：跟随 Omarchy 深浅模式
- `skills/external-skills.json`：外部 skill 的来源与内容哈希
- `scripts/install.sh`：安全合并至本机 Pi 配置

## 安装

需要 `bash`、`jq` 和已经安装好的 `pi`：

```bash
git clone https://github.com/woshahua/pi-dotfiles.git
cd pi-dotfiles
./scripts/install.sh
pi update
```

安装脚本只会写入以下白名单文件：

- `settings.json`
- `pi-startup-header.json`
- `themes/omarchy-system.json`
- `extensions/omarchy-system-theme.ts`

现有文件会先备份至 `~/.local/state/pi-dotfiles/backups/`。`settings.json` 会进行对象合并，因此不会删除本机未纳入仓库的顶层设置；仓库内同名字段优先。

## 有意排除

以下内容不得进入公开仓库：

- `auth.json` 和任何 API Key、Token、Cookie
- `sessions/`、模型缓存和下载缓存
- `npm/node_modules/`、`git/` 与其他第三方依赖源码
- `herdr`、`orca` 等运行时自动生成的集成扩展
- 来源或再分发许可不明确的 skills

第三方 Pi 扩展由 `pi/settings.json` 记录来源，并由 Pi 自己安装。Omarchy 系统 skills 继续由系统管理。

## 更新配置

修改仓库中的文件后运行安装脚本。若要从本机回写，务必逐个文件审查并只复制上述白名单内容；不要直接复制整个 `~/.pi/agent`。
