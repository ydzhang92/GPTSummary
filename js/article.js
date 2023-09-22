import { Readability } from '../lib/Readability.js';
import { encode, decode } from '../lib/tokenizer/mod.js';
import * as pdfjsLib from '../lib/pdf/pdf.js';

async function getArticle(content, settings, article = null, prompt = null) {
  if (!content && /twitter.com\/.+\/status/.test(document.location.href)) {
		return getTwitterArticle();
	}

  if (!content && /app.slack.com\//.test(document.location.href)) {
    const thread = document.getElementsByClassName('p-threads_flexpane')[0];
    if (thread) {
			const slackArticle = getSlackArticle(thread);
			article = slackArticle.article;
			prompt = slackArticle.prompt;
    }
  }

  else if (!content && /\.*\.pdf/.test(document.location.href)) {
    const pdfArticle = await getPdfArticle();
    article = pdfArticle.article;
    content = pdfArticle.content;
  }
  
  return getArticleContents(content, settings, article, prompt);
}

function getArticleContents(content, settings, article = null, prompt = null) {
  article = article || new Readability(document.cloneNode(true)).parse();
  content = (content || article.textContent).replace(
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
    return { title: article.title, content: content , prompt: prompt};
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
    content: content,
  };
}

function getSlackArticle(thread) {
  let doc = document.implementation.createHTMLDocument("Slack Thread");
  doc.body.appendChild(thread.cloneNode(true));
  let article = new Readability(doc).parse();
  let prompt = chrome.i18n.getMessage('slackThreadSummaryPrompt');
  return { article: article, prompt: prompt };
}

async function getPdfArticle() {
  // sketchy import, find a different way to import pdfjs
  var pdfjs = window['pdfjs-dist/build/pdf'];
  // Will be using promises to load document, pages and misc data instead of
  // callback.
  const pdf = pdfjs.getDocument(document.location.href).promise;
  let content = await pdf.then(function(pdf) { // get all pages text
    var maxPages = pdf.numPages;
    var countPromises = []; // collecting all page promises
    for (var j = 1; j <= maxPages; j++) {
      var page = pdf.getPage(j);

      var txt = "";
      countPromises.push(page.then(function(page) { // add page promise
        var textContent = page.getTextContent();
        return textContent.then(function(text){ // return content promise
          return text.items.map(function (s) { return s.str; }).join(''); // value page text 
        });
      }));
    }
    // Wait for all pages and join text
    return Promise.all(countPromises).then(function (texts) {
      return texts.join('');
    });
  });
  return { article: { title: document.title }, content: content };
}

export {
	getArticle
};