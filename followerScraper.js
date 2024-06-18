const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

(async () => {
  // Launch Puppeteer
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  async function loginToTwitter() {
    await page.goto("https://x.com/login");
    await page.waitForSelector('input[name="text"]');
    await page.type('input[name="text"]', process.env.USER);
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

  // fetch followers
  async function scrapeFollowers() {
    try {
      const followersLink = `https://x.com/${process.env.USER}/followers`;
      await page.goto(followersLink, { waitUntil: "networkidle2" });

      let usernames = new Set();
      let previousUserCellCount = 0;
      let retryCount = 0;

      while (retryCount < 5) {
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

        const currentUserCellCount = await page.evaluate(
          () =>
            document.querySelectorAll('button[data-testid="UserCell"]').length
        );

        console.log(`Loaded ${currentUserCellCount} user cells`);

        if (currentUserCellCount === previousUserCellCount) {
          retryCount++;
          console.log(`No new followers loaded, retrying (${retryCount}/5)`);
        } else {
          retryCount = 0;
        }

        previousUserCellCount = currentUserCellCount;
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await delay(2000);
      }

      const uniqueUsernames = Array.from(usernames);
      console.log(
        `Found ${uniqueUsernames.length} followers for user: ${process.env.USER}`
      );

      return uniqueUsernames;
    } catch (error) {
      console.error(`Error scraping followers:`, error.message);
      return null;
    }
  }

  await loginToTwitter();

  const followers = await scrapeFollowers();
  if (followers) {
    const header = `Total ${followers.length} followers\n\n`;
    const followersText = followers.join("\n");
    fs.writeFileSync("followers.txt", header + followersText);

    console.log(
      "Usernames of your followers have been written to followers.txt"
    );
  } else {
    console.log("An error occurred while fetching followers.");
  }

  await browser.close();
})();
