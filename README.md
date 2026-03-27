# 🌐 Telegram DeepL Translator

A lightweight Chrome/Brave extension that automatically translates Telegram Web messages in real-time using the [DeepL API](https://www.deepl.com/pro-api). No bots, no server-side setup — everything runs directly in your browser.

---

## ✨ Features

- **Auto-translate incoming messages** — translates all non-own messages as they appear, with translations rendered inline below the original text
- **Outgoing translation** — press `Alt + T` in the message input box to translate your draft before sending
- **Smart session cache** — avoids redundant API calls when Telegram re-renders messages during scrolling
- **Contextual translation** — passes the two preceding messages as context to DeepL for improved pronoun resolution and accuracy
- **HTML-aware** — preserves native Telegram formatting (bold, italics, links) in translated output
- **Edit detection** — automatically re-translates messages that are edited after the fact
- **Rate limit handling** — request queue with automatic 2s backoff on `429` errors
- **Free & Pro API support** — automatically routes to the correct DeepL endpoint based on your key

---

## 📦 Installation

> **Requirements:** Chrome or Brave browser

1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder

---

## ⚙️ Configuration

Click the extension icon to open the popup and configure the following:

| Setting | Description |
|---|---|
| **DeepL API Key** | Your Free (`:fx`) or Pro API key from [deepl.com](https://www.deepl.com/pro-api) |
| **Source Language** | Language to translate *from* (or Auto Detect) |
| **Target Language** | Language to translate incoming messages *into* |
| **Outgoing Target** | Language used when translating your outgoing draft via `Alt + T` |
| **Formality** | Control whether DeepL uses formal or informal register |

Settings are saved automatically via `chrome.storage.local` and take effect immediately — no page refresh needed.

---

## 🚀 Usage

### Incoming messages
1. Enter your DeepL API key and configure your target language
2. Click **Enable Translation**
3. Open any Telegram Web chat — translations will appear below each incoming message

### Outgoing messages
1. Type your message in the input box
2. Press `Alt + T` to replace your text with a translation in the configured outgoing language
3. Review and press `Enter` to send

---

## 🏗️ Architecture

```
manifest.json        — MV3 extension manifest
background.js        — Service worker; handles DeepL API fetch calls
content.js           — DOM observer, translation queue, cache, and injection logic
popup.html / .js     — Settings UI and quota display
```

**How it works:**

- `content.js` attaches a `MutationObserver` to `document.body`, watching for new `.Message:not(.own)` nodes and `characterData` mutations (for edited messages)
- Discovered messages are pushed to an async queue, which throttles outgoing requests at 100ms intervals and backs off for 2s on rate-limit errors
- Translations are fetched by `background.js` (which has broader network access as a service worker) and returned via the Chrome messaging API
- Translated HTML is injected below the original message content, above the `MessageMeta` timestamp node

---

## 🔑 Getting a DeepL API Key

1. Sign up at [deepl.com/pro-api](https://www.deepl.com/pro-api)
2. The **Free tier** includes 500,000 characters/month — free keys end in `:fx`
3. Copy your Auth Key and paste it into the extension popup

---

## ⚠️ Notes & Limitations

- Works with **Telegram Web** (`web.telegram.org`) only — not the desktop or mobile apps
- The session cache is tab-scoped and cleared on page reload
- `document.execCommand('insertText')` is used for outgoing translation injection — this is deprecated in web standards but remains the only reliable method for triggering React's synthetic events in `contenteditable` elements
- The extension requests no special permissions beyond `storage` and access to `web.telegram.org` and `deepl.com`