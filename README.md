# pi-dotfiles

[`pi`](https://github.com/earendil-works/pi) 的可公开、可恢复个人配置。仓库只保存经过白名单筛选的设置，不保存认证、会话、缓存或自动生成的集成文件。

## 包含内容

- `pi/settings.json`：模型、思考等级、主题、启动显示和扩展来源
- `pi/pi-startup-header.json`：启动 Logo 的 Everforest 配色
- `pi/themes/omarchy-system.json`：Omarchy/Everforest 风格主题
- `pi/extensions/omarchy-system-theme.ts`：跟随 Omarchy 深浅模式
- `pi/extensions/pi-splash/`：可选的 woshahua 点阵文字开场动画（无外框）
- `pi/extensions/candy-ui/`：Candy 风格输入栏、模型列表动画、控制面板与状态栏
- `bin/pi`、`shell/pi.bash`：mise 安装的 Pi 自更新入口
- `skills/external-skills.json`：外部 skill 的来源与内容哈希
- `scripts/install.sh`：安全合并至本机 Pi 配置

## 安装

安装脚本适用于 Linux。需要 `git`、`bash`、`jq` 和已经安装好的 `pi`；动画扩展已在 Pi 0.87.1 验证：

```bash
git clone https://github.com/woshahua/pi-dotfiles.git
cd pi-dotfiles
./scripts/install.sh
pi update --extensions
```

要安装当前使用的点阵 Logo 和 Candy 界面，再执行：

```bash
./scripts/install-splash.sh
./scripts/install-candy-ui.sh
pi
```

进入 Pi 后用 `/login` 配置账号、`/model` 选择可用模型。认证信息需要在每台机器单独配置。
通过 mise 安装 Pi 时，再按下方的自更新说明安装命令入口。

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

2026-10-01 的[扩展检查记录](docs/plugin-audit-2026-10-01.md)列出更新日期、功能重叠和清理结果。
配置不再声明旧 npm Pi 核心、旧启动 Header、未使用的终端主题包，以及不需要的 Ponytail 和 pi-simplify。
Git 扩展只从 Pi 管理的 `git/` 目录加载；不要将同一仓库再次克隆到 `extensions/`。
Pi 0.87.1 的包筛选路径不加 `./` 前缀，否则配置可能不会启用对应入口。

## 更新配置

修改仓库中的文件后运行安装脚本。若要从本机回写，务必逐个文件审查并只复制上述白名单内容；不要直接复制整个 `~/.pi/agent`。

## 可选开场动画

仅安装动画扩展，不改动模型、主题和其他插件：

```bash
./scripts/install-splash.sh
```

安装脚本备份 `settings.json` 和已有的同名扩展。如果配置仍声明 `pi-startup-header`，
只停用其扩展入口；新安装无需此包，配色文件继续使用。重启 `pi` 后，新建的空会话显示约 1.2 秒的
woshahua 点阵文字显现与扫光，不绘制外框；结束后停止刷新。恢复历史会话及 `/reload`
只显示静态画面。RPC 和非交互模式不创建组件。宽度不足 32 列时显示紧凑文字。

图标保留 SVG 的 9 色粉蓝调色板，署名沿用当前主题及
`pi-startup-header.json` 的 `general` 中三个六位十六进制颜色；
其他值回退到当前 Pi 主题。设置 `PI_SPLASH_ANIMATION=0` 或 `NO_COLOR=1`
可关闭动画，后者也关闭 Header 的颜色。

```bash
PI_SPLASH_ANIMATION=0 pi
node tests/pi-splash.test.ts
python3 tests/verify-splash.py
```

恢复旧 Header：将 `extensions/pi-splash` 移出 Pi 的扩展目录，运行
`pi install npm:pi-startup-header`。如果配置保留了此包的对象条目，将其恢复为
`"npm:pi-startup-header"` 字符串或移除 `extensions: []`。不要覆盖此后修改过的整个设置文件。

此扩展使用 Pi 的 `session_start` 和 `ctx.ui.setHeader()`，不修改 Pi 核心。
动画设计参考 Candy 的字符显隐与定时刷新思路。当前图标来自
`assets/woshahua-wordmark-dot.svg`，没有光环和外框。构建脚本直接读取 SVG 中的
点阵路径，去除透明外边距，保留原始颜色和像素，生成 100 × 32 的终端点阵数据。
终端用前景色、背景色和半格字符显示上下两个像素，运行时无需图片解码库。
图标按窗口宽高缩小，最大保持原始点阵大小。荷兰猪素材保留在 `assets/` 供回溯。

重新生成点阵数据只需要 Node.js：

```bash
node scripts/generate-splash-sprite.mjs
```

## Candy 风格控制面板与状态栏

```bash
./scripts/install-candy-ui.sh
```

重启 Pi 后使用 `Alt+M` 或 `/candy` 打开无外框面板。`Tab` 切换 Model、Thinking、Display；
方向键选择，`Enter` 应用，`Escape` 返回。模型页支持搜索和能力预览，只显示可用且符合
当前模型范围的条目；思考等级按当前模型能力筛选。选择仅作用于当前会话，不修改默认模型。
Display 控制工具输出的折叠或展开，沿用现有 `pi-tool-display` 的渲染。

`/model` 和 `Ctrl+L` 打开的原生模型列表也有动画：边框约 800 ms 展开，再逐行显现内容；
取消时约 560 ms 收拢。保留 Pi 的原生搜索、模型范围切换、目录刷新、默认模型保存，
以及 `/model <provider/model-id>` 的精确选择。确认选择即时应用，避免等待动画时目录刷新改变选中模型。
动画装饰 Pi 公开导出的 `ModelSelectorComponent`，不替换命令处理或模型注册表。

状态栏显示模型、思考等级、上下文占用、输入输出 token、费用、目录、Git 分支和运行状态，
保留其他扩展的状态信息。粉、紫、青色参考 Candy，并适配内置浅色主题及 `NO_COLOR`。
计时只在运行时刷新，结束或卸载后清理；多工具并行时不会在第一个工具完成后提前显示空闲。

输入栏使用圆角边框：开场约 520 ms 从底部向两侧展开，工作时显示沿边框移动的流光，
切换 Chat、Shell、Command 时渐变换色，切换思考等级时播放一次脉冲。
空闲时停止连续刷新。`PI_CANDY_ANIMATIONS=0 pi` 保留静态样式；`NO_COLOR=1` 同时关闭颜色和动画。
Logo 和 `/candy` 控制面板仍无外框；`/model` 列表使用粉紫渐变边框。

安装脚本只安装 `candy-ui` 目录，不修改 `settings.json`。输入栏包装当前编辑器工厂，
装饰其创建实例的渲染，保留原样粘贴闭包、输入事件、光标、自动补全和已有快捷键。
左右边框占用编辑器自身的内边距，不移动内容或自动补全行。取消面板、无搜索结果或应用失败不会改掉草稿。
`/candy off` 在当前会话恢复之前的编辑器、原生模型列表和 Pi 默认状态栏，`/candy on` 重新启用。
彻底停用时，将 `~/.pi/agent/extensions/candy-ui` 移出扩展目录后重启。

```bash
node tests/candy-state.test.ts
node tests/candy-motion.test.ts
node tests/candy-panel-motion.test.ts
python3 tests/verify-candy-ui.py
```

终端测试使用隔离配置和本地假模型，不向模型服务发送请求。它验证中文输入、草稿保留、
模型和思考等级切换、工具输出开关、窗口缩放及现有 Logo、原样粘贴扩展的共同加载。
动画测试覆盖开场、模式切换、工作流光、空闲停刷、销毁与减弱动态效果；终端测试额外覆盖
中文宽度和光标、长文本分段原样粘贴，以及关闭再开启界面后的原样粘贴。
模型列表动画测试覆盖展开、逐行显现、取消收拢、开场中取消、空闲停刷及销毁清理；
真实终端额外验证 `/model` 与 `Ctrl+L`、原生搜索、精确模型参数、默认模型保存、缩放和关闭再开启。

## mise 安装的 Pi 自更新

mise 安装的 Bun 独立二进制不能通过 Pi 内部的包管理器自更新。安装命令入口适配：

```bash
./scripts/install-launcher.sh
source ~/.config/bash/pi.bash
pi update
```

安装脚本备份后更新 `~/.local/bin/pi`，安装 `~/.config/bash/pi.bash`，并在
`~/.bashrc` 末尾追加加载语句。Bash 函数保证 mise 激活后仍使用该入口。
旧终端需执行上述 `source` 一次，新终端自动生效。

- `pi update`、`pi update --self`：通过 `mise upgrade --no-prune pi` 更新全局 Pi，保留旧版。
- `pi update --all`：先更新主程序，再由 Pi 更新扩展。
- `pi update --force`：通过 mise 强制重新安装主程序。
- 扩展、单个包、模型目录更新及其他命令原样交给 Pi。

入口不修改 Pi 的认证、会话或扩展配置。自动化脚本若绕过 Bash 函数，可显式调用
`~/.local/bin/pi update`；直接调用 mise 安装目录里的二进制仍受其原生自更新限制。

```bash
python3 tests/pi-launcher.test.py
```
