document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const formalitySelect = document.getElementById('formality');
  const saveBtn = document.getElementById('saveBtn');
  const toggleTranslationBtn = document.getElementById('toggleTranslationBtn');
  const statusTxt = document.getElementById('status');
  const quotaDisplay = document.getElementById('quotaDisplay');
  const outgoingTargetLangSelect = document.getElementById('outgoingTargetLang');

  let isEnabled = false;

  function updateToggleButtonState(enabled) {
    isEnabled = enabled;
    if (isEnabled) {
      toggleTranslationBtn.textContent = 'Stop Translation';
      toggleTranslationBtn.className = 'btn-red';
    } else {
      toggleTranslationBtn.textContent = 'Enable Translation';
      toggleTranslationBtn.className = 'btn-green';
    }
  }

  function fetchQuota(apiKey) {
    if (!apiKey) {
      quotaDisplay.textContent = "Enter API Key to see quota";
      return;
    }
    chrome.runtime.sendMessage({ action: 'checkQuota', apiKey: apiKey }, (response) => {
      if (response && response.success) {
        quotaDisplay.textContent = `Quota: ${response.count} / ${response.limit}`;
      } else {
        quotaDisplay.textContent = "Quota unavailable";
      }
    });
  }

  // Load saved settings
  chrome.storage.local.get(['deeplKey', 'sourceLang', 'targetLang', 'outgoingTargetLang', 'formality', 'isEnabled'], (data) => {
    if (data.deeplKey) apiKeyInput.value = data.deeplKey;
    if (data.sourceLang) sourceLangSelect.value = data.sourceLang;
    if (data.targetLang) targetLangSelect.value = data.targetLang;
    if (data.outgoingTargetLang) outgoingTargetLangSelect.value = data.outgoingTargetLang;
    if (data.formality) formalitySelect.value = data.formality;
    updateToggleButtonState(!!data.isEnabled);
    
    fetchQuota(data.deeplKey);
  });

  // Save specific settings
  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    chrome.storage.local.set({
      deeplKey: key,
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value,
      outgoingTargetLang: outgoingTargetLangSelect.value,
      formality: formalitySelect.value
    }, () => {
      statusTxt.style.display = 'block';
      setTimeout(() => statusTxt.style.display = 'none', 2000);
      fetchQuota(key);
    });
  });

  // Toggle On/Off state
  toggleTranslationBtn.addEventListener('click', () => {
    const newState = !isEnabled;
    chrome.storage.local.set({ isEnabled: newState }, () => {
      updateToggleButtonState(newState);
    });
  });
});