# Telegram Web DeepL Translator (Chrome/Brave Extension)

A client-side Manifest V3 extension that intercepts and translates Telegram Web DOM nodes using the DeepL REST API. It operates entirely within the browser, requiring no bot integration or administrative access to chats.

## Architecture & Features

* **DOM Interception & Observer:** Utilizes a `MutationObserver` targeting `.Message:not(.own)` nodes. It tracks both `childList` and `characterData` mutations to capture initial message loads and subsequent real-time edits.
* **State Management & Caching:** Implements a localized `Map()` session cache bound to the tab lifecycle. This prevents redundant API calls during Telegram's aggressive DOM unmounting/remounting cycles triggered by vertical scrolling.
* **Asynchronous Request Queue:** Mitigates DeepL API `429 Too Many Requests` errors caused by Telegram's bulk message rendering. The queue throttles outgoing `fetch` requests (100ms standard delay) and enforces a 2000ms backoff if a rate limit is hit.
* **Contextual API Payload:** Extracts the `innerHTML` of the preceding two messages within the DOM hierarchy to populate the DeepL `context` parameter, significantly improving pronoun resolution and contextual accuracy.
* **HTML Tag Handling:** Passes `tag_handling=html` to the DeepL endpoint to preserve native Telegram formatting (bold, italics, hyperlinks) within the returned translation string.
* **Dynamic API Routing:** Automatically evaluates the provided authentication key and routes traffic to either `api-free.deepl.com` or `api.deepl.com`.

## Installation (Unpacked)

1. Clone this repository.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the root directory.

## Configuration

* Requires a DeepL API Auth Key (Free or Pro).
* Settings (Key, Source/Target parameters, Formality toggle) are managed via the extension popup and persisted in `chrome.storage.local`.

---
*Note: The core logic and DOM manipulation strategies in this repository were developed with the assistance of generative AI.*