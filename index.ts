import dotenv from "dotenv";
import arg from "arg";
import { Logger } from "tslog";
import chalk from "chalk";
import { stripIndents } from "common-tags";
import got, { HTTPError } from "got";

// CR: tslog has trouble figuring out the present working directory, relative paths seem broken
const log: Logger = new Logger();

dotenv.config();

const args = arg({
  "--help": Boolean,
  "-h": "--help",
  "--steamid": String,
  "-U": "--steamid",
  "--appid": String,
  "-a": "--appid",
});

if (args["--help"]) {
  console.log(stripIndents`
    ${chalk.whiteBright.bgBlue(" STEAMID ")}
    To find your steamid, go to your steam profile (maybe https://store.steampowered.com/account/).
    
    ${chalk.whiteBright.bgBlue(" APPID ")}
    To find the appid, look at the store URL (maybe https://store.steampowered.com/app/1190460/DEATH_STRANDING/).
    
    ${chalk.whiteBright.bgBlue(" PROFILE PRIVACY ")}
    Steam profile must be public for the tool to work. Check privacy settings for "Game Details" 
    (maybe https://steamcommunity.com/id/<STEAMID>/edit/settings). Please wait 5-10 minutes for settings to take effect.
  `);
  process.exit();
}

if (!args["--steamid"] || !args["--appid"]) {
  log.error("Must provide --steamid and --appid, see --help for details.");
  process.exit();
}

try {
  const {
    game: {
      gameName,
      availableGameStats: { achievements: gameAchievements },
    },
  } = await got
    .get(
      "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0001/",
      {
        searchParams: {
          format: "json",
          appid: args["--appid"],
          key: process.env.STEAM_API_KEY,
        },
      }
    )
    .json();

  const {
    playerstats: { achievements: playerAchievements },
  } = await got
    .get(
      "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/",
      {
        searchParams: {
          format: "json",
          steamid: args["--steamid"],
          appid: args["--appid"],
          key: process.env.STEAM_API_KEY,
        },
      }
    )
    .json();

  console.log(gameName);
  console.log(`${Object.keys(gameAchievements).length} achievements`);
  console.log("");

  function printAchievement(withLabel, a) {
    let apiname = a["apiname"];
    let displayName = gameAchievements[apiname]["displayName"];
    let description = gameAchievements[apiname]["description"];

    console.log(`${withLabel} ${displayName} - ${description}`);
  }

  for (let a of playerAchievements) {
    if (a["achieved"] === 1) {
      printAchievement(chalk.whiteBright.bgGreen(" ACHIEVED "), a);
    }
  }

  console.log("");

  for (let a of playerAchievements) {
    if (a["achieved"] === 0) {
      printAchievement(chalk.whiteBright.bgRed(" NOT ACHIEVED "), a);
    }
  }
} catch (e) {
  if (e instanceof HTTPError) {
    log.error(
      chalk.white.bgRed(`${e.response.statusCode} ${e.response.statusMessage}`),
      JSON.parse(<string>e.response.body) // CR: <string> not always true, nor always JSON
    );
  } else {
    log.error(e);
  }
}
