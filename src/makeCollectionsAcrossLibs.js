#!/usr/bin/env node
const Zotero = require('zotero-lib');
const OpenAlex = require('openalex-sdk').default;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const jq = require('node-jq');
const fs = require('fs');
const { log, group } = require('console');
let zotero = new Zotero();


const argv = yargs(hideBin(process.argv))
    .demandCommand(0)
    .usage('Usage: collectionWalker.js <key1> <key2>')
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
        const subfolders = await zotero.collections({ key: folderId });
        const folderText = await zotero.items({ collection: folderId, top: true });
        results.push({ path: numbering, depth: depth, name: await getName(folderId), contents: folderText.map(item => item.key) });

        // sort subfolders by data.name
        const ordered = subfolders.sort((a, b) => a.data.name.localeCompare(b.data.name));

        for (let i = 0; i < subfolders.length; i++) {
            const newNumbering = `${numbering}.${i + 1}`;
            await walkThroughFolders(ordered[i].key, depth + 1, newNumbering, results);
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
    return results; // Return the accumulated results
};

function getids(newlocation) {
    const res = newlocation.match(
        /\/groups\/(library|\d+)\/(items|collections)\/([A-Z01-9]+)/
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
    const extra = item.extra.split('\n');
    let o = {};
    let k = [];
    for (xx of extra) {
        if (xx && xx != '') {
            const y = xx.match(/^(\S+): ?(.*)$/);
            // console.log(y);
            if (y && y[1] == 'KerkoCite.ItemAlsoKnownAs') {
                o[y[1]] = y[2];
                k = y[2].split(' ');
                return k;
            }
        }
    }
    return k;
}

const compare = async (items1, items2, g1, g2) => {
    //    "extra": "KerkoCite.ItemAlsoKnownAs: 4804264:RTG22INT",
    //  "relations": {  "owl:sameAs": "http://zotero.org/groups/4804264/items/RTG22INT" }

    const filter = "[ .[] | { key: .data.key, value: .data} ] | from_entries";
    const items1x = await jq.run(filter, items1, { input: 'json', output: 'json' });
    const items2x = await jq.run(filter, items2, { input: 'json', output: 'json' });
    //console.log("--> "+JSON.stringify(items2x, null, 4));
    //process.exit(0);
    let rel = { "keys": [], "in": {}, "out": {} };
    Object.keys(items1x).forEach((i) => {
        rel.keys.push(`${g1}:${i}`);
    });
    for (i of items1) {
        const lib = i.library.id;
        //console.log(lib + ":" + i.data.key);
        let x = get_oa_from_item(i.data);
        if (i.data["relations"]["owl:sameAs"]) {
            const owl = i.data["relations"]["owl:sameAs"];
            const n = typeof (i.data["relations"]["owl:sameAs"]) == "string" ? [owl] : owl;
            // [...i.data["relations"]["owl:sameAs"]];
            // console.log(n);
            //      console.log(x);
            for (xx of n) {
                const a = xx.split('/');
                x.push(a[a.length - 3] + ":" + a[a.length - 1]);
            };
            //            console.log(x);
        }
        // console.log("- "+JSON.stringify());
        let decider = false;
        for (xx of x) {
            const iii = xx.split(':');
            if (items2x[iii[1]]) {
                if (iii[0] == g2) {
                    rel.out[lib + ":" + i.data.key] = iii[0] + ":" + iii[1];
                    rel.in[iii[0] + ":" + iii[1]] = lib + ":" + i.data.key;
                    //console.log("- | " + iii[0] + ":" + iii[1]);
                    decider = true;
                };
            } else {
                //console.log("- x " + iii[0] + " " + iii[1]);
            }
        };
        /* if (!decider) {
             console.log("  1->?: " + i.data.key);
         } else {
             console.log("  1->2: " + i.data.key);
         }*/
    };
    return rel;
};

function zoto(g, k) {
    return `zotero://select/groups/${g}/items/${k}`;
}


function zotor(k) {
    const kk = k.split(':');
    return `zotero://select/groups/${kk[0]}/items/${kk[1]}`;
};

function zolib(k, v, title) {
    return `zotero-lib attach-link --key ${zotor(k)} --url ${zotor(v)} --title "${title}"`;
};


function linker(k, v) {
    const t1 = "View item in WB library";
    const t2 = "View item in OpenDevEd public library";
    return [zolib(k, v, t1), zolib(v, k, t2)];
};

function display(rel1, rel2, g1, g2, linkit) {
    console.log(`Comparing ${g1} -> ${g2}`);
    let commands = [];
    for (k of rel1.keys) {
        if (!rel1.out[k]) {
            console.log(`Key ${k} -> ??? `);
            if (rel2.in[k]) {
                console.log(`    ${k} <- ${rel2.in[k]}`);
                commands = [...commands, ...linker(k, rel2.in[k])];
            } else {
                console.log(`    ${k} <-??? (error)`);
            }
        } else {
            commands = [...commands, ...linker(k, rel1.out[k])];
        }
    };
    // write commands to file
    if (linkit) {
        const f1 = `links_${g1}-${g2}.sh`;
        fs.writeFileSync(f1, commands.join("\n") + "\n");
    } else {
    }
    console.log("-------------------------");
};



async function compareCollections(argv0, argv1) {
    const x = getids(argv0);
    const y = getids(argv1);
    const f1 = `items_${x.group}-${x.key}.json`
    const f2 = `items_${y.group}-${y.key}.json`
    // check f1 exists:
    // check f2 exists:
    if (!fs.existsSync(f1)) {
        zotero1 = new Zotero({ group_id: x.group });
        const items1 = await zotero1.items({ collection: x.key, top: true, fullresponse: false });
        fs.writeFileSync(f1, JSON.stringify(items1, null, 4));
    };
    if (!fs.existsSync(f2)) {
        zotero2 = new Zotero({ group_id: y.group });
        const items2 = await zotero2.items({ collection: y.key, top: true, fullresponse: false });
        // write items1 to file
        fs.writeFileSync(f2, JSON.stringify(items2, null, 4));
    };
    const items1 = JSON.parse(fs.readFileSync(f1));
    const items2 = JSON.parse(fs.readFileSync(f2));
    console.log(items1.length);
    console.log(items2.length);
    const rel1 = await compare(items1, items2, x.group, y.group);
    const rel2 = await compare(items2, items1, y.group, x.group);
    console.log("-------------------------");
    display(rel1, rel2, x.group, y.group, true);
    display(rel2, rel1, y.group, x.group, false);
    // console.log(JSON.stringify(rel1, null, 4));
    //console.log(JSON.stringify(rel2, null, 4));
    /* for (k of Object.keys(rel1.out)) {
        console.log(`${k} -> ${rel1.out[k]}`);
    };
    for (k of Object.keys(rel2.out)) {
        // console.log(`${k} -> ${rel2.out[k]}`);
    };
    */
};

async function analyseAndAddToExtra(line) {
    line = line.trim();
    if (!line) return;

    const x = getids(line);
    const zot = new Zotero({ group_id: x.group });
    const item = await zot.item({ group: x.group, key: x.key });
    /*
    "relations": {
    "owl:sameAs": "http://zotero.org/groups/2486141/items/WYE6VGNR"
    },
    */
    const i = item.relations["owl:sameAs"];
    // http://zotero.org/groups/2259720/items/N7FPNRRH
    if (i) {
        console.log(i)
        const y = getids(i);
        const zot2 = new Zotero({ group_id: y.group });
        const newitem = await zot2.item({ key: y.key });
        const extra = newitem.extra;
        const locate = `${x.group}:${x.key}`;
        if (!extra.match(/KerkoCite.ItemAlsoKnownAs: [^\n]*${locate}[^\n]*/)) {
            const newextra = extra.replace(/KerkoCite.ItemAlsoKnownAs: ?/, `KerkoCite.ItemAlsoKnownAs: ${locate} `);
            console.log(newextra);
            const res = await zot2.field({ key: y.key, field: 'extra', value: extra });
            console.log(res);
        }
    }
};


async function main(name, file) {
    // Example usage
    // read file from argv0
    const list = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
    let collections = {};
    // Task 1: Make collections in groups, and add items:
    for (const line of list) {
        const x = getids(line);
        console.log(x);
        if (x.key && x.key != '') {
            if (!collections[x.group]) {
                // make new collection in x.group
                const zot = new Zotero({ group_id: x.group });
                const newCollection = await zot.collections({ create_child: [name], top: true });
                collections[x.group] = newCollection["0"].key;
            };
            // { group: '2259720', item: 'N7FPNRRH', addtocollection: 'HUEJ53Q4' }
            const zot = new Zotero({ group_id: x.group });
            const command = { key: x.key, addtocollection: [collections[x.group]] };
            //console.log(command);
            const res = await zot.item(command);
            //console.log(res);
            //console.log(collections);
        };
    }
    console.log(collections);
    // Task 2: Compare items.
    for (const line of list) {
        await analyseAndAddToExtra(line);
    };
    // await compareCollections('zotero://select/groups/4804264/collections/RTG22INT', 'zotero://select/groups/4804264/collections/RTG22INT');
}

// Example usage
(async () => {
    await main(argv._[0], argv._[1]);
})();

