import test from "node:test";
import assert from "node:assert/strict";
import { prepareSpeechText, shortenPath } from "./clean";
import { renderSpeech, speechParts } from "./minimax";

test("shortenPath collapses deep Unix, home, relative, and Windows paths while preserving short tokens", () => {
  assert.equal(shortenPath("/home/wangfh/.t3/worktrees/submatrixLRpaper/rebuttal-r1-6-bg-suppressed"), "rebuttal-r1-6-bg-suppressed");
  assert.equal(shortenPath("/home/wangfh/Sync/infra/paseo-plugins/paseo-minimax-tts/server/minimax.ts"), "minimax.ts");
  assert.equal(shortenPath("/home/wangfh/Sync/infra/paseo-plugins/paseo-minimax-tts/package.json"), "paseo-minimax-tts/package.json");
  assert.equal(shortenPath("/home/wangfh/.agents/skills/paseo-plugin/SKILL.md"), "paseo-plugin/SKILL.md");
  assert.equal(shortenPath("~/.paseo-minimax-tts/settings.json"), "settings.json");
  assert.equal(shortenPath("~/.paseo-minimax-tts/audio/ac0a3dfd6dddb20962cecff6ee5fe65e19d3923be20e52c5ab52ff877f7e4c32.mp3"), "ac0a3df.mp3");
  assert.equal(shortenPath("/Users/alice/dev/app/src/minimax.ts:42:5"), "minimax.ts");
  assert.equal(shortenPath("/Users/alice/dev/app/src/minimax.ts#L10-L20"), "minimax.ts");
  assert.equal(shortenPath("packages/server/src/handlers/session.ts"), "session.ts");
  assert.equal(shortenPath("C:\\Users\\alice\\Documents\\reports\\summary.pdf"), "summary.pdf");
  assert.equal(shortenPath("C:\\Users\\alice\\projects\\my-app\\package.json"), "my-app/package.json");
  // Short or non-path slash tokens stay untouched.
  assert.equal(shortenPath("antigravity/gemini-4-carbon"), "antigravity/gemini-4-carbon");
  assert.equal(shortenPath("server/minimax.ts"), "server/minimax.ts");
  assert.equal(shortenPath("Off/Synthesize/Play"), "Off/Synthesize/Play");
  assert.equal(shortenPath("2026/11/25"), "2026/11/25");
  assert.equal(shortenPath("1/2/3"), "1/2/3");
  assert.equal(shortenPath("/etc/hosts"), "/etc/hosts");
  assert.equal(shortenPath("./README.md"), "./README.md");
});

test("prepareSpeechText unwraps Markdown links, images, and bare URLs without reading long targets", () => {
  const link = "[transcript.jsonl](http://127.0.0.1:11735/home/wangfh/.t3/userdata/providers/antigravity/ac0a3dfd6dddb20962cecff6ee5fe65e19d3923be20e52c5ab52ff877f7e4c32/antigravity-acp/brain/e6980c64-1e08-4a33-ac1e-92f976f8f735/.system_generated/logs/transcript.jsonl)";
  assert.equal(prepareSpeechText(`完整记录在 ${link}，按需读取。`), "完整记录在 transcript.jsonl，按需读取。");
  assert.equal(prepareSpeechText("See [the guide](https://en.wikipedia.org/wiki/Foo_(bar)) and ![diagram](docs/arch.png)."), "See the guide and diagram.");
  assert.equal(prepareSpeechText("See [notes][1].\n\n[1]: https://example.com/long/path"), "See notes.");
  assert.equal(prepareSpeechText("Open file:///home/wangfh/project/src/notes.md#L10-L20."), "Open notes.md.");
  assert.equal(prepareSpeechText("记录在http://127.0.0.1:11735/home/wangfh/.t3/logs/transcript.jsonl，已写入。"), "记录在transcript.jsonl，已写入。");
  assert.equal(prepareSpeechText("Visit https://www.minimax.io/docs/api/v2?token=secret and <https://paseo.sh>."), "Visit minimax.io and paseo.sh.");
  assert.equal(prepareSpeechText("Run handlers[name](arg) now."), "Run handlers[name](arg) now.");
});

test("prepareSpeechText cleans inline math without breaking currency or shell variables", () => {
  assert.equal(prepareSpeechText("leading form 下 $\\chi^2\\_{\\rm red}$ 跃升"), "leading form 下 chi² red 跃升");
  assert.equal(prepareSpeechText("原稿 $\\eta\\_\\phi=0.49(3)$ 与 CB 一致；误差缩到 $0.468(6)$，不再覆盖 CB。"), "原稿 eta phi = 0.49(3) 与 CB 一致；误差缩到 0.468(6)，不再覆盖 CB。");
  assert.equal(prepareSpeechText("**$t$-$V$ 的时间线**"), "t-V 的时间线");
  assert.equal(prepareSpeechText("Both $\\chi_\\mu$ and $\\eta_\\phi$ match."), "Both chi mu and eta phi match.");
  assert.equal(prepareSpeechText("Costs $5 or between $10 and $20 ($10-$20), using $HOME."), "Costs $5 or between $10 and $20 ($10-$20), using $HOME.");
});

test("prepareSpeechText strips markdown formatting and shortens standalone hashes and UUIDs", () => {
  const input = [
    "## Summary",
    "",
    "- **Worktree**: `/home/wangfh/.t3/worktrees/submatrixLRpaper/rebuttal-r1-6-bg-suppressed`",
    "- Commit ac0a3dfd6dddb20962cecff6ee5fe65e19d3923be in session e6980c64-1e08-4a33-ac1e-92f976f8f735",
    "",
    "---",
    "",
    "| Name | Mode |",
    "| --- | --- |",
    "| Chat A | `Play` |",
  ].join("\n");
  assert.equal(
    prepareSpeechText(input),
    [
      "Summary",
      "",
      "Worktree: rebuttal-r1-6-bg-suppressed",
      "Commit ac0a3df in session e6980c64",
      "",
      "Name, Mode",
      "Chat A, Play",
    ].join("\n"),
  );
  // Idempotent: cleaning already-cleaned text produces the exact same string.
  const cleaned = prepareSpeechText(input);
  assert.equal(prepareSpeechText(cleaned), cleaned);
});

test("renderSpeech sends cleaned text to MiniMax and uses matching part keys", async () => {
  const sent: string[] = [];
  const request: typeof fetch = async (_url, init) => {
    const { text } = JSON.parse(String(init?.body));
    sent.push(text);
    return new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: "494433" } }));
  };
  const raw = "在 `/home/wangfh/.t3/worktrees/submatrixLRpaper/rebuttal-r1-6-bg-suppressed` 查看 [transcript.jsonl](http://127.0.0.1:11735/home/wangfh/a/b/transcript.jsonl)，误差 $0.468(6)$。";
  await renderSpeech(raw, { apiKey: "FAKE", region: "cn", model: "m", voice: "v" }, new AbortController().signal, request);
  assert.deepEqual(sent, speechParts(raw));
  assert.equal(sent[0], "在 rebuttal-r1-6-bg-suppressed 查看 transcript.jsonl，误差 0.468(6)。");
});
