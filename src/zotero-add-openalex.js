// import zotero-lib
const Zotero = require('zotero-lib');
const openalex = require('openalex-sdk');
const fs = require('fs');

// create a new Zotero object

function getids(newlocation) {
  const res = newlocation.match(/^zotero\:\/\/select\/groups\/(library|\d+)\/(items|collections)\/([A-Z01-9]+)/);
  let x = {};
  if (res) {
    x.key = res[3];
    x.type = res[2];
    x.group = res[1];
  } else {
    x.key = newlocation;
  }
  return x;
};

// get command line arguments
const argv = process.argv.slice(2);

if (argv.h || argv.help) {
  console.log('Usage: node zotero-add-openalex.js <keys>');
  console.log('Options:');
  console.log('  -h, --help  Show this message');
  process.exit(0);
}

// node src/zotero-add-openalex.js zotero://select/groups/2259720/items/KC9QZIIF
/* Goal: 
- fetch zotero item from zotero
- see whether it has an openalex id
- if yes, get the openalex item and save it as json
- attach the openalex json to the zotero item
*/
async function main() {
  for (const key of argv) {
    console.log(key);
    x = getids(key);
    //console.log(x);
    const zotero = new Zotero({"group_id": x.group});
    const item = await zotero.item({"group_id": x.group, key: x.key});
    console.log(JSON.stringify(item));
    // openalex:W3211651715
    const openalex_id = getopenalex(item);
    // const openalex_id = zotero.openalex(item);
    openalex_item = await openalex.item({"id": openalex_id});
    // save openalex item to file
    fs.writeFileSync(openalex_id + '.json', JSON.stringify(openalex_item));
    // upload openalex item to zotero
    const result = await zotero.item({"group_id": x.group, key: x.key, attachfile: openalex_id + '.json'});
  }
}

main();
