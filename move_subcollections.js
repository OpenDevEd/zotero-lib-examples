/*
Testing record creation.
*/
const Zotero = require('zotero-lib');
const fs = require('fs');
const zotero = new Zotero({ 'group-id': 2405685 });
const fetch = require('node-fetch');  // Add this at the top of your file if using Node.js


function mapCollectionData(collection) {
  return {
    name: collection.data.name,
    key: collection.data.key,
    version: collection.data.version
  };
}

function mapItemData(item) {
  return {
    key: item.data.key,
    version: item.data.version
  };
}

async function moveSubcollection(subcollection, extractedKey) {
  console.log('Moving subcollection:', subcollection.name);
  const groupId = "2405685";
  // Prepare the update data


  try {
    // Update the subcollection
    const result = await patch(groupId, subcollection.key, extractedKey, subcollection.version);
    console.log('result=' + JSON.stringify(result, null, 2));
    console.log(`Moved subcollection ${subcollection.name} to new parent ${extractedKey}`);
    // process.exit(0);
    return { success: true };
  } catch (error) {
    console.error(`Failed to move subcollection ${subcollection.name}:`, error);
  }
}


async function patch(groupId, collectionKey, newParent, lastModifiedVersion) {
  const updateData = {
    parentCollection: newParent,
    version: lastModifiedVersion
  };

  const apiKey = "Qf9wIhYEWuqpfKqqOWLxUxVT";

  // Step 2: Include the version in the PATCH request
  try {
    const patchResponse = await fetch(`https://api.zotero.org/groups/${groupId}/collections/${collectionKey}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Zotero-API-Version': '3',
        'Zotero-API-Key': apiKey
        //        'If-Unmodified-Since-Version': lastModifiedVersion,  // Adding the precondition header
      },
      body: JSON.stringify(updateData),
    });

    if (!patchResponse.ok) {
      throw new Error(`Request failed with status ${patchResponse.status}: ${patchResponse.statusText}`);
      return { error: "Error" };
    }

    // return await patchResponse.json();
    return { success: true };
  } catch (error) {
    console.error('Error:', error);
    return { error: error.message };
  }
};


async function move(c) {
  // console.log('c=' + JSON.stringify(c, null, 2));
  const extractedKey = c.name.split('/').pop();
  const result = await zotero.collections({
    key: c.key
  });
  console.log('Extracted key:', extractedKey);
  //  console.log('result=' + JSON.stringify(result, null, 2));
  const subcollections = result.map(mapCollectionData);

  for (const subcollection of subcollections) {
    await moveSubcollection(subcollection, extractedKey)
    // process.exit(0);
  }

  // the collections in r now need to be moved to extractedKey
  // process.exit(0);
  return { success: true };
}



async function moveItems(c) {
  const result = await zotero.items({
    collection: c.key,
    top: true
  });
  console.log(c.name);
  //  console.log('result=' + JSON.stringify(result.map(mapItemData), null, 2));
  const extractedKey = c.name.split('/').pop();
  console.log('Extracted key:', extractedKey);
  for (const item of result.map(mapItemData)) {
    await zotero.item({
      key: item.key,
      addToCollection: extractedKey
    })
  }

}

async function main() {
  const result = await zotero.collections({
    key: 'MP53N7NC',
  });

  const r = result.map(mapCollectionData);
  // console.log('r=' + JSON.stringify(r), null, 2));
  for (const c of r) {
    if (c.name.includes('zotero://')) {
      await move(c);
      await moveItems(c);
    }
  }




};

main();
