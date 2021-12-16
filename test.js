const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

!fs.existsSync('./tests') && fs.mkdirSync('./tests');
const ex = [];
const tests = fs.readdirSync('./tests');

function readCFiles(dir) {
    fs.readdirSync(dir)
        .filter(fileName => fileName.endsWith('.c'))
        .forEach(fileName => ex.push({ name: path.parse(fileName).name, folder: dir }));
}

readCFiles('.');
fs.readdirSync('.')
    .filter(fileName => fs.lstatSync(path.resolve('.', fileName)).isDirectory())
    .forEach(readCFiles);

function build(file) {
    const parsedPath = path.parse(file);
    cp.spawnSync('gcc.exe', [
        "-fdiagnostics-color=always",
        "-g",
        path.resolve(file),
        "-o",
        path.resolve(path.format({ name: parsedPath.name, ext: '.exe', dir: parsedPath.dir }))
    ], { cwd: 'C:\\msys64\\mingw64\\bin', stdio: 'inherit' });
}

function printTitle() {
    console.log(chalk.blueBright('Technion CS Local Test Kit'));
    console.log(chalk.bold('\nA small service developed by ') + chalk.underline(chalk.blueBright('ShaMan123')) + chalk.bold(' for the benefit of friends and all\n'));
}

async function go() {
    printTitle();
    const { testName } = await inquirer.prompt([
        {
            type: 'list',
            choices: ex.map(ex => path.join(ex.folder, `${ex.name}.c`)),
            default: ex.length - 1,
            message: 'Select exercise to test',
            name: 'testName'
        }
    ]);
    try {
        const filePath = path.parse(testName);
        const pathToExe = path.format({ dir: filePath.dir, name: filePath.name, ext: '.exe' });
        const _tests = tests.filter(t => t.startsWith(filePath.name) && t.includes('in'));
        try {
            //cp.execSync(`npm run build -- ${testName}`);
            build(testName);
        } catch (error) {
            //  failed to build
        }
        if (!fs.existsSync(pathToExe)) {
            throw new Error(`Did you forget to build ${testName}? OR if you configured an automated build it failed.`);
        }
        const failed = [];
        const passed = _tests.map(t => {
            const outName = t.replace('in', 'out');
            const desiredOutputPath = path.resolve('./tests', outName);
            const desiredOutput = fs.readFileSync(desiredOutputPath).toString();
            const output = cp.execSync(`${pathToExe} < ${path.resolve('./tests', t)}`).toString();
            if (output === desiredOutput) {
                console.log(chalk.bold(`${t} ${chalk.green('PASSED')}`));
                return true;
            } else {
                console.log(chalk.bold(`${t} ${chalk.redBright('FAILED')}`));
                failed.push({ testName: t, output });
                return false;
            }
        });
        if (_tests.length === 0) {
            console.log('\nNO tests found');
            return;
        }
        console.log(passed.every(value => value) ? chalk.greenBright('\nAll tests PASSED') : chalk.redBright(`\n${failed.length} tests FAILED`));
        if (failed.length === 0) {
            return;
        }
        const { displayDiff } = await inquirer.prompt([
            {
                type: 'confirm',
                default: true,
                message: 'Display diffs?',
                name: 'displayDiff'
            }
        ]);
        if (!displayDiff) {
            return;
        }
        console.log(chalk.yellowBright('\nIf necessary, press enter to continue printing the diff or q to quit\n'));
        failed.forEach(({ testName: t, output }) => {
            const outName = t.replace('in', 'out');
            const desiredOutputPath = path.resolve('./tests', outName);
            const outputPath = path.resolve('./output', outName);
            !fs.existsSync('./output') && fs.mkdirSync('./output');
            fs.writeFileSync(outputPath, output);
            console.log(chalk.underline(chalk.bold(`${t} diff\n`)));
            try {
                cp.execSync(`git diff --no-index ${path.relative(process.cwd(), desiredOutputPath)} ${path.relative(process.cwd(), outputPath)}`, { cwd: process.cwd(), stdio: 'inherit' });
            } catch (error) {
                //console.error(error.toString())
            }
            console.log('\n');
        });
    } catch (err) {
        console.error('\n' + chalk.redBright(err.toString()));
    }
}

go();