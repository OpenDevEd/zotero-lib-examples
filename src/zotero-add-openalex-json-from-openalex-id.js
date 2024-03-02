// import zotero-lib
const Zotero = require('zotero-lib');
const OpenAlex = require('openalex-sdk').default;

const fs = require('fs');

// create a new Zotero object

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
async function main(key) {
  const openalex = new OpenAlex();
  console.log(key);
  const x = getids(key);
  //console.log(x);
  const zotero = new Zotero({ group_id: x.group });
  const item = await zotero.item({ group_id: x.group, key: x.key });
  let o = {};
  const arr = item.extra.split("\n");
  // console.log(arr);
  let oa = [];
  for (xx of arr) {
    const y = xx.split(/: ?/);
    o[y[0]] = y[1];
    if (y[0] == 'openalex') {
      oa.push(y[1]);
    };
  };
  console.log(o['openalex']);
  let files = [];
  if (oa.length > 0) {
    //if ('openalex' in o && o['openalex']!= '') {
    for (openalex_id of oa) {
      const openalex_item = await openalex.work(openalex_id);
      fs.writeFileSync(openalex_id + '.json', JSON.stringify(openalex_item, null, 4));
      files.push(openalex_id + '.json');
    }
  };
  // upload openalex items to zotero
  const tags = ["openalex:yes", "openalex:n:" + files.length];
  console.log("[[[");
  const result = await zotero.item({ "group_id": x.group, key: x.key, addfiles: files, addtags: tags });
  console.log("]]]");
  // console.log(result);
};
// openalex:W3211651715
//const openalex_id = getopenalex(item);
// const openalex_id = zotero.openalex(item);
//const openalex_id = 'W3211651715';
// openalex_item = await openalex.work(openalex_id);
// save openalex item to file
// fs.writeFileSync(openalex_id + '.json', JSON.stringify(openalex_item, null, 4));
// upload openalex item to zotero
// const result = await zotero.item({"group_id": x.group, key: x.key, addfiles: [ openalex_id + '.json' ] });


(async () => {
  for (const key of argv) {
    await main(key);
  };
})();
