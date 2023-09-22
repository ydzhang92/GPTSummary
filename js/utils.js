import { Readability } from '../lib/Readability.js';
import { encode, decode } from '../lib/tokenizer/mod.js';

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
    temperature: 0,
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

async function getArticle(selectionText, settings) {
  if (
    !selectionText
    && /twitter.com\/.+\/status/.test(document.location.href)
  ) {
    return getTwitterArticle();
  }

  if (!selectionText && /app.slack.com\//.test(document.location.href)) {
    const thread = document.getElementsByClassName('p-threads_flexpane')[0];
    if (thread) {
      return getSlackArticle(settings, thread);
    }
  }
  return getArticleContents(selectionText, settings);
}

function getArticleContents(selectionText, settings, article = null, prompt = null) {
  article = article || new Readability(document.cloneNode(true)).parse();
  const content = (selectionText || article.textContent).replace(
    /\s{2,}/g,
    ' ',
  );

  let maxTokens = 3000;
  if (settings.model.endsWith('16k')) {
    maxTokens = 15000;
  } else if (settings.model.endsWith('32k')) {
    maxTokens = 31000;
  }
  if (/^zh/i.test(article.lang)) {
    maxTokens = Math.floor(maxTokens * 1.5);
  }

  const tokens = encode(content);

  console.log(
    '[GPT_Summarizer]:',
    content.length,
    `${tokens.length} tokens`,
    article,
  );

  if (tokens.length < maxTokens) {
    return { title: article.title, content , prompt: prompt};
  }

  return {
    title: article.title,
    content: decode(tokens.slice(0, maxTokens)),
    prompt: prompt
  };
}

function getTwitterArticle() {
  const content = [...document.querySelectorAll('[data-testid="tweet"]')]
      .map((tweet) => {
        const name = tweet.querySelector(
          '[data-testid="User-Name"] > div:last-child a',
        )?.innerText;
        const text = tweet.querySelector(
          '[data-testid="tweetText"]',
        )?.innerText;

        if (!name || !text) return false;
        return `${name}: ${text}\n`;
      })
      .filter((text) => text)
      .join('\n');
  return {
    title: document.title,
    content,
  };
}

function getSlackArticle(settings, thread) {
  let doc = document.implementation.createHTMLDocument("Slack Thread");
  doc.body.appendChild(thread.cloneNode(true));
  let article = new Readability(doc).parse();
  let prompt = chrome.i18n.getMessage('slackThreadSummaryPrompt');
  return getArticleContents(null, settings, article, prompt);
}

export {
  chat,
  copyText,
  getArticle,
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
};
