import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import type { Theme } from "./schemas/theme";
import axios from "axios";

const themesPath = path.join(import.meta.dirname, "..", "..", "themes");

const folders = fs.readdirSync(themesPath);

const hydraHeaderSecret = process.env.HYDRA_HEADER_SECRET;

if (!hydraHeaderSecret) {
  throw new Error("HYDRA_HEADER_SECRET is not set");
}

Promise.all(
  folders.map(async (folder) => {
    const folderPath = path.join(themesPath, folder);
    const files = fs.readdirSync(folderPath);

    const cssFile = files.find((file) => file.endsWith(".css"));
    const screenshotFile = files.find((file) => file.startsWith("screenshot"));

    if (!cssFile) {
      console.error(`No css file found for theme ${folder}`);
      return;
    }

    if (!screenshotFile) {
      console.error(`No screenshot file found for theme ${folder}`);
      return;
    }

    const parts = folder.split("-");
    const authorCode = parts.pop();
    const themeName = parts.join("-");

    const response = await axios.get(
      `https://hydra-api-us-east-1.losbroxas.org/themes/users/${authorCode}`,
      {
        headers: {
          "Content-Type": "application/json",
          "hydra-token": hydraHeaderSecret,
        },
      },
    );

    if (response.status !== 200) {
      console.error(`Failed to fetch author ${authorCode}`);
      return;
    }

    await axios
      .post(
        `https://hydra-api-us-east-1.losbroxas.org/badge/${authorCode}/theme`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            "hydra-token": hydraHeaderSecret,
          },
        },
      )
      .catch((err) => {
        console.error(
          `could not update user (${authorCode}) badge`,
          err.message,
          err.response?.data,
        );
      });

    const data = response.data as Theme["author"];

    fs.cpSync(
      path.join(folderPath),
      path.join(
        import.meta.dirname,
        "..",
        "..",
        "public",
        "themes",
        themeName.toLowerCase(),
      ),
      { recursive: true },
    );

    const url = new URL(data.profileImageUrl);
    url.search = "";

    data.profileImageUrl = url.toString();

    const fileExt = path.extname(data.profileImageUrl);
    const authorResponse = await fetch(data.profileImageUrl).then((res) =>
      res.arrayBuffer(),
    );

    fs.writeFileSync(
      path.join(
        import.meta.dirname,
        "..",
        "..",
        "public",
        "themes",
        themeName.toLowerCase(),
        `author${fileExt}`,
      ),
      Buffer.from(authorResponse),
    );

    return {
      id: `${authorCode}:${themeName}`,
      name: themeName,
      author: data,
      screenshotFile: screenshotFile,
      cssFile: cssFile,
      authorImage: `author${fileExt}`,
      downloads: 0,
      favorites: 0,
    } as Theme;
  }),
).then((themes) => {
  console.log(`Generated ${themes.length} themes`);

  fs.writeFileSync(
    path.join(import.meta.dirname, "themes.json"),
    JSON.stringify(themes),
  );
});
