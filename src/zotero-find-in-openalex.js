// import zotero-lib
const Zotero = require('zotero-lib');
const OpenAlex = require('openalex-sdk').default;
const fs = require('fs');

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

const argv = process.argv.slice(2);

async function main() {
    const openalex = new OpenAlex();
    for (const key of argv) {
        console.log(key);
        const x = getids(key);
        //console.log(x);
        const zotero = new Zotero({ group_id: x.group });
        const item = await zotero.item({ group_id: x.group, key: x.key });
        const title = encodeURIComponent(item.title);
        const openalex_item = await openalex.works({"searchField":"title", "search":title });
        console.log(JSON.stringify(openalex_item, null, 4));
        // fs.writeFileSync(openalex_id + '.json', JSON.stringify(openalex_item, null, 4));
    };
}

(async () => {
    await main();
})();
