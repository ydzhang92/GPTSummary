const getLocalStorage = (key) => new Promise((resolve, reject) => {
  chrome.storage.local.get(key, (data) => {
    if (chrome.runtime.lastError) {
      reject(chrome.runtime.lastError);
    } else {
      resolve(data[key]);
    }
  });
});

const setLocalStorage = (data) => new Promise((resolve, reject) => {
  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      reject(chrome.runtime.lastError);
    } else {
      resolve();
    }
  });
});

const removeLocalStorage = (keys) => new Promise((resolve, reject) => {
  chrome.storage.local.remove(keys, () => {
    if (chrome.runtime.lastError) {
      reject(chrome.runtime.lastError);
    } else {
      resolve();
    }
  });
});

const copyText = (text, callback) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);

  if (callback) {
    setTimeout(callback, 2000);
  }
};

let controller = new AbortController();

async function chat(messages, settings, callback) {
  controller.abort();
  controller = new AbortController();
  const { signal } = controller;

  let response;

  const body = JSON.stringify({
    model: settings.model,
    messages,
    temperature: Number(settings.temperature),
    stream: true,
    max_tokens: /16k|32k$/.test(settings.model) ? 1024 : 512,
    top_p: 1,
    frequency_penalty: 1,
    presence_penalty: 1,
  });

  if (settings.provider === 'azure') {
    response = await fetch(settings.azureURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': settings.azureKey,
      },
      signal,
      body,
    });
  } else {
    response = await fetch(`${settings.host}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.token}`,
      },
      signal,
      body,
    });
  }

  if (!response.ok) {
    const result = await response.json();
    if (result?.error?.message) {
      throw new Error(result.error.message);
    } else {
      throw new Error(chrome.i18n.getMessage('utilsChatOpenAIError'));
    }
  }

  if (!response.body) {
    throw new Error(chrome.i18n.getMessage('utilsChatReadableError'));
  }

  const reader = response.body.getReader();
  let buffer = '';
  return new Promise((resolve, reject) => {
    function processText({ value }) {
      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');

      for (let index = 0; index < lines.length - 1; index += 1) {
        const line = lines[index];

        if (line.includes('[DONE]')) {
          resolve();
          return;
        }

        if (line.startsWith('data:')) {
          const data = line.replaceAll(/(\n)?^data:\s*/g, '');
          try {
            const delta = JSON.parse(data.trim());
            const result = delta.choices[0].delta?.content;
            if (result) callback(result);
          } catch (error) {
            console.error(`Error with JSON.parse and ${line}.\n${error}`);
          }
        }
      }

      buffer = lines[lines.length - 1];
      reader.read().then(processText);
    }

    reader.read().then(processText).catch(reject);
  });
}

export {
  chat,
  copyText,
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
};
