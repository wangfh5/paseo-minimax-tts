MiniMax speech reads the last assistant message after a successful live turn completes. A player row appears under each completed reply in the chat: play, pause, and drag the progress bar to seek. Open MiniMax speech in the sidebar or Settings to configure credentials.

Requires Paseo 0.11.4 or newer. Desktop and web have seekable playback. Native iOS/Android playback is disabled because the public plugin audio API offers no seek control. Browser autoplay may require pressing Play.

The API key is sent to the daemon and stored in ~/.paseo-minimax-tts/settings.json (0600, directory 0700), never returned by a settings RPC. Model, voice, China/global region and Always On are editable. Defaults are speech-2.8-hd, Chinese (Mandarin)_Warm_Girl, China, and Always On off. Selected reply text is sent to MiniMax and billed to your account.

Always On watches new completed replies while the sidebar contribution is mounted. It plays only the newest reply per poll, never initial history or a reconnect snapshot. Each connected client can play independently. The last 20 live replies and three audio files are retained in daemon memory, not across restart. Replies over 8000 characters are refused rather than truncated. Requests time out after 60 seconds and can be canceled.

SDK 0.11.4 has no final/channel marker on assistant messages. This plugin selects only the last assistant item after the latest user message on a completed lifecycle event; it never joins earlier assistant updates, reasoning, or tools. Providers that split a final response across messages yield only the last part. A provider that ends successfully with commentary indistinguishable from a final message cannot be classified perfectly by this SDK.
