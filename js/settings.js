/* eslint-disable no-param-reassign */
import { DEFAULT_SETTINGS } from './config.js';
import { getLocalStorage, setLocalStorage } from './utils.js';

const setFormItemValue = (id, value) => {
  const element = document.querySelector(`#${id}`);
  if (element) {
    element.value = value;
    element.dispatchEvent(new Event('change'));
  }
};

const setLoadingState = (btn) => {
  const btnText = btn.innerText;
  btn.disabled = true;
  btn.innerText = chrome.i18n.getMessage('settingsLoading');
  return btnText;
};

const resetButton = (btn, text) => {
  btn.disabled = false;
  btn.innerText = text;
};

async function saveSettings(form, settings) {
  await setLocalStorage({ settings });
  const elements = [...form.querySelectorAll('.form-control')];
  elements.forEach((el) => el.classList.add('is-valid'));

  setTimeout(() => {
    elements.forEach((el) => el.classList.remove('is-valid'));
  }, 2000);
}

async function loadSettings() {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(await getLocalStorage('settings')),
  };

  Object.entries(settings).forEach(([key, value]) => {
    setFormItemValue(key, value);
  });
}

function changeButton(form) {
  const btn = form.querySelector('button[type="submit"]');
  const btnText = setLoadingState(btn);
  setTimeout(() => resetButton(btn, btnText), 300);
}

async function validateKey({
  provider = 'openai', token, host, model,
}) {
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Say "hi".' }],
    temperature: 0,
    stream: false,
  });

  let response;

  try {
    if (provider === 'azure') {
      response = await fetch(host, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': token,
        },
        body,
      });
    } else {
      response = await fetch(`${host}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      });
    }

    const data = await response.json();
    if ([200, 400].includes(response.status)) return { verified: true };
    return { verified: false, message: data.error.message || data.error.code };
  } catch (error) {
    return { verified: false, message: error.message || error.code };
  }
}

document
  .querySelector('#form-prompt')
  .addEventListener('submit', async (event) => {
    event.preventDefault();

    const settings = {
      ...DEFAULT_SETTINGS,
      ...(await getLocalStorage('settings')),
      prompt: document.querySelector('#prompt').value,
    };

    changeButton(event.target);
    saveSettings(event.target, settings);
  });

document
  .querySelector('#form-api')
  .addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = event.target;
    const {
      provider: { value: provider },
      token: { value: token },
      host: { value: hostValue },
      model: { value: model },
      azureKey: { value: azureKey },
      azureURL: { value: azureURL },
    } = form.elements;
    const formControls = [...form.querySelectorAll('.form-control')];
    const btn = form.querySelector('button[type="submit"]');
    const btnText = setLoadingState(btn);

    form.querySelector('.invalid-feedback')?.remove();
    formControls.forEach((el) => el.classList.remove('is-invalid'));

    let host = hostValue.trim().replace(/\/+$/, '');

    let settings = {
      ...DEFAULT_SETTINGS,
      ...(await getLocalStorage('settings')),
    };

    let result;

    if (provider === 'azure') {
      result = await validateKey({ provider, token: azureKey, host: azureURL });

      settings = {
        ...settings,
        azureKey,
        azureURL,
        provider,
      };
    } else {
      if (!host) {
        host = DEFAULT_SETTINGS.host;
        form.querySelector('#host').value = DEFAULT_SETTINGS.host;
      }

      result = await validateKey({ token, host, model });

      settings = {
        ...settings,
        token,
        host,
        model,
        provider,
      };
    }

    if (result.verified) {
      saveSettings(form, settings);
    } else {
      formControls.forEach((el) => el.classList.add('is-invalid'));
      btn.insertAdjacentHTML(
        'beforebegin',
        `<div class="invalid-feedback d-block">${result.message}</div>`,
      );
    }

    resetButton(btn, btnText);
  });

document.body.addEventListener('click', ({ target }) => {
  if (target.matches('[data-toggle-password]')) {
    const icon = target.querySelector('.bi');
    icon.classList.toggle('bi-eye');
    icon.classList.toggle('bi-eye-slash');

    const input = document.querySelector(target.dataset.togglePassword);
    input.type = input.type === 'password' ? 'text' : 'password';
  }
});

document.querySelector('#button-reset-prompt').addEventListener('click', () => {
  setFormItemValue('prompt', DEFAULT_SETTINGS.prompt);
  document.querySelector('#form-prompt').requestSubmit();
});

document.title = chrome.i18n.getMessage('appName');
try {
  [...document.querySelectorAll('[data-locale]')].forEach((element) => {
    const text = chrome.i18n.getMessage(element.dataset.locale);
    if (text) element.innerText = text;
  });

  [...document.querySelectorAll('[data-locale-html]')].forEach((element) => {
    const text = chrome.i18n.getMessage(element.dataset.localeHtml);
    if (text) element.innerHTML = text;
  });
} catch (error) {
  console.error('[GPT_Summarizer]:', error);
}

document.querySelector('#provider').addEventListener('change', ({ target }) => {
  [...document.querySelectorAll('[data-provider]')].forEach((element) => {
    element.classList.add('d-none');
  });
  document
    .querySelector(`[data-provider="${target.value}"]`)
    .classList.remove('d-none');
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  document.body.style.opacity = 1;

  if (navigator.userAgent.includes('Chrome')) {
    document.querySelector('#chrome-badge').classList.remove('d-none');
  }
});
