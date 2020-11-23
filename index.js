const { spawn } = require("child_process");
const fs = require('fs')

const OPENAPI_GENERATOR_VERSION="5.0.0-beta2"
// TBD: Download the jar on demand, or just include it in the package?


const compilePair = (pair) => {
    const args = ["-jar", __dirname + "/openapi-generator-cli-" + OPENAPI_GENERATOR_VERSION + ".jar",
                  "generate",
                  "-g", "typescript-fetch",
                  "--type-mappings=date=Date,DateTime=Date,decimal=BigDecimal",
                  "--additional-properties=useSingleRequestParameter=true,typescriptThreePlus=true,modelPropertyNaming=original",
                  "-c",  __dirname + "/config.yaml",
                  "-i", pair.from,
                  "-o", pair.to]
    //console.log("Compiling with " + args.join(' '))
    const child = spawn("java", args)
    child.stdout.on("data", data => {
        if (!/INFO/.exec(data) && !/Output directory does not exist, or is inaccessible/.exec(data))
            console.log(`${data}`);
    });

    child.stderr.on("data", data => {
        console.log(`ERR: ${data}`);
    });

    child.on("error", (error) => {
        console.log("error: " + error.message);
    });

    return new Promise((resolution, rejection) => {
        child.on("close", code => {
            if (code == 0) {
                // Touch the output dir. If nothing has changed, openapi-generator-cli will not output anything, which means
                // the timestamp stays the same.
                // This leaves us in an infinite loop
                const time = new Date();
                fs.utimesSync(pair.to, time, time);
                resolution(code);
            }
            else {
                console.log("Compilation exited with code " + code);
                rejection(code);
            }
        })
    })
}

module.exports = class BuildApiPlugin {
    constructor(source) {
        this.source = source
    }

    apply(compiler) {
        const pluginName = this.constructor.name
        console.log("OpenAPI Generator BuildAPI preparing " + this.source)
        compiler.hooks.beforeRun.tapAsync(pluginName, this.compile);
        compiler.hooks.watchRun.tapAsync(pluginName, this.compile);
    }

    compile(compiler, callback) {
        console.log("BuildAPI invoked");
        const files = fs.readdirSync('../api').filter(fn => fn.endsWith('.json')).map(file => ({from: '../api/' + file,
                                                                                                to: 'src/api/' + file.slice(0, -5)}))
        console.log("Building the following APIs:");
        console.log(files);

        Promise.all(files.map((pair) => {
            console.log("Considering " + pair.from + " -> " + pair.to);
            if (!fs.existsSync(pair.to) || fs.statSync(pair.from).mtime.valueOf() > fs.statSync(pair.to).mtime.valueOf()) {
                console.log("   *** will recompile " + pair.from);
                return compilePair(pair);
            } else {
                console.log("   *** not required - " + pair.from + " not modified");
                return Promise.resolve("not-modified");
            }
        })).then(() => {console.log("API is compiled"); callback()});
    }
}
