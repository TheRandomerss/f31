import { chromium } from "playwright";
import { newInjectedContext } from "fingerprint-injector";
import { checkTz } from "./tz_px.js"; // Ensure this module is properly set up

const url = "https://9albifilmadina.shop/";
const MAX_CONCURRENT_THREADS = 7; // Semaphore-style concurrency control
const LONG_SESSION_PROBABILITY = 0.05; // 5% long sessions

class Semaphore {
  constructor(max) {
    this.tasks = [];
    this.count = max;
  }

  acquire() {
    return new Promise(resolve => {
      if (this.count > 0) {
        this.count--;
        resolve();
      } else {
        this.tasks.push(resolve);
      }
    });
  }

  release() {
    if (this.tasks.length > 0) {
      const next = this.tasks.shift();
      next();
    } else {
      this.count++;
    }
  }
}

const semaphore = new Semaphore(MAX_CONCURRENT_THREADS);

const realisticHeaders = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "upgrade-insecure-requests": "1"
};

const humanMouseMovements = [
  { type: 'move', x: 100, y: 200, duration: 500 },
  { type: 'click', x: 300, y: 400 },
  { type: 'scroll', y: 500 },
  { type: 'move', x: 50, y: 300, duration: 1000 }
];

const getRandomReferer = () => {
  const sources = [
    { url: "https://www.google.com/", weight: 70 },
    { url: "https://www.facebook.com/", weight: 10 },
    { url: "https://twitter.com/", weight: 8 },
    { url: "https://www.reddit.com/", weight: 7 },
    { url: "https://www.linkedin.com/", weight: 5 }
  ];
  
  const total = sources.reduce((acc, curr) => acc + curr.weight, 0);
  const random = Math.random() * total;
  let sum = 0;
  
  for (const source of sources) {
    sum += source.weight;
    if (random <= sum) return source.url;
  }
  return sources[0].url;
};

const humanType = async (page, text) => {
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
    if (Math.random() < 0.05) await page.waitForTimeout(200 + Math.random() * 500);
  }
};

const realisticScroll = async (page) => {
  const scrollSteps = Math.floor(Math.random() * 5) + 3;
  for (let i = 0; i < scrollSteps; i++) {
    const scrollDistance = Math.random() * 800 + 200;
    await page.mouse.wheel(0, scrollDistance);
    await page.waitForTimeout(Math.random() * 1000 + 500);
  }
};

const humanInteraction = async (page) => {
  // Random mouse movements
  for (const action of humanMouseMovements) {
    if (action.type === 'move') {
      await page.mouse.move(action.x + Math.random() * 50, action.y + Math.random() * 50, {
        steps: 10,
        duration: action.duration
      });
    } else if (action.type === 'click') {
      await page.mouse.click(action.x + Math.random() * 50, action.y + Math.random() * 50);
    } else if (action.type === 'scroll') {
      await realisticScroll(page);
    }
    await page.waitForTimeout(Math.random() * 1000 + 500);
  }

  // Random typing simulation
  if (Math.random() < 0.3) {
    await humanType(page, String.fromCharCode(65 + Math.floor(Math.random() * 26)).catch(() => {});
  }
};

const OpenBrowser = async (link, username) => {
  await semaphore.acquire();
  try {
    const isLongSession = Math.random() < LONG_SESSION_PROBABILITY;
    const browser = await chromium.launch({
      headless: true,
      proxy: {
        server: "148.113.161.141:5959",
        username: username,
        password: process.env.JEDI,
      },
    });

    const context = await newInjectedContext(browser, {
      fingerprintOptions: {
        devices: ["desktop", "mobile"][Math.floor(Math.random() * 2)],
        browsers: ["chrome", "firefox", "safari"][Math.floor(Math.random() * 3)],
        operatingSystems: ["windows", "macos", "linux"][Math.floor(Math.random() * 3)],
        locales: ["en-US", "en-GB", "fr-FR"][Math.floor(Math.random() * 3)],
        screen: {
          width: Math.random() < 0.8 ? 1920 : 1366,
          height: Math.random() < 0.8 ? 1080 : 768,
        },
      },
    });

    const page = await context.newPage();
    await page.setExtraHTTPHeaders({
      ...realisticHeaders,
      'user-agent': context._userAgent,
      'referer': getRandomReferer()
    });

    // Block unnecessary resources
    await page.route('**/*', route => {
      return ['image', 'stylesheet', 'font', 'media'].includes(route.request().resourceType()) 
        ? route.abort() 
        : route.continue();
    });

    // Add human-like delays
    await page.goto(link, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000,
      referer: getRandomReferer()
    });

    // Random interaction sequence
    await page.waitForTimeout(2000 + Math.random() * 3000);
    await realisticScroll(page);
    await humanInteraction(page);
    
    if (isLongSession) {
      // Extended session behavior
      await page.waitForTimeout(30000 + Math.random() * 30000);
      await realisticScroll(page);
      await humanInteraction(page);
    }

    await page.waitForTimeout(isLongSession ? 60000 : 15000 + Math.random() * 25000);
    await browser.close();
  } catch (error) {
    console.error('Error in session:', error);
  } finally {
    semaphore.release();
  }
};

const generateUsername = () => {
  const locations = ['se', 'ua', 'us', 'fr', 'ca'];
  return `qualityser-res-${locations[Math.floor(Math.random() * locations.length)]}-sid-${Math.floor(10000 + Math.random() * 90000)}`;
};

(async () => {
  const TOTAL_SESSIONS = 1000; // Set your desired total sessions
  const sessions = Array(TOTAL_SESSIONS).fill().map((_, i) => 
    OpenBrowser(url, generateUsername())
      .catch(e => console.error(`Session ${i} failed:`, e))
  );

  await Promise.all(sessions);
})();
