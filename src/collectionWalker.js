#!/usr/bin/env node
const Zotero = require('zotero-lib');
const OpenAlex = require('openalex-sdk').default;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const jq = require('node-jq');
const fs = require('fs');
let zotero = new Zotero();

const argv = yargs(hideBin(process.argv))
    .demandCommand(0)
    .usage('Usage: collectionWalker.js <keys>')
    .help()
    .check((argv) => {
        if (argv._.length === 0) {
            throw new Error('At least one argument is required.');
        }
        return true;  // Indicate that the check has passed
    }).parse();

console.log(argv._);

const getFolderText = (folderId) => {
    // Simulate generating or retrieving text for a folder
    return `Contents of ${folderId}`;
};

const getName = async (collectionId) => {
    const options = {
        top: false,
        key: [collectionId],
        verbose: false,
      };
      // fetch the collection
      const result = await zotero.collection(options);
      console.log(JSON.stringify(result, null, 4));
      return result.data.name;
    };

const walkThroughFolders = async (folderId, depth = 1, numbering = '1', results = []) => {
    try {
        console.log(`Walking through ${folderId}`);
        const subfolders = await zotero.collections({key: folderId});
        const folderText = await zotero.items({collection: folderId, top: true});
        results.push({ path: numbering, depth: depth, name: await getName(folderId), contents: folderText.map(item => item.key) });

        // sort subfolders by data.name
        const ordered = subfolders.sort((a, b) => a.data.name.localeCompare(b.data.name));

        for (let i = 0; i < subfolders.length; i++) {
            const newNumbering = `${numbering}.${i + 1}`;
            await walkThroughFolders(ordered[i].key, depth+1, newNumbering, results);
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
    return results; // Return the accumulated results
};

function getids(newlocation) {
    const res = newlocation.match(
        /^zotero\:\/\/select\/groups\/(library|\d+)\/(items|collections)\/([A-Z01-9]+)/
    );
    let x = {};
    if (res) {
        x.key = res[3];
        x.type = res[2];
        x.group = res[1];
    } else {
        x.key = newlocation;
    }
    return x;
}

// Example usage
(async () => {
    const x = getids(argv._[0]);
    zotero = new Zotero({ group_id: x.group });
    const folderContents = await walkThroughFolders(argv._[0]);
    console.log(JSON.stringify(folderContents, null, 4));
    //write folderContents to file
    fs.writeFileSync(`collection_${x.group}-${x.key}.json`, JSON.stringify(folderContents, null, 4));
})();
