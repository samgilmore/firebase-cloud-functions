//Create link token
exports.createLinkToken = functions.https.onRequest((request, response, next) => {
    response.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  
    Promise.resolve()
      .then(async function () {
        const configs = {
          user: {
            // This should correspond to a unique id for the current user.
            client_user_id: 'user-id',
          },
          client_name: 'Plaid Quickstart',
          products: PLAID_PRODUCTS,
          country_codes: PLAID_COUNTRY_CODES,
          language: 'en',
        };
  
        const createTokenResponse = await client.linkTokenCreate(configs);
        prettyPrintResponse(createTokenResponse);
        response.json(createTokenResponse.data);
      })
      .catch(next);
  });
  
  //Exchange public token for access token
  exports.exchangeToken = functions.https.onRequest(async (request, response, next) => {
    response.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  
    PUBLIC_TOKEN = request.body.public_token;
    console.log("PUBLIC_TOKEN: " + PUBLIC_TOKEN);
  
    Promise.resolve()
      .then(async function () {
        const tokenResponse = await client.itemPublicTokenExchange({
          public_token: PUBLIC_TOKEN,
        });
  
        prettyPrintResponse(tokenResponse);
  
        ACCESS_TOKEN = tokenResponse.data.access_token;
        ITEM_ID = tokenResponse.data.item_id;
  
        if (PLAID_PRODUCTS.includes('transfer')) {
          TRANSFER_ID = await authorizeAndCreateTransfer(ACCESS_TOKEN);
        }
  
        //Instead of persisting the access token in the firestore, we will store it in iOS keychain.
        //This is for testing purposes only.
        // try { 
        //   await admin.firestore().doc('users/' + ITEM_ID).set({"fcmToken": "missing fcm token", "access_token": ACCESS_TOKEN});
        // } catch (error) {
        //   console.log("Firebase error: " + error);
        // }
  
        response.json({
          access_token: ACCESS_TOKEN,
          item_id: ITEM_ID,
          error: null,
        });
      })
      .catch(next);
  });
  
  
  //Get Transactions with new sync endpoint
  //NOT WORKING
  exports.transactions = functions.https.onRequest((request, response, next) => {
  
    cors(request, response, () => {
      Promise.resolve()
      .then(async function () {
  
        // Set cursor to empty to receive all historical updates
        let cursor = null;
        // New transaction updates since "cursor"
        let added = [];
        let modified = [];
        // Removed transaction ids
        let removed = [];
        let hasMore = true;
        // Iterate through each page of new transaction updates for item
  
        //In the future, we will pull this access token from iOS keychain. 
        //This is for testing purposes only.
        // try { 
        //   //await admin.firestore().doc('users/' + ITEM_ID).set({"fcmToken": "missing fcm token", "access_token": ACCESS_TOKEN});
        //   const query = await admin.firestore().collection('users').doc('5m6K3re7PmTAKRZNJ4r1cDyoxQ63lBfZlroaa').get();
        //   //console.log(query.data());
        //   if (!query.exists) {
        //     console.log('No such document!');
        //   } else {
        //     ACCESS_TOKEN = query.data().access_token;
        //     console.log('Access Token:', ACCESS_TOKEN);
        //   }
        // } catch (error) {
        //   console.log("Firebase error: " + error);
        // }
  
        while (hasMore) {
          const request = {
            access_token: request.body.access_token,
            cursor: cursor,
          };
          const response = await client.transactionsSync(request)
          const data = response.data;
          // Add this page of results
          added = added.concat(data.added);
          modified = modified.concat(data.modified);
          removed = removed.concat(data.removed);
          hasMore = data.has_more;
          // Update cursor to the next cursor
          cursor = data.next_cursor;
          //prettyPrintResponse(response);
        }
  
        const compareTxnsByDateAscending = (a, b) => (a.date > b.date) - (a.date < b.date);
        // Return the 8 most recent transactions
        const recently_added = [...added].sort(compareTxnsByDateAscending).slice(-8);
        response.json({latest_transactions: recently_added});
      })
      .catch(next);
    })
  })
  
  //----------------------------------------------------------------------------------
  
  // Test Cloud Functions
  // https://firebase.google.com/docs/functions/write-firebase-functions
  
  //Exchange public token for access token
  exports.exchangeTokenTest = functions.https.onRequest(async (request, response, next) => {
    /*
      "Use the /sandbox/public_token/create endpoint to create a valid public_token for an 
      arbitrary institution ID, initial products, and test credentials. The created 
      public_token maps to a new Sandbox Item. You can then call /item/public_token/exchange 
      to exchange the public_token for an access_token and perform all API actions."
      - https://plaid.com/docs/api/sandbox/
    */
    const publicTokenResponse = await client.sandboxPublicTokenCreate({
      institution_id: 'ins_109508',
      initial_products: ['transactions']
    });
    
    console.log(publicTokenResponse.data.public_token);
    Promise.resolve()
      .then(async function () {
        const tokenResponse = await client.itemPublicTokenExchange({
          public_token: publicTokenResponse.data.public_token,
        });
  
        prettyPrintResponse(tokenResponse);
  
        ACCESS_TOKEN = tokenResponse.data.access_token;
        ITEM_ID = tokenResponse.data.item_id;
  
        response.json({
          access_token: ACCESS_TOKEN,
          item_id: ITEM_ID,
          error: null,
        });
      })
      .catch(next);
  });
  
  //Get Transactions with new sync endpoint
  exports.transactionsTest = functions.https.onRequest((request, response, next) => {
    Promise.resolve()
      .then(async function () {
  
        //------------------------------------------------------------------
        //Create a sandbox access token for testing this transactions function.
        //In the future, we pass in an access token in the request body.
  
        const publicTokenResponse = await client.sandboxPublicTokenCreate({
          institution_id: 'ins_109508',
          initial_products: ['transactions'],
          //Can provide custom username to populate user with test data:
          //https://plaid.com/docs/sandbox/user-custom/
          options: {
            override_username: 'custom_johnsmith'
          }
        });
      
        const tokenResponse = await client.itemPublicTokenExchange({
          public_token: publicTokenResponse.data.public_token,
        });
      
        ACCESS_TOKEN = tokenResponse.data.access_token;
  
        //------------------------------------------------------------------
  
        // Set cursor to empty to receive all historical updates
        let cursor = null;
        // New transaction updates since "cursor"
        let added = [];
        let modified = [];
        // Removed transaction ids
        let removed = [];
        let hasMore = true;
        // Iterate through each page of new transaction updates for item
        while (hasMore) {
          const request = {
            access_token: ACCESS_TOKEN,
            cursor: cursor,
          };
          const response = await client.transactionsSync(request)
          const data = response.data;
          console.log("data: " + data.added);
          // Add this page of results
          added = added.concat(data.added);
          modified = modified.concat(data.modified);
          removed = removed.concat(data.removed);
          hasMore = data.has_more;
          // Update cursor to the next cursor
          cursor = data.next_cursor;
          prettyPrintResponse(response);
        }
  
        const compareTxnsByDateAscending = (a, b) => (a.date > b.date) - (a.date < b.date);
        // Return the 8 most recent transactions
        const recently_added = [...added].sort(compareTxnsByDateAscending).slice(-8);
        response.json({latest_transactions: recently_added});
      })
      .catch(next);
  })