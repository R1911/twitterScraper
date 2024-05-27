const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

(async () => {
  // Launch Puppeteer
  const browser = await puppeteer.launch({ headless: true }); // Use headless: false for debugging
  const page = await browser.newPage();

  // Function to scrape usernames
  async function scrapeLikes(tweetLink) {
    try {
      await page.goto(tweetLink);

      // Wait for the tweet to load
      await page.waitForSelector('article div[data-testid="like"]', { timeout: 5000 });

      // Click on the likes button to open the list of likes
      await page.click('article div[data-testid="like"]');
      await page.waitForSelector('div[aria-label="Liked by"]', { timeout: 5000 });

      // Scrape usernames from the list
      const usernames = await page.evaluate(() => {
        let usernames = [];
        let elements = document.querySelectorAll('div[aria-label="Liked by"] div[dir="ltr"] > span');
        elements.forEach(element => {
          usernames.push(element.innerText);
        });
        return usernames;
      });

      return usernames;
    } catch (error) {
      console.error(`Error scraping ${tweetLink}:`, error.message);
      return null;
    }
  }

  // Read tweet links from tweets.txt
  const fileStream = fs.createReadStream('tweets.txt');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let allUsernames = [];

  for await (const tweetLink of rl) {
    if (tweetLink.trim()) {
      const usernames = await scrapeLikes(tweetLink.trim());
      if (usernames) {
        allUsernames = allUsernames.concat(usernames);
      } else {
        console.log(`Tweet ${tweetLink} is not public or an error occurred.`);
      }
    }
  }

  // Write usernames to usernames.txt
  fs.writeFileSync('usernames.txt', allUsernames.join('\n'));

  console.log('Usernames of people who liked the tweets have been written to usernames.txt');

  await browser.close();
})();
