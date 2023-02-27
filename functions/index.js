// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const util = require('util');

//REPLACE WITH RESPECTIVE IDs
const PLAID_CLIENT_ID = '633b540e3977df00141a0f43';
const PLAID_SECRET = 'f7fa971d3f350fa258d08ad750e2de';

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


exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

//WORKING CLOUD FUNCTIONS IN CENTIBLE ENVIRONMENT

//WORKING TRANSACTIONS SYNC FUNCTION
exports.getTransactionsCent = functions.https.onRequest(async (request, response) => {
  const ACCESS_TOKEN = request.body.access_token;
  console.log("Access Token: " + ACCESS_TOKEN);

  //Get account and itemID data
  const accountResponse = await client.accountsGet({
    access_token: ACCESS_TOKEN,
  });

  // Set cursor to empty to receive all historical updates
  let cursor = request.body.cursor == "" ? null : request.body.cursor;
  console.log("cursor: " + cursor);

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
    //console.log("data: " + data.added);
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
  response.json({
    cursor: cursor,
    accounts: accountResponse.data.accounts,
    item: accountResponse.data.item,
    transactions: recently_added
  });
})

exports.createLinkTokenCent = functions.https.onRequest(async (request, response, next) => {
  response.set('Access-Control-Allow-Origin', 'http://localhost:3000');

      const configs = {
        user: {
          // This should correspond to a unique id for the current user.
          client_user_id: request.body.user.client_user_id,
        },
        client_name: request.body.client_name,
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
        account_filters: request.body.account_filters
      };

      const createTokenResponse = await client.linkTokenCreate(configs);
      prettyPrintResponse(createTokenResponse);
      response.json(createTokenResponse.data);

});

exports.exchangeTokenCent = functions.https.onRequest(async (request, response, next) => {
  response.set('Access-Control-Allow-Origin', 'http://localhost:3000');

  PUBLIC_TOKEN = request.body.public_token;
  console.log("PUBLIC_TOKEN: " + PUBLIC_TOKEN);

  const tokenResponse = await client.itemPublicTokenExchange({
    public_token: PUBLIC_TOKEN,
  });

  prettyPrintResponse(tokenResponse);

  ACCESS_TOKEN = tokenResponse.data.access_token;
  ITEM_ID = tokenResponse.data.item_id;

  if (PLAID_PRODUCTS.includes('transfer')) {
    TRANSFER_ID = await authorizeAndCreateTransfer(ACCESS_TOKEN);
  }

  response.json({
    access_token: ACCESS_TOKEN,
    item_id: ITEM_ID,
    error: null,
  });
});

