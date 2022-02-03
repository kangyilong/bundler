const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');
const babelTraverse = require('@babel/traverse').default;
const babelCode = require('@babel/core');

// 解析单个文件
function parsingSingleFile(filename) {
    const data = fs.readFileSync(filename, 'utf-8');
    const axt = babelParser.parse(data, { sourceType: 'module' });
    const dependencies = {};
    babelTraverse(axt, {
        ImportDeclaration({ node }) {
            const { value } = node.source;
            const dirname = path.dirname(filename);
            dependencies[value] = './' + path.join(dirname, value);
        }
    });
    const { code } = babelCode.transformFromAstSync(axt, null, {
        presets: ['@babel/preset-env']
    });
    return {
        filename,
        dependencies,
        code
    };
}

// 解析引用的全部文件
function parsingAllFile(entry) {
    const data = parsingSingleFile(entry);
    const parsingArray = [data];
    const graph = {};
    for (let i = 0; i < parsingArray.length; i ++) {
        const { filename, dependencies } = parsingArray[i];
        graph[filename] = parsingArray[i];
        for(let key in dependencies) {
            parsingArray.push(parsingSingleFile(dependencies[key]));
        }
    }
    return graph;
}

// 编译代码
function generateCode(entry) {
    const graph = JSON.stringify(parsingAllFile(entry));
    return `
        (function(graph) {
            function require(module) {
                function localRequire(relativePath) {
                    return require(graph[module].dependencies[relativePath]);
                }
                var exports = {};
                (function(require, exports, code) {
                    eval(code);
                })(localRequire, exports, graph[module].code);
                return exports;
            };
            require('${entry}');
        })(${graph})
    `;
}

console.log(generateCode('./src/index.js'));