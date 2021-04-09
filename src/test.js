'use strict';

const fs = require('fs');
const { chromium } = require('playwright');
const path = require('path');
const style = require('./style.js')
const util = require('./util.js')
const report = require('./report.js')
// For perf test and correctness test.
const benchmark = require('./benchmark.js');
// For unit test.
const unittest = require('./unittest.js');

async function sendResults(unitResultTable, perfResultTable, correctnessResult, timestamp) {
    const seperator = '<br><br>';
    const html = style.getStyle()
        + unitResultTable + seperator
        + perfResultTable + seperator
        + correctnessResult + seperator
        + style.getConfigTable(util);

    await fs.promises.writeFile(path.join(util.resultsDir, `all${timestamp}.html`), html);

    if ('email' in util.args) {
        let startTime = new Date();
        let timestamp = util.getTimestamp(startTime);
        let subject = '[TFJS Test] ' + util['hostname'] + ' ' + timestamp;
        await util.sendMail(util.args['email'], subject, html);
    }
}

async function runAllTests() {
    // Unit test.
    let startTime = new Date();
    let timestamp = util.getTimestamp(startTime);
    const unitResults= await unittest.run();
    const unitResultsTable = report.reportUnittest(unitResults, startTime);

    // Correctness test.
    startTime = new Date();
    let selectorValues = ['Prediction'];
    const correctnessResults = await benchmark.run(selectorValues, 'correctness', 'string');
    const correctnessResultsTable = report.reportCorrectness(correctnessResults, selectorValues, startTime);

    // Perf test.
    startTime = new Date();
    selectorValues = ['average', 'Best', 'Warmup'];
    const perfResults = await benchmark.run(selectorValues, 'performance');
    const perfResultsTable = report.report(perfResults, selectorValues, startTime);

    await sendResults(unitResultsTable, perfResultsTable, correctnessResultsTable, timestamp);
}

module.exports = {
    runAllTests: runAllTests
}