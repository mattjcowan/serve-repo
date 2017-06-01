/*
  obj is the object representation of a file:

  {
    path: '/path/to/the/file/on/disk/relative/to/the/repo/root,
    url: 'https://host/path/to/the/file/without/the/extension',
    contents: {
      ... this is the object representation of the contents of the file
          if the file is html/css/js this will be a string ...
    }
  }
 */

module.exports = {

  // the following mime types are accepted
  mimeTypes: [ '.md', '.yaml', '.json', '.html', '.css', '.js' ],

  // alter the structure of the initial doc list
  aggregatePreProcessingRules: (docs) => docs,

  // alter the contents of the file before it has been processed
  preProcessingRules: (path, rawContents) => rawContents,

  // alter the object representation of the file after it has been processed
  postProcessingRules: (path, rawContents, obj) => obj,

  // alter the final list of objects returned by the api
  aggregatePostProcessingRules: (objects) => objects,

  // allow for excluding certain files based on their path or processed contents
  excludeDocRules: (path, rawContents, obj) => false,

  defaultDocuments: [ 'index', 'default' ],

  // if no match is found, return a directory listing
  /* eg: /en/sub1/sub2 => { links: [ { name: 'file-abc', src: 'en/sub1/sub2/file-abc.yaml', mimeType: '.yaml', path: 'en/sub1/sub2/file-abc' }j, ... ] } */
  browse: true,

  // if the repo contains localized versions of it's files,
  // each top level folder should represent an ISO-2 language code
  language: false,
  defaultLanguage: 'en',

  // enable taxonomies
  taxonomies: true,
  taxonomyFields: [ 'category', 'tags', 'type' ],

  ids: true,
  idFields: [ 'id', '_id' ],

  slugs: true,
  slugFields: [ 'slug' ],

  draft: true,
  draftFields: [ 'draft' ],

  publish: true,
  publishFields: [ 'publish' ],

  auth: true

}
