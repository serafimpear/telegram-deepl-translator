chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'translateText') {
    const isFreeKey = request.apiKey.endsWith(':fx');
    const endpoint = isFreeKey 
      ? 'https://api-free.deepl.com/v2/translate' 
      : 'https://api.deepl.com/v2/translate';

    const body = new URLSearchParams();
    body.append('text', request.text);
    body.append('target_lang', request.targetLang);
    body.append('preserve_formatting', 'true');
    body.append('tag_handling', 'html');

    if (request.sourceLang) body.append('source_lang', request.sourceLang);
    if (request.formality && request.formality !== 'default') body.append('formality', request.formality);
    if (request.context) body.append('context', request.context);

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${request.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body
    })
    .then(async response => {
      // Check if the API returned a success code before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText || 'Unknown Error'}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.translations && data.translations.length > 0) {
        sendResponse({ success: true, translatedText: data.translations[0].text });
      } else {
        sendResponse({ success: false, error: 'No translation returned.' });
      }
    })
    .catch(error => {
      // Safely catch the error and send it back so the port doesn't close
      sendResponse({ success: false, error: error.message });
    });

    return true; // Keep port open for async
  }

  if (request.action === 'checkQuota') {
    const isFreeKey = request.apiKey.endsWith(':fx');
    const endpoint = isFreeKey 
      ? 'https://api-free.deepl.com/v2/usage' 
      : 'https://api.deepl.com/v2/usage';

    fetch(endpoint, {
      method: 'GET',
      headers: { 'Authorization': `DeepL-Auth-Key ${request.apiKey}` }
    })
    .then(async response => {
      if (!response.ok) throw new Error("Quota fetch failed");
      return response.json();
    })
    .then(data => {
      if (data.character_count !== undefined) {
        sendResponse({ success: true, count: data.character_count, limit: data.character_limit });
      } else {
        sendResponse({ success: false });
      }
    })
    .catch(() => sendResponse({ success: false }));

    return true; // Keep port open for async
  }
});