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
  // platform | terraform-ls  | extension platform | vs code editor
  //    --    |           --  |         --         | --
  // macOS    | darwin_amd64  | darwin_x64         | ✅
  // macOS    | darwin_arm64  | darwin_arm64       | ✅
  // Linux    | linux_amd64   | linux_x64          | ✅
  // Linux    | linux_arm     | linux_armhf        | ✅
  // Linux    | linux_arm64   | linux_arm64        | ✅
  // Windows  | windows_386   | win32_ia32         | ✅
  // Windows  | windows_amd64 | win32_x64          | ✅
  // Windows  | windows_arm64 | win32_arm64        | ✅
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
  const response = await axios.get(
    "https://api.github.com/repos/Azure/ms-terraform-lsp/releases",
    {
      headers: {},
    }
  );
  if (response.status == 200 && response.data.length != 0) {
    const assets: Build[] = [];
    for (const i in response.data[0].assets) {
      assets.push({
        name: response.data[0].assets[i].name,
        downloadUrl: response.data[0].assets[i].browser_download_url,
      });
    }
    return {
      version: response.data[0].name,
      assets: assets,
    };
  }
  throw new Error("no valid release");
}

async function run(platform: string, architecture: string) {
  const cwd = path.resolve(__dirname);

  const buildDir = path.basename(cwd);
  const repoDir = cwd.replace(buildDir, "");
  const installPath = path.join(repoDir, "..", "bin");
  if (fs.existsSync(installPath)) {
    console.log("ms-terraform-lsp path exists. Exiting");
    return;
  }

  fs.mkdirSync(installPath);

  const release = await getRelease();

  const os = getPlatform(platform);
  const arch = getArch(architecture);
  let build: Build | undefined;
  for (const i in release.assets) {
    if (release.assets[i].name.endsWith(`${os}_${arch}.zip`)) {
      build = release.assets[i];
      break;
    }
  }

  if (!build) {
    throw new Error(
      `Install error: no matching ms-terraform-lsp binary for ${os}/${arch}`
    );
  }

  console.log(build);

  // download zip
  const zipfile = path.resolve(
    installPath,
    `ms-terraform-lsp_${release.version}.zip`
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
  const fileExtension = os === "windows" ? ".exe" : "";
  const binaryName = path.resolve(
    installPath,
    `ms-terraform-lsp${fileExtension}`
  );
  const fileReadStream = fs.createReadStream(zipfile);
  const unzipPipe = unzip.Extract({ path: installPath });
  fileReadStream.pipe(unzipPipe);
  await new Promise<void>((resolve, reject) => {
    unzipPipe.on("close", () => {
      fs.chmodSync(binaryName, "755");
      return resolve();
    });
    fileReadStream.on("error", reject);
  });

  fs.unlinkSync(zipfile);
}

let os = process.platform.toString();
let arch = process.arch;

// ls_target=linux_amd64 npm run package -- --target=linux-x64
const lsTarget = process.env.ls_target;
if (lsTarget !== undefined) {
  const tgt = lsTarget.split("_");
  os = tgt[0];
  arch = tgt[1];
}

// npm run download:ls --target=darwin-x64
const target = process.env.npm_config_target;
if (target !== undefined) {
  const tgt = target.split("-");
  os = tgt[0];
  arch = tgt[1];
}

run(os, arch);
