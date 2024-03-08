const fs = require('fs');
const path = require('path');
__dirname;
const jq = require('node-jq');

const jqpath = path.join(__dirname, 'jq', 'openalex-to-zotero.jq');
async function zoteroTransformOpenAlex(openAlexArray) {
  // const filterfile = 'jq/openalex-to-zotero.jq';
  return await zoteroTransformGeneric(jqpath, openAlexArray);
}

async function zoteroTransformGeneric(filterfile, inArray) {
  console.log(inArray);
  const filter = fs.readFileSync(filterfile, 'utf8');
  fs.writeFileSync('temp.json', JSON.stringify(inArray));
  const data = await jq.run(filter, inArray, {
    input: 'json',
    output: 'json',
  });
  return data;
}

module.exports = {
  zoteroTransformOpenAlex,
};
