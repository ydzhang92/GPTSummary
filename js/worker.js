import { DEFAULT_SETTINGS } from './config.js';
import { getLocalStorage } from './utils.js';

(() => {
  async function getSettings() {
    const result = (await getLocalStorage('settings')) || {};
    return { ...DEFAULT_SETTINGS, ...result };
  }

  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') chrome.runtime.openOptionsPage();
  });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'GPT_Summarizer',
      type: 'normal',
      title: chrome.i18n.getMessage('appName'),
      contexts: ['page', 'selection'],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, activeTab) => {
    let tab = activeTab;

    if (!tab) [tab] = await chrome.tabs.query({ active: true });
    const { id: tabId } = tab;

    if (!tabId) return;
    const settings = await getSettings();

    chrome.scripting
      .executeScript({
        target: { tabId },
        files: ['js/popup.js'],
      })
      .then(() => {
        chrome.tabs.sendMessage(tabId, {
          event: 'SUMMARY',
          settings,
          selectionText: info.selectionText,
        });
      });
  });

  chrome.action.onClicked.addListener(async (activeTab) => {
    let tab = activeTab;

    if (!tab) [tab] = await chrome.tabs.query({ active: true });
    const { id: tabId } = tab;

    const settings = await getSettings();

    chrome.scripting
      .executeScript({
        target: { tabId },
        files: ['js/popup.js'],
      })
      .then(() => {
        chrome.tabs.sendMessage(tabId, { event: 'SUMMARY', settings });
      });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message === 'OPEN_OPTIONS_PAGE') {
      chrome.runtime.openOptionsPage();
    }
  });
})();
