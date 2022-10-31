// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const util = require('util');

//REPLACE WITH RESPECTIVE IDs
const PLAID_CLIENT_ID = '**PLAID CLIENT ID**';
const PLAID_SECRET = '**PLAID SECRET ID**';

const PLAID_ENV = 'sandbox';

// PLAID_PRODUCTS is a comma-separated list of products to use when initializing
// Link. Note that this list must contain 'assets' in order for the app to be
// able to create and retrieve asset reports.
const PLAID_PRODUCTS = ('auth,transactions').split(
  ',',
);

// PLAID_COUNTRY_CODES is a comma-separated list of countries for which users
// will be able to select institutions from.
const PLAID_COUNTRY_CODES = ('US,CA').split(
  ',',
);

// Parameters used for the OAuth redirect Link flow.
//
// Set PLAID_REDIRECT_URI to 'http://localhost:3000'
// The OAuth redirect flow requires an endpoint on the developer's website
// that the bank website should redirect to. You will need to configure
// this redirect URI for your client ID through the Plaid developer dashboard
// at https://dashboard.plaid.com/team/api.
const PLAID_REDIRECT_URI = '';

// Parameter used for OAuth in Android. This should be the package name of your app,
// e.g. com.plaid.linksample
const PLAID_ANDROID_PACKAGE_NAME = '';

// We store the access_token in memory - in production, store it in a secure
// persistent data store
let ACCESS_TOKEN = null;
let PUBLIC_TOKEN = null;
let ITEM_ID = null;
// The payment_id is only relevant for the UK Payment Initiation product.
// We store the payment_id in memory - in production, store it in a secure
// persistent data store
let PAYMENT_ID = null;
// The transfer_id is only relevant for Transfer ACH product.
// We store the transfer_id in memory - in production, store it in a secure
// persistent data store
let TRANSFER_ID = null;

const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
            'PLAID-SECRET': PLAID_SECRET,
            'Plaid-Version': '2020-09-14',
        }
    }
});

const client = new PlaidApi(configuration);

const prettyPrintResponse = (response) => {
  console.log(util.inspect(response.data, { colors: true, depth: 4 }));
};

//Create link token
exports.createLinkToken = functions.https.onRequest((request, response, next) => {
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
exports.getTransactions = functions.https.onRequest(async (request, response, next) => {
  
  //------------------------------------------------------------------
  //Create a sandbox access token for testing this transactions function.
  //In the future, we pass in an access token in the request body.

  const publicTokenResponse = await client.sandboxPublicTokenCreate({
    institution_id: 'ins_109508',
    initial_products: ['transactions'],
    //Can provide custom username to populate user with test data:
    //https://plaid.com/docs/sandbox/user-custom/
    // options: {
    //   override_username: 'custom_johnsmith'
    // }
  });

  const tokenResponse = await client.itemPublicTokenExchange({
    public_token: publicTokenResponse.data.public_token,
  });

  prettyPrintResponse(tokenResponse);

  ACCESS_TOKEN = tokenResponse.data.access_token;

  //------------------------------------------------------------------

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
      while (hasMore) {
        const request = {
          access_token: ACCESS_TOKEN,
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
        prettyPrintResponse(response);
      }

      const compareTxnsByDateAscending = (a, b) => (a.date > b.date) - (a.date < b.date);
      // Return the 8 most recent transactions
      const recently_added = [...added].sort(compareTxnsByDateAscending).slice(-8);
      response.json({latest_transactions: recently_added});
    })
    .catch(next);
})

//----------------------------------------------------------------------------------

// Test Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});