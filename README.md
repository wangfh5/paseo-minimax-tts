# Paseo MiniMax TTS

[简体中文](README.zh-CN.md)

A small [Paseo](https://paseo.sh) plugin that reads the final reply of each agent turn aloud with [MiniMax](https://www.minimax.io) text-to-speech. A compact player row appears under every completed reply in the chat. This is an early version and not a replacement for Paseo's built-in voice mode.

Unofficial: this project is not affiliated with MiniMax or Paseo.

## Features

- **Global now-playing control.** While audio is loaded and not finished, a row appears at the bottom of the sidebar with the chat's title and buttons to pause or resume and to stop. Clicking the row opens the chat that owns the audio so you can use its progress bar (it opens the chat, it cannot scroll to the exact reply). Stop ends the current audio and discards any queued auto-play replies, so you can always silence playback from any page. Archiving or deleting a chat also stops its audio and drops its queued replies.
- **Inline player in the chat.** After each turn, a row under the final reply lets you synthesize, play, pause, drag the progress bar to seek, and cancel synthesis.
- **Settings page** for the API key, China or global region, model and voice.
- **Automatic speech, three modes, off by default.** `Off` speaks only when you press Play. `Synthesize` makes the daemon generate speech as soon as a reply completes and cache it, so Play is instant. `Play` also plays it automatically. Set a global default, or override it for a single chat with the **Auto** control in that chat's player row.
- **Row status:** `Read aloud` (synthesized when you press Play), `Synthesizing…`, `Ready` (cached, plays instantly) or `Expired` (the reply is no longer in memory and cannot be played again).
- **Any length.** Long replies are split at paragraph and sentence boundaries, synthesized part by part and joined into one file. Finished parts are cached, so a retry after a failure only pays for the remaining parts.
- **Disk cache with a size limit** that you set and can clear from the settings page.
- Only the last assistant message after a successful turn is read. Tool calls, reasoning and intermediate assistant messages are never joined into it.

## Requirements and installation

- Paseo 0.11.4 or newer. It was developed and verified on 0.11.4, in the web app.
- Desktop and web use browser audio. Native iOS and Android playback is not supported yet.
- A MiniMax API key. Synthesis is billed to your MiniMax account.

Plugins are trusted, unsandboxed code. Review the source and make sure plugins are enabled on your daemon, then:

```sh
paseo plugin install github:wangfh5/paseo-minimax-tts
paseo plugin ls
```

Update with `paseo plugin update paseo-minimax-tts`. To work on a local checkout instead:

```sh
npm ci
npm run typecheck
npm test
paseo plugin install /absolute/path/to/paseo-minimax-tts
```

After editing the source, run `paseo plugin reload paseo-minimax-tts`. There is no need to restart the daemon.

## Usage

1. Open **Settings → Plugins** in Paseo, click the **…** menu of paseo-minimax-tts and choose **Settings**. You can also search **MiniMax speech settings** in the command palette (⌘K).
2. Enter your API key, pick the region that matches the key, and click **Save**.
3. Finish a new agent turn and press **Play** in the player row under the reply.
4. If the browser blocks autoplay, press **Play** again.
5. For automatic speech, choose `Synthesize` or `Play` under **Automatic speech** and save. To change it for one chat only, use **Auto** in that chat's player row. A chat setting applies to replies that finish afterwards, and chats you have not set follow the global default. Region, model and voice are under **Advanced**.

Defaults: model `speech-2.8-hd`, voice `Chinese (Mandarin)_Warm_Girl`, region `cn`. You provide the key. Keys for China subscriptions and pay-as-you-go accounts have different quotas, so use the key that matches your account and region.

## Privacy and storage

- Only the daemon talks to MiniMax. The text of the selected reply is sent to the API of the chosen region and uses your account quota.
- The key and settings are stored in `~/.paseo-minimax-tts/settings.json` of the daemon user (directory `0700`, file `0600`). This is plain text protected by file permissions, not an encrypted vault. On Windows these permissions are not enforced.
- The settings RPC only reports whether a key exists and never returns it. Leaving the key field empty keeps the old key, and you can delete it.
- The text of the latest 20 replies is kept only in daemon memory and is cleared on reload or restart.
- Generated audio is cached as plain MP3 files in `~/.paseo-minimax-tts/audio/` (directory `0700`, files `0600`, named by hash). A reply you have already synthesized plays again without being billed again, also after a plugin reload because its player row stays in the chat. A daemon restart clears the player rows and the reply list, so older cached audio can no longer be reached from the chat and simply ages out of the cache. The total size limit defaults to 512 MB and is set under **Audio cache** in the settings page, which also shows current usage and can clear the cache. The least recently used files are removed first, and lowering the limit takes effect immediately. The limit is a hard cap, so a single recording larger than the limit is not cached and must be synthesized again to replay. The cache key includes the model and voice, so changing the voice generates new audio. Delete the directory if you no longer want it. If a reply's text is gone from memory and its audio has been evicted, it cannot be synthesized again.
- Do not commit keys, settings, generated audio or `node_modules`.

## Limitations

- The player row is a separate plugin timeline row under the reply, not part of the message bubble. It lives in the daemon's in-memory timeline and disappears when the daemon restarts. There is a single shared audio, so only one reply plays at a time.
- The Paseo SDK has no final or channel marker. The plugin uses a conservative rule: the turn succeeded and the last meaningful message is assistant text. If a final answer is sent as several messages only the last one is read, and a closing comment cannot be told apart from a final answer.
- The global automatic speech mode is a daemon-wide setting, not per device. Per-chat overrides are stored per agent in the same settings file, and the control appears once a chat has its first reply. `Synthesize` and `Play` generate and bill speech in the daemon even if no client is listening. Several clients may play at the same time.
- Automatic playback runs while the Paseo app is open with the plugin loaded. New auto-play replies are queued in the order they finish and play one after another. A paused reply holds the queue, a failed one does not, and the initial snapshot after a reconnect is never played. The queue lives in client memory.
- Browser autoplay policy, background suspension or closing the app can prevent playback.
- There is no length limit. Replies over 2,000 characters are split into several MiniMax requests (MiniMax accepts under 10,000 characters per request), so cost grows with length and automatic modes will not refuse a very long reply. Each request times out after 60 seconds and synthesis can be canceled at any time.
- Tested only on Paseo 0.11.4 in the web app, on macOS, against the China region. Requests to the global region are covered by mocked tests only.
- `npm audit` reports upstream warnings. They come from the development toolchain of `react-native`; the plugin ships no runtime dependencies.

## Development

```sh
npm run typecheck
npm test
# Read-only RPC check against a local daemon: no key is printed and no audio is synthesized
npx tsx server/rpc-check.ts ws://127.0.0.1:6767/ws
# Triggers paid synthesis of the latest reply, so finish a new agent turn first
npx tsx server/rpc-check.ts ws://127.0.0.1:6767/ws --synthesize-latest
```

The tests cover final message selection, settings storage and migration, mocked MiniMax requests, text splitting and MP3 joining, the disk cache (limits, eviction, concurrency), the auto-play queue, player state and seeking, and native isolation. The synthesis command above does not play any sound, but warn people before you test playback so other connected devices do not start speaking unexpectedly.

Layout: `client/` is the UI and player, `server/` holds credential storage, reply selection, the cache and MiniMax requests, and `shared/` has the RPC contracts. `OVERVIEW.md` is the plugin page shown inside Paseo.

## License

[MIT](LICENSE)
