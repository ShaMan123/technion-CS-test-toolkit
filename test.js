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
    if (ex.length === 0) {
        console.log('\nNO exercises found');
        return;
    }
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
        const results = await Promise.all(_tests.map(async t => {
            const outName = t.replace('in', 'out');
            const desiredOutputPath = path.resolve('./tests', outName);
            const desiredOutput = fs.readFileSync(desiredOutputPath).toString();
            const output = await new Promise((resolve, reject) => {
                let data = '';
                const child = cp.exec(`${pathToExe} < ${path.resolve('./tests', t)}`);
                child.stdout.on('data', function (chunck) {
                    data += chunck;
                });
                child.stderr.on('data', reject);
                child.on('close', code => resolve(data));
            });
            if (output === desiredOutput) {
                return { testName: t, passed: true };
            } else {
                return { testName: t, passed: false, output };
            }
        }));
        if (_tests.length === 0) {
            console.log('\nNO tests found');
            return;
        }
        const failed = results.filter(value => !value.passed);
        results.forEach(res => {
            console.log(chalk.bold(`${res.testName} ${res.passed ? chalk.green('PASSED') : chalk.redBright('FAILED')}`));
        });
        console.log(failed.length === 0 ? chalk.greenBright('\nAll tests PASSED') : chalk.redBright(`\n${failed.length} tests FAILED`));
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
        console.log(`${chalk.green('desired output (+)')}, ${chalk.red('errors (-)')}`);
        console.log(chalk.yellowBright('\nIf necessary, press enter to continue printing the diff or q to quit\n'));
        failed.forEach(({ testName: t, output }) => {
            const outName = t.replace('in', 'out');
            const desiredOutputPath = path.resolve('./tests', outName);
            const outputPath = path.resolve('./output', outName);
            !fs.existsSync('./output') && fs.mkdirSync('./output');
            fs.writeFileSync(outputPath, output);
            console.log(chalk.underline(chalk.bold(`${t} diff\n`)));
            try {
                cp.execSync(`git diff --no-index ${path.relative(process.cwd(), outputPath)} ${path.relative(process.cwd(), desiredOutputPath)}`, { cwd: process.cwd(), stdio: 'inherit' });
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