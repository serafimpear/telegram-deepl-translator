let settings = {
  isEnabled: false,
  deeplKey: '',
  sourceLang: '',
  targetLang: 'EN',
  outgoingTargetLang: 'EN',
  formality: 'default',
  translateOwn: false
};

let observer = null;
let translationQueue = [];
let isProcessingQueue = false;
const sessionCache = new Map();

chrome.storage.local.get(['deeplKey', 'sourceLang', 'targetLang', 'formality', 'isEnabled', 'translateOwn'], (data) => {
  settings = { ...settings, ...data };
  handleStateChange();
});

chrome.storage.onChanged.addListener((changes) => {
  let needsRetranslation = false;

  if (changes.isEnabled) settings.isEnabled = changes.isEnabled.newValue;
  if (changes.deeplKey) { settings.deeplKey = changes.deeplKey.newValue; needsRetranslation = true; }
  if (changes.sourceLang) { settings.sourceLang = changes.sourceLang.newValue; needsRetranslation = true; }
  if (changes.targetLang) { settings.targetLang = changes.targetLang.newValue; needsRetranslation = true; }
  if (changes.formality) { settings.formality = changes.formality.newValue; needsRetranslation = true; }
  if (changes.outgoingTargetLang) { settings.outgoingTargetLang = changes.outgoingTargetLang.newValue; }
  if (changes.translateOwn) { settings.translateOwn = changes.translateOwn.newValue; needsRetranslation = true; }

  if (needsRetranslation) {
    clearAllTranslations();
  }

  handleStateChange();
});

function handleStateChange() {
  if (settings.isEnabled && settings.deeplKey) {
    startObserver();
    translateVisibleMessages();
  } else {
    stopObserver();
    clearAllTranslations(); 
  }
}

function clearAllTranslations() {
  translationQueue = []; 
  isProcessingQueue = false;
  sessionCache.clear(); 
  
  document.querySelectorAll('.deepl-translation, .deepl-hr-flag').forEach(el => el.remove());
  document.querySelectorAll('.deepl-translated-flag').forEach(el => {
      el.classList.remove('deepl-translated-flag');
      delete el.dataset.deeplOriginalHtml;
  });
}

// Returns a CSS selector for messages based on the translateOwn setting.
function getMessageSelector(excludeAlreadyTranslated = true) {
  const ownFilter = settings.translateOwn ? '' : ':not(.own)';
  const translatedFilter = excludeAlreadyTranslated ? ':not(.deepl-translated-flag)' : '';
  return `.Message${ownFilter}${translatedFilter}`;
}

function translateVisibleMessages() {
  const messages = document.querySelectorAll(getMessageSelector());
  messages.forEach(processMessage);
}

function startObserver() {
  if (observer) return;
  
  observer = new MutationObserver((mutations) => {
    if (!settings.isEnabled || !settings.deeplKey) return;
    
    mutations.forEach((mutation) => {
      // 1. Handle brand new messages loading in
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.classList && node.classList.contains('Message')) {
            // Check own filter at runtime so toggling translateOwn takes effect immediately
            if (!settings.translateOwn && node.classList.contains('own')) return;
            if (!node.classList.contains('deepl-translated-flag')) processMessage(node);
          } else if (node.querySelectorAll) {
            const innerMessages = node.querySelectorAll(getMessageSelector());
            innerMessages.forEach(processMessage);
          }
        }
      });

      // 2. Handle edited messages
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        let targetEl = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
        if (!targetEl) return;

        let messageNode = targetEl.closest('.Message');
        if (!messageNode) return;

        // Respect the own-messages filter
        if (!settings.translateOwn && messageNode.classList.contains('own')) return;
        
        // If it's a message we already translated...
        if (messageNode.classList.contains('deepl-translated-flag')) {
          const textContentContainer = messageNode.querySelector('.text-content');
          if (textContentContainer) {
             
             const clone = textContentContainer.cloneNode(true);
             
             const metaTag = clone.querySelector('.MessageMeta');
             if (metaTag) metaTag.remove();
             const translation = clone.querySelector('.deepl-translation');
             if (translation) translation.remove();
             const hr = clone.querySelector('.deepl-hr-flag');
             if (hr) hr.remove();

             const currentHTML = clone.innerHTML.trim();

             if (currentHTML && currentHTML !== messageNode.dataset.deeplOriginalHtml) {
                if (textContentContainer.querySelector('.deepl-translation')) textContentContainer.querySelector('.deepl-translation').remove();
                if (textContentContainer.querySelector('.deepl-hr-flag')) textContentContainer.querySelector('.deepl-hr-flag').remove();
                
                messageNode.classList.remove('deepl-translated-flag');
                processMessage(messageNode);
             }
          }
        }
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function getContextString(currentMessageNode) {
  let contextText = "";
  let previousNode = currentMessageNode.previousElementSibling;
  let count = 0;

  while (previousNode && count < 2) {
    if (previousNode.classList && previousNode.classList.contains('Message')) {
      const textContainer = previousNode.querySelector('.text-content');
      if (textContainer) {
        let rawText = textContainer.innerText.replace(/edited \d{2}:\d{2}|\d{2}:\d{2}/g, '').trim(); 
        if (rawText) {
          contextText = rawText + "\n" + contextText;
          count++;
        }
      }
    }
    previousNode = previousNode.previousElementSibling;
  }
  return contextText.trim();
}

function processMessage(messageNode) {
  if (messageNode.classList.contains('deepl-translated-flag')) return;
  
  const textContentContainer = messageNode.querySelector('.text-content');
  if (!textContentContainer) return;

  messageNode.classList.add('deepl-translated-flag');

  const clone = textContentContainer.cloneNode(true);
  const metaTag = clone.querySelector('.MessageMeta');
  if (metaTag) metaTag.remove();

  const originalHTML = clone.innerHTML.trim();
  if (!originalHTML) {
      messageNode.classList.remove('deepl-translated-flag');
      return;
  }

  messageNode.dataset.deeplOriginalHtml = originalHTML;

  if (sessionCache.has(originalHTML)) {
      appendTranslation(textContentContainer, sessionCache.get(originalHTML));
      return;
  }

  const contextStr = getContextString(messageNode);

  translationQueue.push({
    node: messageNode,
    container: textContentContainer,
    text: originalHTML,
    context: contextStr
  });

  processQueue();
}

function processQueue() {
  if (isProcessingQueue || translationQueue.length === 0) return;
  isProcessingQueue = true;

  const item = translationQueue.shift();

  if (!settings.isEnabled) {
      isProcessingQueue = false;
      return;
  }

  try {
    chrome.runtime.sendMessage({
      action: 'translateText',
      text: item.text,
      apiKey: settings.deeplKey,
      sourceLang: settings.sourceLang,
      targetLang: settings.targetLang,
      formality: settings.formality,
      context: item.context
    }, (response) => {
      
      let delay = 100;

      try {
          if (chrome.runtime.lastError) {
            console.error("Extension Messaging Error:", chrome.runtime.lastError.message);
            item.node.classList.remove('deepl-translated-flag');
          } else if (response && response.success) {
            sessionCache.set(item.text, response.translatedText);
            appendTranslation(item.container, response.translatedText);
          } else {
            console.error("DeepL Translation Error:", response ? response.error : "Unknown error");
            item.node.classList.remove('deepl-translated-flag');
            
            if (response && response.error && response.error.includes("429")) {
                console.warn("Rate limit hit. Pausing queue for 2 seconds...");
                delay = 2000;
            }
          }
      } catch (err) {
          console.error("Error formatting/appending translation:", err);
          item.node.classList.remove('deepl-translated-flag');
      } finally {
          setTimeout(() => {
            isProcessingQueue = false;
            processQueue();
          }, delay);
      }
    });
  } catch (err) {
    console.error("Message sending failed.", err);
    item.node.classList.remove('deepl-translated-flag');
    isProcessingQueue = false;
    processQueue();
  }
}

function appendTranslation(container, translatedHTML) {
  if (container.querySelector('.deepl-translation')) return;

  const metaTag = container.querySelector('.MessageMeta');
  
  const hr = document.createElement('hr');
  hr.className = "deepl-hr-flag";
  hr.style.cssText = "border: 0; border-top: 1px solid rgba(128, 128, 128, 0.3); margin: 6px 0;";
  
  const translationDiv = document.createElement('div');
  translationDiv.className = "deepl-translation";
  translationDiv.style.cssText = "color: #777; font-size: 0.95em; margin-bottom: 4px; white-space: pre-wrap;";
  translationDiv.innerHTML = translatedHTML;

  if (metaTag && metaTag.parentNode === container) {
    container.insertBefore(hr, metaTag);
    container.insertBefore(translationDiv, metaTag);
  } else {
    container.appendChild(hr);
    container.appendChild(translationDiv);
  }
}

// --- Outgoing Translation Logic (Alt + T) ---

document.addEventListener('keydown', (e) => {
  if (e.altKey && (e.code === 'KeyT' || e.key.toLowerCase() === 't')) {
    e.preventDefault(); 
    handleOutgoingTranslation();
  }
});

function handleOutgoingTranslation() {
  if (!settings.isEnabled || !settings.deeplKey) return;

  const inputBox = document.getElementById('editable-message-text');
  if (!inputBox) return;

  const textToTranslate = inputBox.innerText.trim();
  if (!textToTranslate) return;

  const originalOpacity = inputBox.style.opacity;
  inputBox.style.opacity = '0.5';

  chrome.runtime.sendMessage({
    action: 'translateText',
    text: textToTranslate,
    apiKey: settings.deeplKey,
    sourceLang: '',
    targetLang: settings.outgoingTargetLang,
    formality: settings.formality,
    context: ''
  }, (response) => {
    inputBox.style.opacity = originalOpacity;

    if (chrome.runtime.lastError || !response || !response.success) {
      console.error("Outgoing translation failed:", response ? response.error : chrome.runtime.lastError);
      return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = response.translatedText;
    const cleanText = tempDiv.innerText;

    inputBox.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputBox);
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand('insertText', false, cleanText);
  });
}