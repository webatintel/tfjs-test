'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process')

const util = require('./util.js')

let startDate = '20230101'
let endDate = '20230105'

async function upload() {
  let folders = fs.readdirSync(util.outDir);
  let fullPath, stat, result;
  for (let folder of folders) {
    // check if folder is effective
    if (isNaN(folder)) {
      continue;
    }
    fullPath = path.join(util.outDir, folder);
    stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      continue;
    }

    // check if date is in range
    let folderDate = folder.substring(0, 8);
    if (parseInt(folderDate) < parseInt(startDate) ||
        parseInt(folderDate) > parseInt(endDate)) {
      continue;
    }

    // check if file exists
    fullPath = path.join(fullPath, `${folderDate}.json`);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    // check if file exists in remote
    result = spawnSync('ssh', [
      'wp@wp-27.sh.intel.com',
      `ls /workspace/project/work/tfjs/perf/${util.platform}/${
          util['gpuDeviceId']}/${folderDate}.json`
    ]);
    if (result.status == 0) {
      util.log(`[INFO] ${fullPath} already exists in server`);
      continue;
    }

    // upload the file
    result = spawnSync('scp', [
      fullPath,
      `wp@wp-27.sh.intel.com:/workspace/project/work/tfjs/perf/${
          util.platform}/${util['gpuDeviceId']}`
    ]);
    if (result.status !== 0) {
      util.log(`[ERROR] ${fullPath} Failed to upload`);
    } else {
      util.log(`[INFO] ${fullPath} was successfully uploaded`);
    }
  }
}

module.exports = upload;
