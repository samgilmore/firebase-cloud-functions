# Plaid Firebase Cloud Functions
Testing and deploying Plaid functions using Firebase Cloud

## Three Endpoints to achieve Transactions List

### "createLinkToken"
• Creates a new link token with unique user ID

### "exchangeToken"
• Exchange public token for access token

### "getTransactions"
• Uses access token to output transaction data


##To test

Follow the steps in Firebase docs:
https://firebase.google.com/docs/functions/get-started

1. Create a Firebase Project
2. Set up Node.js and the Firebase CLI
3. Initialize your project
4. Run the emulator using ```firebase emulators:start```

**NOTE: You will need to change the Plaid API keys at the top of index.js to correspond with your Plaid account**
