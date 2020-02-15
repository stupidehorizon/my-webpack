const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { transformFromAst } = require('@babel/core');

let ID = 0;

// step.1 read the entry file
// step.2 covert entry file to ast
// step.3 find import declaration and 

const createAsset = (fileName) => {
  const content = fs.readFileSync(fileName, 'utf-8');

  const ast = parser.parse(content, {
    sourceType: 'module',
  });

  const dependencies = [];

  traverse(ast, {
    ImportDeclaration: (path) => {
      dependencies.push(path.node.source.value);
      // console.log(path.node.source.value);
    },
  });

  const id = ID++;

  // const { code } = generater(ast, {
  //   presets: ['env'],
  // });

  const { code } = transformFromAst(ast, null, {
    presets: ['env']
  })

  return {
    id,
    fileName,
    code,
    dependencies,
  }
}

const createGraph = (entry) => {
  const entryAsset = createAsset(entry);
  const queue = [entryAsset];

  for(asset of queue) {
    asset.map = {};
    const { dependencies, fileName } = asset;
    const dirPath = path.dirname(fileName);
    dependencies.forEach(childFile => {
      const childFilePath = path.join(dirPath, childFile);
      const childAsset = createAsset(childFilePath);
      asset.map[childFile] = childAsset.id;
      queue.push(childAsset);
    });
  }

  // console.log(queue);
  return queue;
}

const bundle = (graph) => {
  let modules = '';

  graph.forEach(({id, code, map}) => {
    modules += `${id}: [
      function(require, module, exports) {
        ${code}
      },
      ${JSON.stringify(map)}
    ],`
  });
  // console.log(modules);

  const result = `
    (function(modules) {

      function require(id) {
        const [fn, map] = modules[id];

        function localRequire(name) {
          return require(map[name]);
        };

        const module = {exports: {}};
        fn(localRequire, module, module.exports);
        
        return module.exports;
      };

      require(0);

    }({${modules}}))
  `

  return result;
}

const graph = createGraph('./test/hello.js');
const result = bundle(graph);
console.log(result);
