const micro = require('micro')
// const crypto = require('crypto')
const os = require('os')
const uuid = require('uuid/v4')
const pify = require('pify')
const rimraf = pify(require('rimraf'))
const { join, resolve } = require('path')
const fs = require('fs')
const simpleGit = require('simple-git/promise')
const send = micro.send

// Refresh files (pull from GitHub)
module.exports = async function ({ req, res }, loadFiles) {
  let clonePath = resolve(os.tmpdir(), uuid())

  fs.mkdirSync(clonePath)
  const repoPath = `https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO}.git`
  let git = simpleGit(clonePath)

  // clone the repo
  console.log(`Cloning repository: ${process.env.GITHUB_REPO} ...`)
  await git.init()
  await git.addConfig('user.name', process.env.GITHUB_USERNAME)
  await git.addConfig('user.email', process.env.GITHUB_EMAIL)
  await git.addRemote('origin', repoPath)
  await git.pull('origin', 'master')

  // update the file system
  console.log('Updating contents of repository')
  fs.appendFileSync(join(clonePath, 'en/commit.yaml'), '- id: ' + uuid() + '\n  time: ' + JSON.stringify(new Date()) + '\n')

  // push changes
  console.log('Pushing changes to repository')
  await git.add('./*')
  await git.commit('Automated commit')
  await git.push('origin', 'master')

  console.log('Contents updated!')
  await rimraf(clonePath)
  send(res, 200, 'OK')
}
