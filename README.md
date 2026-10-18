# Paseo MiniMax TTS

一个极简 Paseo 插件：将 Agent 一轮结束后的最后一条助手回复交给 MiniMax 合成，在独立侧栏面板中播放。当前是可用原型，不是内置 Voice Mode 的替代品。

## 功能

- 手动合成和播放、暂停/继续、拖动进度条定位、取消合成。
- 设置页配置 API key、国内/国际区域、模型与音色。
- 可选 Always On，默认关闭。
- 仅在成功完成的轮次中选择最后一条助手消息，不拼接工具调用、思考过程或中间助手消息。

## 要求与安装

开发与 daemon 验证版本为 Paseo 0.11.4。桌面/web 使用浏览器音频实现；网页端已实际验证。原生 iOS/Android 播放暂不支持。

插件是可信、非沙箱代码。先审查源码，并在目标 daemon 中允许插件，然后：

```sh
npm ci
npm run typecheck
npm test
paseo plugin install /absolute/path/to/paseo-minimax-tts
paseo plugin ls
```

源码更新后运行 `paseo plugin reload paseo-minimax-tts`，不需要重启 daemon。

## 使用

1. 在连接目标 daemon 的 Paseo 侧栏打开 **MiniMax speech**。
2. 在设置页填写密钥，选择与密钥匹配的区域，点击 **Save**。
3. 完成一轮新的 Agent 对话，在页面底部的回复列表点击 **Play**。
4. 播放控件位于页面上方。浏览器若阻止自动播放，点击 **Play**。
5. 需要自动朗读时启用 **Always On** 并保存；区域、模型、音色收在 **Advanced** 中；不需要时关闭并保存。

默认模型为 `speech-2.8-hd`，音色为 `Chinese (Mandarin)_Warm_Girl`，区域为 `cn`。密钥由用户提供；不会自动读取 Hermes 凭据。国内订阅密钥与按量付费密钥的额度不同，请使用与账户及接口匹配的密钥。

## 隐私与存储

- MiniMax 请求只由 daemon 发起，选中的回复文本会发送到对应区域的 MiniMax API，消耗该账户额度。
- 密钥与设置存于 daemon 用户的 `~/.paseo-minimax-tts/settings.json`，目录权限 `0700`、文件权限 `0600`；这是受文件权限保护的明文存储，不是加密保险库。
- 设置读取 RPC 只返回是否已有密钥，不返回密钥内容。输入框留空会保留旧密钥，也可删除密钥。
- 密钥、设置、生成的音频和 node_modules 不应提交 Git。
- 最近 20 条回复及最多三份合成缓存仅在 daemon 内存中保存，重载/重启即清空。

## 当前限制

- 播放器是独立面板，不嵌入每条聊天消息。
- Paseo SDK 没有统一 final/channel 标记；采取“成功结束且最后的有效消息是助手文本”的保守规则。分多条发送的最终答案只读最后一条，不能区分语义上类似最终答案的结束评论。
- Always On 是 daemon 共享设置，覆盖其 Agent，不是按会话或设备设置。多个客户端可能同时发声。
- 自动播放依赖侧栏贡献组件保持加载。每次轮询只播放最新的新回复，没有完整播放队列；初始/重连快照不补播。
- 浏览器自动播放策略、后台挂起或关闭 App 可能阻止播放。
- 超过 8,000 字符拒绝合成，不静默截断；请求超时为 60 秒。
- 依赖审计仍有上游告警；尚未进行破坏性依赖升级或完整安全审计。

## 开发与验证

```sh
npm run typecheck
npm test
# 本机只读 RPC 检查，无密钥回显，不合成音频
npx tsx server/rpc-check.ts ws://127.0.0.1:6767/ws
# 明确触发付费合成：需要已经完成一轮新回复
npx tsx server/rpc-check.ts ws://127.0.0.1:6767/ws --synthesize-latest
```

测试覆盖最终消息选择、存储权限、模拟 MiniMax 响应、输入限制、真实媒体 currentTime 接线以及原生端隔离。上述 RPC 合成命令本身不播放声音。做 UI 播放测试前应提醒使用者，避免其他已连接设备突然出声。

目录：`client/` 为 UI 与播放器，`server/` 为凭据存储、筛选及 MiniMax 请求，`shared/` 为 RPC 契约。`OVERVIEW.md` 为 Paseo 内插件说明。
