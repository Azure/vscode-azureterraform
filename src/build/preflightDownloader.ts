import * as fs from "fs";
import * as path from "path";
import * as unzip from "unzip-stream";
import axios from "axios";

interface Build {
  name: string;
  downloadUrl: string;
}

interface Release {
  version: string;
  assets: Build[];
}

function getPlatform(platform: string) {
  if (platform === "win32") {
    return "windows";
  }
  return platform;
}

function getArch(arch: string) {
  if (arch === "ia32") {
    return "386";
  }
  if (arch === "x64") {
    return "amd64";
  }
  if (arch === "armhf") {
    return "arm";
  }
  return arch;
}

async function getRelease(): Promise<Release> {
  // Assumption: aztfpreflight binary is released from Azure/aztfpreflight
  const response = await axios.get(
    "https://api.github.com/repos/Azure/aztfpreflight/releases",
    {
      headers: {},
    }
  );
  if (response.status === 200 && response.data.length !== 0) {
    const assets: Build[] = [];
    for (const i in response.data[0].assets) {
      assets.push({
        name: response.data[0].assets[i].name,
        downloadUrl: response.data[0].assets[i].browser_download_url,
      });
    }
    return {
      version: response.data[0].name,
      assets,
    };
  }
  throw new Error("no valid release");
}

async function run(platform: string, architecture: string) {
  const cwd = path.resolve(__dirname);
  const buildDir = path.basename(cwd);
  const repoDir = cwd.replace(buildDir, "");
  const installPath = path.join(repoDir, "..", "bin");

  const os = getPlatform(platform);
  const fileExtension = os === "windows" ? ".exe" : "";
  const binaryName = path.resolve(installPath, `aztfpreflight${fileExtension}`);
  if (fs.existsSync(binaryName)) {
    console.log("aztfpreflight already exists. Exiting");
    return;
  }

  if (!fs.existsSync(installPath)) {
    fs.mkdirSync(installPath);
  }

  const release = await getRelease();
  const arch = getArch(architecture);

  let build: Build | undefined;
  for (const i in release.assets) {
    const name: string = release.assets[i].name;
    if (name.includes(`${os}_${arch}`) && name.endsWith(".zip")) {
      build = release.assets[i];
      break;
    }
  }

  if (!build) {
    throw new Error(
      `Install error: no matching aztfpreflight binary for ${os}/${arch}`
    );
  }

  console.log(build);

  // download zip
  const zipfile = path.resolve(
    installPath,
    `aztfpreflight_${release.version}.zip`
  );
  await axios
    .get(build!.downloadUrl, { responseType: "stream" })
    .then(function (response) {
      const fileWritePipe = fs.createWriteStream(zipfile);
      response.data.pipe(fileWritePipe);
      return new Promise<void>((resolve, reject) => {
        fileWritePipe.on("close", () => resolve());
        response.data.on("error", reject);
      });
    });

  // unzip
  const fileReadStream = fs.createReadStream(zipfile);
  const unzipPipe = unzip.Extract({ path: installPath });
  fileReadStream.pipe(unzipPipe);
  await new Promise<void>((resolve, reject) => {
    unzipPipe.on("close", () => {
      try {
        // After extraction, find any file that looks like the versioned aztfpreflight binary
        let candidate: string | undefined;
        const files = fs.readdirSync(installPath);
        for (const f of files) {
          const startsWithVersion = f.indexOf("aztfpreflight_v") === 0;
          const extOk = fileExtension ? f.endsWith(fileExtension) : true;
          if (startsWithVersion && extOk) {
            candidate = f;
            break;
          }
        }

        if (candidate) {
          const oldPath = path.resolve(installPath, candidate);
          // rename to the canonical binary name
          if (oldPath !== binaryName) {
            try {
              fs.renameSync(oldPath, binaryName);
            } catch (err) {
              // if rename fails (e.g. dest exists), try removing dest and renaming
              if (fs.existsSync(binaryName)) {
                fs.unlinkSync(binaryName);
              }
              fs.renameSync(oldPath, binaryName);
            }
          }
        }

        if (fs.existsSync(binaryName)) {
          fs.chmodSync(binaryName, "755");
        }

        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
    fileReadStream.on("error", reject);
  });

  fs.unlinkSync(zipfile);
}

let os = process.platform.toString();
let arch = process.arch;

// ls_target=linux_amd64 npm run package -- --target=linux-x64
const preflightTarget = process.env.ls_target;
if (preflightTarget !== undefined) {
  const tgt = preflightTarget.split("_");
  os = tgt[0];
  arch = tgt[1];
}

// npm run download:preflight --target=darwin-x64
const target = process.env.npm_config_target;
if (target !== undefined) {
  const tgt = target.split("-");
  os = tgt[0];
  arch = tgt[1];
}

run(os, arch);
