const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

(async () => {
  // Launch Puppeteer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  async function loginToTwitter() {
    await page.goto("https://x.com/login");
    await page.waitForSelector('input[name="text"]');
    await page.type('input[name="text"]', process.env.USERNAME);
    await delay(1000); // aaaaaa
    await page.evaluate(() => {
      const nextButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.innerText.includes("Next")
      );
      if (nextButton) {
        nextButton.click();
      }
    });

    await page.waitForSelector('input[name="password"]', { visible: true });
    await page.type('input[name="password"]', process.env.PASSWORD);
    await delay(1000); // aaaAAAA

    await page.evaluate(() => {
      const loginButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.innerText.includes("Log in")
      );
      if (loginButton) {
        loginButton.click();
      }
    });

    await page.waitForNavigation({ waitUntil: "networkidle2" });
  }

  // fetch likes
  async function scrapeLikes(tweetLink) {
    try {
      const urlParts = tweetLink.split("/");
      const tweetAuthor = "@" + urlParts[3];

      const likesLink = tweetLink + "/likes";
      await page.goto(likesLink, { waitUntil: "networkidle2" });

      let usernames = new Set();
      usernames.add(tweetAuthor); // Add tweet author to the usernames set

      // dumb
      for (let i = 0; i < 35; i++) {
        let newNames = await page.evaluate(() => {
          let names = [];
          let elements = document.querySelectorAll(
            'button[data-testid="UserCell"] a[role="link"] span'
          );
          elements.forEach((element) => {
            if (element.innerText.startsWith("@")) {
              names.push(element.innerText);
            }
          });
          return names;
        });

        newNames.forEach((name) => usernames.add(name));

        const initialUserCellCount = await page.evaluate(
          () =>
            document.querySelectorAll('button[data-testid="UserCell"]').length
        );

        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await delay(2000);

        const newUserCellCount = await page.evaluate(
          () =>
            document.querySelectorAll('button[data-testid="UserCell"]').length
        );

        if (newUserCellCount <= initialUserCellCount) {
          break;
        }
      }

      const uniqueUsernames = Array.from(usernames);
      console.log(
        `Found ${uniqueUsernames.length} usernames for tweet: ${tweetLink}`
      );

      return uniqueUsernames;
    } catch (error) {
      console.error(`Error scraping ${tweetLink}:`, error.message);
      return null;
    }
  }

  await loginToTwitter();

  // Read tweet links from tweets.txt
  const fileStream = fs.createReadStream("tweets.txt");
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
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
  fs.writeFileSync("../twitterblocker/usernames.txt", allUsernames.join("\n"));

  console.log(
    "Usernames of people who liked the tweets have been written to usernames.txt"
  );

  await browser.close();
})();
