const OpenAPI = require('openapi-typescript-codegen')
const fs = require('fs')

module.exports = class BuildApiPlugin {
    constructor(source) {
        this.source = source
    }

    apply(compiler) {
        const pluginName = this.constructor.name
        console.log("BuildAPI preparing " + this.source)
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
                console.log("Will recompile");
                return OpenAPI.generate({
                    input: pair.from,
                    output: pair.to,
                    httpClient: OpenAPI.HttpClient.FETCH,
                    useOptions: true,
                    useUnionTypes: true,
                    exportCore: true,
                    exportSchemas: true,
                    exportModels: true,
                    exportServices: true})
            } else {
                console.log("Not required - not modified");
                return Promise.resolve("not-modified");
            }
        })).then(() => {console.log("API is compiled"); callback()});
    }
}
