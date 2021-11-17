'use strict';

const fs = require('fs');
const runBenchmark = require('./benchmark.js');
const { spawnSync } = require('child_process');
const config = require('./config.js');
const path = require('path');
const report = require('./report.js')
const runUnit = require('./unit.js');
const util = require('./util.js');
const yargs = require('yargs');

util.args = yargs
  .usage('node $0 [args]')
  .strict()
  .option('architecture', {
    type: 'string',
    describe: 'architecture to run, splitted by comma',
  })
  .option('benchmark', {
    type: 'string',
    describe: 'benchmark to run, splitted by comma',
  })
  .option('browser', {
    type: 'string',
    describe: 'browser specific path, chrome_canary, chrome_dev, chrome_beta or chrome_stable',
    default: 'chrome_dev',
  })
  .option('browser-args', {
    type: 'string',
    describe: 'extra browser args',
  })
  .option('conformance-backend', {
    type: 'string',
    describe: 'backend for conformance, splitted by comma',
  })
  .option('disable-breakdown', {
    type: 'boolean',
    describe: 'disable breakdown',
  })
  .option('dryrun', {
    type: 'boolean',
    describe: 'dryrun the test',
  })
  .option('email', {
    alias: 'e',
    type: 'string',
    describe: 'email to',
  })
  .option('input-size', {
    type: 'string',
    describe: 'input size to run, splitted by comma',
  })
  .option('input-type', {
    type: 'string',
    describe: 'input type to run, splitted by comma',
  })
  .option('kill-chrome', {
    type: 'boolean',
    describe: 'kill chrome before testing',
  })
  .option('local-build', {
    type: 'string',
    describe: 'local build packages instead of npm ones',
    default: 'webgl,webgpu,core',
  })
  .option('new-context', {
    type: 'boolean',
    describe: 'start a new context for each test',
  })
  .option('quit-pageerror', {
    type: 'boolean',
    describe: 'quit right after pageerror',
  })
  .option('pause-test', {
    type: 'boolean',
    describe: 'pause after each performance test',
  })
  .option('performance-backend', {
    type: 'string',
    describe: 'backend for performance, splitted by comma',
  })
  .option('repeat', {
    type: 'number',
    describe: 'repeat times',
    default: 1,
  })
  .option('run-times', {
    type: 'number',
    describe: 'run times',
  })
  .option('server-info', {
    type: 'boolean',
    describe: 'get server info and display it in report',
  })
  .option('target', {
    type: 'string',
    describe: 'test target, splitted by comma. Choices can be conformance, performance and unit.',
  })
  .option('tfjs-dir', {
    type: 'string',
    describe: 'tfjs dir',
  })
  .option('timestamp', {
    type: 'string',
    describe: 'timestamp format, day or second',
    default: 'second',
  })
  .option('trace', {
    type: 'boolean',
    describe: 'enable Chrome trace',
  })
  .option('unit-backend', {
    type: 'string',
    describe: 'backend for performance, splitted by comma',
  })
  .option('upload', {
    type: 'boolean',
    describe: 'upload result to server',
  })
  .option('url', {
    type: 'string',
    describe: 'url to test against',
  })
  .option('url-args', {
    type: 'string',
    describe: 'extra url args',
  })
  .option('warmup-times', {
    type: 'number',
    describe: 'warmup times',
  })
  .example([
    ['node $0 --email <email>', '# send report to <email>'],
    ['node $0 --target performance --benchmark pose-detection --architecture BlazePose-heavy --input-size 256 --input-type tensor --performance-backend webgpu'],
    ['node $0 --browser-args="--enable-dawn-features=disable_workgroup_init --no-sandbox --enable-zero-copy"'],
    ['node $0 --target performance --benchmark mobilenet_v2 --performance-backend webgpu --warmup-times 0 --run-times 1 --server-info --new-context'],
    ['node $0 --target performance --benchmark mobilenet_v2 --performance-backend webgpu --warmup-times 0 --run-times 1 --timestamp day'],
  ])
  .help()
  .wrap(120)
  .argv;

function padZero(str) {
  return ('0' + str).slice(-2);
}

function getTimestamp(format) {
  const date = new Date();
  let timestamp = date.getFullYear() + padZero(date.getMonth() + 1) + padZero(date.getDate());
  if (format == 'second') {
    timestamp += padZero(date.getHours()) + padZero(date.getMinutes()) + padZero(date.getSeconds());
  }
  return timestamp;
}

async function main() {
  util.timestamp = getTimestamp(util.args['timestamp']);
  util.logFile = path.join(util.outDir, `${util.timestamp}.log`);
  if (fs.existsSync(util.logFile)) {
    fs.truncateSync(util.logFile, 0);
  }

  if ('kill-chrome' in util.args) {
    spawnSync('cmd', ['/c', 'taskkill /F /IM chrome.exe /T']);
  }

  let browserPath;
  if (util.args['browser'] == 'chrome_canary') {
    if (util.platform === 'darwin') {
      browserPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-unstable'; // There is no Canary channel for Linux
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
    }
  } else if (util.args['browser'] == 'chrome_dev') {
    if (util.platform === 'darwin') {
      browserPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Dev';
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-unstable';
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Dev/Application/chrome.exe`;
    }
  } else if (util.args['browser'] == 'chrome_beta') {
    if (util.platform === 'darwin') {
      browserPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Beta';
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-beta';
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Beta/Application/chrome.exe`;
    }
  } else if (util.args['browser'] == 'chrome_stable') {
    if (util.platform === 'darwin') {
      browserPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Stable';
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-stable';
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.PROGRAMFILES}/Google/Chrome/Application/chrome.exe`;
    }
  } else {
    browserPath = util.args['browser'];
  }
  console.log(`Use browser at ${browserPath}`);
  util.browserPath = browserPath;

  let userDataDir;
  if ('browser' in util.args) {
    userDataDir = `${util.outDir}/user-data-dir`;
  } else if (util.platform === 'darwin') {
    userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/Chrome Canary`;
  } else if (util.platform === 'linux') {
    userDataDir = `/home/${os.userInfo().username}/.config/google-chrome-unstable`;
  } else if (util.platform === 'win32') {
    userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data`;
  }
  util.userDataDir = userDataDir;

  if ('browser-args' in util.args) {
    util.browserArgs = `${util.browserArgs} ${util.args['browser-args']}`;
  }

  let warmupTimes;
  if ('warmup-times' in util.args) {
    warmupTimes = parseInt(util.args['warmup-times']);
  } else {
    warmupTimes = 50;
  }
  util.warmupTimes = warmupTimes;

  let runTimes;
  if ('run-times' in util.args) {
    runTimes = parseInt(util.args['run-times']);
  } else {
    runTimes = 50;
  }
  util.runTimes = runTimes;

  util.urlArgs += `&warmup=${warmupTimes}&run=${runTimes}&localBuild=${util.args['local-build']}`;

  if ('url-args' in util.args) {
    util.urlArgs += `&${util.args['url-args']}`;
  }

  if ('dryrun' in util.args) {
    util.dryrun = true;
  } else {
    util.dryrun = false;
  }

  if ('url' in util.args) {
    util.url = util.args['url'];
  }

  await config();

  let targets = [];
  if ('target' in util.args) {
    targets = util.args['target'].split(',');
  } else {
    targets = ['conformance', 'performance', 'unit'];
  }

  if (!fs.existsSync(util.outDir)) {
    fs.mkdirSync(util.outDir, { recursive: true });
  }

  let results = {};
  util.duration = '';
  let startTime;
  for (let i = 0; i < util.args['repeat']; i++) {
    if (util.args['repeat'] > 1) {
      util.log(`== Test round ${i + 1}/${util.args['repeat']} ==`);
    }

    for (let target of targets) {
      startTime = new Date();
      util.log(`${target} test`);
      if (['conformance', 'performance'].indexOf(target) >= 0) {
        if (!(target == 'performance' && util.warmupTimes == 0 && util.runTimes == 0)) {
          results[target] = await runBenchmark(target);
        }
      } else if (target == 'unit') {
        results[target] = await runUnit();
      }
      util.duration += `${target}: ${(new Date() - startTime) / 1000} `;
    }
    await report(results);
  }
}

main();
