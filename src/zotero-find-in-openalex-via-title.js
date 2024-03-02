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
        console.log(item.title);
        const title = encodeURIComponent(item.title.replace(/,/g, ' '));
        const openalex_item = await openalex.works({ "searchField": "title", "search": title });
        console.log(openalex_item.results.length);
        let out = [];
        let fullid = "";
        let fullids = "";
        for (i of openalex_item.results) {
            // compare lower case item.title with i.title
            if (item.title.toLowerCase() == i.title.toLowerCase()) {
                console.log("+ " + i.id + " " + i.title);
                // save openalex item to file
                fullid = i.id.replace(/.*\//g, '');
                fullids = fullids + "openalex: " +fullid + "\n";
                const name = fullid + ".json";
                fs.writeFileSync(name, JSON.stringify(i, null, 4));
                // upload openalex item to zotero
                out.push(name);
            } else {
                console.log("X " + i.id + " " + i.title);
            }
        };
        if (out.length > 0) {
            const tags = ["openalex:yes", "openalex:n:"+out.length];
            const result = await zotero.item({ "group_id": x.group, key: x.key, addfiles: out, addtags: tags });
            // console.log(result);
            if (item.callNumber === '') {
                const r2 = await zotero.field({ "group_id": x.group, key: x.key, field: "callNumber", value: "openalex:" + fullid });
            };
            const extra = item.extra + "\n" + fullids;
            const r3 = await zotero.field({ "group_id": x.group, key: x.key, field: "extra", value: extra });

        };
        // console.log(JSON.stringify(openalex_item, null, 4));
        // fs.writeFileSync(openalex_id + '.json', JSON.stringify(openalex_item, null, 4));
    };
}

(async () => {
    await main();
})();
