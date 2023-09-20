const DEFAULT_SETTINGS = {
  prompt: chrome.i18n.getMessage('configPrompt'),
  token: '',
  host: 'https://api.openai.com',
  model: 'gpt-3.5-turbo',
  provider: 'openai',
  azureKey: '',
  azureURL: '',
};

const TEMPLATE = `
<style>
  :host > * {
    font-size: 15px;
    white-space: normal;
  }

  #GPTSummarizer__popup {
    width: 400px;
    z-index: 2147483646;
    font-size: 15px;
    font-family: -apple-system, 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
      'Helvetica', 'Arial', 'PingFang SC', 'Microsoft YaHei', '微软雅黑',
      sans-seri, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(10px);

    --bs-primary: #766bec;
    --bs-primary-rgb: 118,107,236;
    --bs-light: #a59fed;
    --bs-light-rgb: 165,159,237;
    --bs-link-color: var(--bs-primary);
    --bs-link-hover-color: #9489ec;
    --bs-border-radius: 0.75em;
  }

  #GPTSummarizer__copy.copied .bi-clipboard {
    display: none;
  }

  #GPTSummarizer__copy:not(.copied) .bi-check-lg {
    display: none;
  }

  .btn-primary {
    --bs-btn-bg: var(--bs-primary);
    --bs-btn-border-color: var(--bs-primary);
    --bs-btn-hover-bg: var(--bs-link-hover-color);
    --bs-btn-hover-border-color: var(--bs-link-hover-color);
    --bs-btn-focus-shadow-rgb: var(--bs-primary-rgb);
    --bs-btn-active-bg: var(--bs-link-hover-color);
    --bs-btn-active-border-color: var(--bs-link-hover-color);
    --bs-btn-disabled-bg: var(--bs-primary);
    --bs-btn-disabled-border-color: var(--bs-primary);
  }

  .btn-link {
    --bs-btn-focus-shadow-rgb: var(--bs-primary-rgb);
  }

  .form-control:focus {
    background-color: var(--bs-body-bg);
    border-color: #ff6489;
    box-shadow: 0 0 0 0.25em rgba(255, 139, 167, 0.25);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }
</style>
<div
  id="GPTSummarizer__popup"
  class="card m-3 shadow border-0 position-fixed top-0 end-0"
  style="
    transition: 200ms opacity ease-in-out;
    animation-name: fadeIn;
    opacity: 0;
  "
>
  <div
    class="card-header bg-primary text-white d-flex justify-content-between align-items-center py-2 pe-1 border-0"
  >
    <h6 id="GPTSummarizer__title" class="m-0 d-none">
      ${chrome.i18n.getMessage('appName')}
    </h6>
    <div
      id="GPTSummarizer__loading"
      class="d-flex justify-content-center align-items-center"
    >
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      <h6 class="m-0">${chrome.i18n.getMessage('configSummarising')}</h6>
    </div>
    <div class="btn-group btn-group-sm">
      <button
        id="GPTSummarizer__copy"
        type="button"
        class="btn btn-primary lh-1 d-none"
        title="${chrome.i18n.getMessage('configCopy')}"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          class="bi bi-clipboard"
          viewBox="0 0 16 16"
        >
          <path
            d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"
          />
          <path
            d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"
          />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          class="bi bi-check-lg"
          viewBox="0 0 16 16"
        >
          <path
            d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"
          />
        </svg>
      </button>
      <button
        id="GPTSummarizer__settings"
        type="button"
        class="btn btn-primary lh-1"
        title="${chrome.i18n.getMessage('configSettings')}"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          class="bi bi-gear"
          viewBox="0 0 16 16"
        >
          <path
            d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"
          />
          <path
            d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"
          />
        </svg>
      </button>
      <button
        id="GPTSummarizer__close"
        type="button"
        class="btn btn-primary lh-1"
        title="${chrome.i18n.getMessage('configClose')}"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          class="bi bi-x-lg"
          viewBox="0 0 16 16"
        >
          <path
            d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"
          />
        </svg>
      </button>
    </div>
  </div>
  <div class="card-body">
    <div
      id="GPTSummarizer__output"
      class="overflow-y-auto"
      style="max-height: calc(100vh - 8em); min-height: 2em; line-height: 1.7; white-space: pre-wrap"
    ></div>
  </div>
</div>
`;

export { DEFAULT_SETTINGS, TEMPLATE };
