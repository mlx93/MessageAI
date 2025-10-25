# Get Firebase Service Account Key

The embedding script needs Firebase Admin credentials to access your Firestore database. Follow these steps:

## Quick Steps:

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/project/messageai-mlx93/settings/serviceaccounts/adminsdk
   
2. **Generate Private Key**
   - Click "Generate new private key" button
   - Click "Generate key" in the popup
   - A JSON file will download

3. **Save the Key**
   Save the downloaded file as:
   ```
   /Users/mylessjs/Desktop/MessageAI/functions/serviceAccountKey.json
   ```

4. **Run the Script**
   ```bash
   cd /Users/mylessjs/Desktop/MessageAI/functions
   node scripts/run-embed.js
   ```

## Important Security Notes:
- ⚠️ **NEVER commit this file to git** - it's already in .gitignore
- 🔒 This key has full admin access to your Firebase project
- 🗑️ Delete it after running the migration if you don't need it anymore

## Alternative: If you can't download the key
You can also install Google Cloud SDK and authenticate:
```bash
# Install gcloud SDK (if not installed)
brew install google-cloud-sdk

# Authenticate
gcloud auth application-default login

# Select your project
gcloud config set project messageai-mlx93
```

Then run the script without the service account key.
