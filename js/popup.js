(async () => {
  const DOM_ID = 'GPTSummarizer__';

  async function renderPopup() {
    const $root = document.createElement('div');
    $root.id = `${DOM_ID}root`;
    $root.attachShadow({ mode: 'open' });

    const { TEMPLATE } = await import(chrome.runtime.getURL('js/config.js'));
    const { copyText } = await import(chrome.runtime.getURL('js/utils.js'));

    $root.shadowRoot.innerHTML = `<link href="${chrome.runtime.getURL(
      'lib/bootstrap.css',
    )}" rel="stylesheet" type="text/css" />${TEMPLATE}`;

    const $settings = $root.shadowRoot.querySelector(`#${DOM_ID}settings`);
    $settings.addEventListener('click', () => {
      chrome.runtime.sendMessage('OPEN_OPTIONS_PAGE');
    });

    const $close = $root.shadowRoot.querySelector(`#${DOM_ID}close`);
    $close.addEventListener('click', () => $root.remove());

    const $copy = $root.shadowRoot.querySelector(`#${DOM_ID}copy`);
    $copy.addEventListener('click', () => {
      const text = $root.shadowRoot.querySelector(`#${DOM_ID}output`).innerHTML;
      copyText(`${text}\n${window.location.href}`, () => $copy.classList.remove('copied'));
      $copy.classList.add('copied');
    });

    document.body.parentElement.appendChild($root);
    setTimeout(() => {
      $root.shadowRoot.querySelector(`#${DOM_ID}popup`).style.opacity = 1;
    }, 100);
    return $root.shadowRoot;
  }

  async function renderContent(settings, selectionText, callback) {
    const { getArticle } = await import(
      chrome.runtime.getURL('js/article.js')
    );
    const { chat } = await import(
      chrome.runtime.getURL('js/utils.js')
    );

    let content = settings.prompt;
    if (!selectionText) {
      selectionText = window.getSelection().toString();
    }
    const article = await getArticle(selectionText, settings);
    if (!selectionText && article.title) {
      content += `\ntitle:"""${article.title}"""`;
    }
    content += `\narticle:"""${article.content}"""`;
    await chat(
      [
        { role: 'system', content: article.prompt || settings.prompt },
        { role: 'user', content },
      ],
      settings,
      callback,
    );
  }

  let executed = false;
  chrome.runtime.onMessage.addListener(
    async ({ event, settings, selectionText } = {}) => {
      (async () => {
        document.querySelector(`#${DOM_ID}root`)?.remove();
        if (executed || event !== 'SUMMARY') return;
        executed = true;
        const $root = await renderPopup();
        const $output = $root.querySelector(`#${DOM_ID}output`);
        
        try {
          await renderContent(settings, selectionText, (data) => {
            $output.innerHTML += data;
          });

          await import(chrome.runtime.getURL('lib/pangu.min.js'));
          $output.innerHTML = window.pangu.spacing($output.innerHTML);
        } catch (error) {
          $output.innerHTML = error;
        }

        $root.querySelector(`#${DOM_ID}loading`).classList.add('d-none');
        $root.querySelector(`#${DOM_ID}copy`).classList.remove('d-none');
        $root.querySelector(`#${DOM_ID}title`).classList.remove('d-none');
      })();
      return true;
    },
  );
})();
