MiniMax speech reads an agent's final reply aloud with MiniMax text-to-speech. A player row under each completed reply lets you play, pause, and seek. While audio is loaded, the bottom of the sidebar shows which chat it belongs to, with pause and stop buttons.

Setup needs a MiniMax API key; speech is billed to your MiniMax account. Open this plugin's settings from Settings, then Plugins, enter the key, and pick the China or global region that matches it. Model, voice, and the audio cache size are also set there.

Automatic speech is off by default. **Synthesize** generates audio as soon as a reply finishes, so Play starts instantly, and is billed even if you never listen. **Play** also plays new replies in order while Paseo is open. Set a default in settings, or change it for one chat from the Auto control in its player row.

Only the daemon talks to MiniMax, sending the reply's text. The key is stored in `~/.paseo-minimax-tts/settings.json`, readable only by your user and never sent back to the app. Generated audio is cached in `~/.paseo-minimax-tts/audio` (512 MB by default), so replaying a reply is not billed again.

Playback works on desktop and web, not in the native iOS or Android apps. Player rows live in daemon memory and disappear when the daemon restarts. If an agent splits its answer into several messages, only the last one is read.
