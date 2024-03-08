#!/usr/bin/env node
const Zotero = require('zotero-lib');
const OpenAlex = require('openalex-sdk').default;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const jq = require('node-jq');
const fs = require('fs');

const argv = yargs(hideBin(process.argv))
    .demandCommand(0)
    .demandOption(['group'])
    .usage('Usage: zotero-openalex-connect.js --group 123 <keys> The script tries to match a zotero item with an openalex item via: an existing openalex id, via the doi, via the title.')
    .help()
    .check((argv) => {
        if (argv._.length === 0) {
            throw new Error('At least one argument is required.');
        }
        return true;  // Indicate that the check has passed
    }).parse();

console.log(argv._);

const zotero = new Zotero({ group_id: argv.group });
const openalex = new OpenAlex();

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

function get_oa_from_item(item) {
    const callnumber = item.callNumber;
    const extra = [callnumber, ...item.extra.split("\n")];
    let o = {};
    for (xx of extra) {
        if (xx && xx != '') {
            const y = xx.split(/: ?/);
            if (y[0] == 'openalex') {
                o[y[1]] = 1;
            };
        };
    };
    return Object.keys(o);
}

async function attachTagIfNeeded(item, files) {
    const id = item.key;
    // console.log(JSON.stringify(item, null, 4));
    const searchtags = ["openalex:yes", "openalex:n:" + files.length];
    filter = ' [ .tags .[] | select( ' +
        searchtags.map(f => '.tag == "' + f + '"').join(' or ') +
        ') ] | length ';
    // console.log(filter);
    const number = await jq.run(
        filter,
        item,
        { input: 'json', output: 'json' });
    // console.log(number);
    const tagExists = number > 0;
    if (tagExists) {
        console.log("tag already exists for " + id);
    } else {
        console.log("adding tag for " + id);
        const result1 = await zotero.item({ key: item.key, addtags: searchtags });
    };

}

async function attachOpenAlexJsonIfNeeded(id, files) {
    const result1 = await zotero.item({ key: id, children: true });
    // console.log(JSON.stringify(result1, null, 4));
    filter = ' [ .[].data | select( ' +
        files.map(f => '.filename == "' + f + '"').join(' or ') +
        ') ] | length ';
    // console.log(filter);
    const number = await jq.run(
        filter,
        result1,
        { input: 'json', output: 'json' });
    // console.log(number);
    const childExists = number > 0;
    if (childExists) {
        console.log("openalex json already exists for " + id);
    } else {
        console.log("Creating openalex json for " + id);
        const result2 = await zotero.item({ key: id, addfiles: files });
    };
};

async function getOpenAlexJsonFromOpenAlexID(oa) {
    let files = [];
    for (openalex_id of oa) {
        const openalex_item = await openalex.work(openalex_id);
        fs.writeFileSync(openalex_id + '.json', JSON.stringify(openalex_item, null, 4));
        files.push(openalex_id + '.json');
    }
    return files;
};

async function getOpenAlexJsonFromDOI(item) {
    return await getOpenAlexJsonFromTitleOrDOI(item, true);
}

async function getOpenAlexJsonFromTitle(item) {
    return await getOpenAlexJsonFromTitleOrDOI(item, false);
}

async function getOpenAlexJsonFromTitleOrDOI(item, fromdoi) {
    console.log(item.title);
    const title = encodeURIComponent(item.title.replace(/,/g, ' '));
    //  doi = zotero.get_doi_from_item(item);
    const doi = item.DOI;
    if (fromdoi && doi === '') {
        return { files: [], ids: [] };
    };
    const openalex_item = fromdoi ?
        await openalex.works({ "filter": { "doi": "https://doi.org/" + doi } }) :
        await openalex.works({ "searchField": "title", "search": title });
    console.log("Located: " + openalex_item.results.length);
    let files = [];
    let fullid = "";
    let fullids = [];
    for (i of openalex_item.results) {
        // compare lower case item.title with i.title
        if (fromdoi || item.title.toLowerCase() == i.title.toLowerCase()) {
            console.log("+ " + i.id + " " + i.title);
            // save openalex item to file
            fullid = i.id.replace(/.*\//g, '');
            fullids.push(fullid);
            const name = fullid + ".json";
            fs.writeFileSync(name, JSON.stringify(i, null, 4));
            // upload openalex item to zotero
            files.push(name);
        } else {
            console.log("X " + i.id + " " + i.title);
        }
    };
    // console.log(JSON.stringify(openalex_item, null, 4));
    // fs.writeFileSync(openalex_id + '.json', JSON.stringify(openalex_item, null, 4));
    const final = { files: files, ids: fullids };
    // console.log(JSON.stringify(final, null, 4));
    return final;
};

async function connectZoteroToOpenAlex(id) {
    const x = getids(id);
    const item = await zotero.item({ key: x.key });
    let files = [];
    let oaids = [];
    // Method 1: get the openalex id from the zotero item. If it exists, use it to update the zotero item
    oaids = get_oa_from_item(item);
    const itemhasOA = oaids.length > 0;
    if (oaids.length > 0) {
        console.log("Found openalex id(s) in item: " + oaids[0]);
        files = await getOpenAlexJsonFromOpenAlexID(oaids);
    } else {
        // Method 2: get openalex json from the doi
        const res = await getOpenAlexJsonFromDOI(item);
        files = res.files;
        oaids = res.ids;

        if (files && files.length > 0) {
            console.log("Found openalex id(s) from doi: " + oaids[0]);
        } else {
            // Method 3: get openalex json from the title
            const res2 = await getOpenAlexJsonFromTitle(item);
            // console.log(JSON.stringify(res2, null, 4));
            files = res2.files;
            oaids = res2.ids;
        };
    };
    // Finally update.
    // upload openalex items to zotero
    console.log(files)
    console.log(oaids);
    if (files && files.length > 0) {
        await attachTagIfNeeded(item, files);
        await attachOpenAlexJsonIfNeeded(x.key, files);
        if (!itemhasOA) {
            if (item.callNumber === '') {
                console.log("Updating call number for " + x.key);
                const r2 = await zotero.field({ key: x.key, field: "callNumber", value: "openalex:" + oaids[0] });
            };
            console.log("Updating extra for " + x.key);
            const extra = item.extra + "\n" + oaids.map(f => "openalex: " + f).join("\n");
            const r3 = await zotero.field({ key: x.key, field: "extra", value: extra });
        };
    };
    const final = { files: files, ids: oaids };
    return final;
    // console.log(result);
};

async function getCitationsAndRelated(input, collections) {

}

async function makeZoteroCollections(url) {
    let collections = {
        "openalex": "",
        "openalex-cites": "",
        "openalex-citedby": "",
        "openalex-related": ""
    };
    return collections;
};

(async () => {
    for (const id of argv._) {
        // Get OpenAlex json from Zotero item
        const result = await connectZoteroToOpenAlex(id);
        if (result.files.length > 0) {
            const collections = await makeZoteroCollections("zotero://select/groups/5404066/collections/R73YVXQ6");
            const res2 = await getCitationsAndRelated(result, collections);
        };

    };
})();
