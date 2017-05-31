require('dotenv').config()

const fs = require('fs')
const micro = require('micro')
// const axios = require('axios')
const pify = require('pify')
const glob = pify(require('glob'))
const marked = require('marked')
const highlightjs = require('highlight.js')
const fm = require('front-matter')
const { resolve } = require('path')
const githubHook = require('./gh-hook')
const readFile = pify(fs.readFile)
const YAML = require('yamljs')
const send = micro.send

const port = process.env.PORT || 4000
const isDev = process.env.NODE_ENV !== 'production'

// Use highlight.js for code blocks
const renderer = new marked.Renderer()
renderer.code = (code, language) => {
  const validLang = !!(language && highlightjs.getLanguage(language))
  const highlighted = validLang ? highlightjs.highlight(language, code).value : code
  return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`
}
renderer.heading = (text, level) => {
  const patt = /\s?{([^}]+)}$/
  let link = patt.exec(text)

  if (link && link.length && link[1]) {
    text = text.replace(patt, '')
    link = link[1]
  } else {
    link = text.toLowerCase().replace(/[^\wА-яіІїЇєЄ\u4e00-\u9eff一-龠ぁ-ゔァ-ヴー々〆〤\u3130-\u318F\uAC00-\uD7AF]+/gi, '-')
  }
  return '<h' + level + ' id="' + link + '">' + text + '</h' + level + '>'
}
marked.setOptions({ renderer })

async function getFile (path, cwd, convFn, dict) {
  cwd = cwd || process.cwd()
  const file = await readFile(resolve(cwd, path), 'utf-8')
  const converted = convFn(file)
  if (dict) {
    dict[path] = converted
  }
  return converted
}

const converters = {
  md: f => {
    const file = fm(f)
    return {
      attrs: file.attributes,
      body: marked(file.body)
    }
  },
  json: JSON.parse,
  yaml: YAML.parse
}

async function getFiles (ext, cwd, fn) {
  let paths = await glob('*/**/*' + ext, {
    cwd: cwd,
    ignore: 'node_modules/**/*',
    nodir: false
  })
  let promises = []
  let files = {}
  paths.forEach((path) => {
    let promise = getFile(path, cwd, fn)
    promise.then((file) => {
      files[path] = file
    })
    promises.push(promise)
  })
  await Promise.all(promises)
  return files
}

let _DATA_FILES = {}
let _DOC_FILES = {}
async function loadFiles (cwd) {
  console.log('Building files...')
  cwd = cwd || process.cwd()

  // Construct doc pages
  _DOC_FILES = await getFiles('.md', cwd, converters.md)

  // Construct yaml endpoints
  _DATA_FILES = await getFiles('.yaml', cwd, converters.yaml)

  // Construct json endpoints
  const tmpJsonFiles = await getFiles('.json', cwd, converters.json)
  Object.keys(tmpJsonFiles).forEach(function (key) {
    _DATA_FILES[key] = tmpJsonFiles[key]
  })
}

// watch file changes
function watchFiles () {
  console.log('Watch file changes...')
  const options = {
    ignoreInitial: true,
    ignored: 'node_modules/**/*'
  }
  const chokidar = require('chokidar')
  // Yaml Pages
  chokidar.watch('*/**/*.yaml', options)
  .on('add', (path) => getFile(path, null, converters.yaml, _DATA_FILES))
  .on('change', (path) => getFile(path, null, converters.yaml, _DATA_FILES))
  .on('unlink', (path) => delete _DATA_FILES[path])
  // Json Pages
  chokidar.watch('*/**/*.json', options)
  .on('add', (path) => getFile(path, null, converters.json, _DATA_FILES))
  .on('change', (path) => getFile(path, null, converters.json, _DATA_FILES))
  .on('unlink', (path) => delete _DATA_FILES[path])
  // Doc Pages
  chokidar.watch('*/**/*.md', options)
  .on('add', (path) => getFile(path, null, converters.md, _DOC_FILES))
  .on('change', (path) => getFile(path, null, converters.md, _DOC_FILES))
  .on('unlink', (path) => delete _DOC_FILES[path])
}

// Server handle request method
const server = micro(async function (req, res) {
  let baseUrl = /* process.env.NOW_URL || */((req.protocol || req.headers['x-forwarded-proto'] || (isDev ? 'http' : 'https')) + '://' + req.headers.host)

  // If github hook
  if (req.method === 'POST' && req.url === '/hook') {
    try {
      return await githubHook({ req, res }, loadFiles)
    } catch (e) {
      console.error('Error!')
      console.error(e)
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }

  // remove first /
  let path = req.url.slice(1)

  // Check if doc exists and send back doc content
  const docPath = path + '.md'
  if (_DOC_FILES[docPath]) {
    return send(res, 200, _DOC_FILES[docPath])
  }

  // Check if yaml exists and send back yaml content
  const yamlPath = path + '.yaml'
  if (_DATA_FILES[yamlPath]) {
    return send(res, 200, _DATA_FILES[yamlPath])
  }

  // Check if json exists and send back json content
  const jsonPath = path + '.json'
  if (_DATA_FILES[jsonPath]) {
    return send(res, 200, _DATA_FILES[jsonPath])
  }

  if (path === '') {
    const docRefs = Object.keys(_DOC_FILES).map(m => baseUrl + '/' + m.substring(0, m.lastIndexOf('.')))
    const dataRefs = Object.keys(_DATA_FILES).map(m => baseUrl + '/' + m.substring(0, m.lastIndexOf('.')))
    const data = {
      docs: {
        count: docRefs.length,
        links: docRefs
      },
      data: {
        count: dataRefs.length,
        links: dataRefs
      }
    }
    return send(res, 200, data)
  }

  // Return a 404 not found error
  return send(res, 404, 'File not found')
})

loadFiles()
  .then(() => {
    if (process.env.NODE_ENV !== 'production') {
      watchFiles()
    }
    server.listen(port)
    console.log(`Server listening on localhost:${port}`)
  })
