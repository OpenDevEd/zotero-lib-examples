const OpenAlex = require('openalex-sdk').default;
const openalex = new OpenAlex();
const jq = require('node-jq');

const searchnumber = 0;
const searches = [
    {
        search: 'Kenya',
        searchField: 'title',
        "sortBy": {
            field: 'relevance_score',
            order: 'desc',
        },
    },
    {
        "filter": { "sustainable_development_goals": { "id": "https://metadata.un.org/sdg/13" } },
    },
    {
        search: 'Kenya',
        searchField: 'title',
        "filter": { "sustainable_development_goals": { "id": "https://metadata.un.org/sdg/13" } },
        "sortBy": {
            field: 'relevance_score',
            order: 'desc'
        }
    }
];

async function main() {
    const res = await openalex.works(searches[searchnumber]);
    console.log("results: " + res.meta.count);
    const filter = '[ .[] | { title: .title, primary_topic: .primary_topic, topics: .topics, keywords: .keywords, concepts: .concepts, sustainable_development_goals: .sustainable_development_goals } ]';
    const res2 = await jq.run(filter, res.results, { input: 'json', output: 'pretty' });
    console.log(res2);
};

(async () => {
    await main();
})();
