const micro = require('micro')
// const crypto = require('crypto')
const os = require('os')
const uuid = require('uuid/v4')
const pify = require('pify')
const rimraf = pify(require('rimraf'))
const { join, resolve } = require('path')
const fs = require('fs')
const simpleGit = require('simple-git')
const send = micro.send

// Refresh files (pull from GitHub)
module.exports = async function ({ req, res }, loadFiles) {
  let clonePath = resolve(os.tmpdir(), uuid())

  fs.mkdirSync(clonePath)
  const repoPath = `https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO}.git`
  let git = simpleGit(clonePath)

  // clone the repo
  console.log(`Cloning repository: ${process.env.GITHUB_REPO} ...`)
  await git.clone(repoPath, 'repo')

  // update the file system
  console.log('Updating contents of repository')
  const localPath = join(clonePath, 'repo')
  fs.writeFileSync(localPath + '/en/commit.yaml', 'id: ' + uuid())

  // push changes
  console.log('Pushing changes to repository')
  await simpleGit(localPath)
          .add('./*')
          .commit('Automated commit')
          .push('origin', 'master')

  console.log('Contents updated!')
  await rimraf(clonePath)
  send(res, 200, 'OK')
}
