Debugging

node --inspect <your_file>.js
open “about:inspect” in Google Chrome

```
Running:

- npm install
- Move the ../client/build directory to the server directory
- Run build.sh in ../emscripten to get the WebAssembly files in to the build directory
- CAPTCHA_SECRET_KEY=xxxxxx GOOGLE_CLOUD_PROJECT=xxxx GOOGLE_APPLICATION_CREDENTIALS=../xxxx.json PORT=8000 npm start
- deploy with gcloud app deploy --verbosity=info

Add indices to firebase rules, e.g.:

{
  "rules": {
    ".read": false,
    ".write": false,  
    "pending": {
      ".indexOn": ["timestamp"]
    },
    "songs": {
      ".indexOn": ["timestamp"]
    }
  }
}

References:
ReCAPTCHA https://www.google.com/recaptcha/admin#list and add secret key to app.yaml (NOTE: Should really use datastore)
env_variables:
 CAPTCHA_SECRET_KEY: sdfkasghfjasWHATEVERgfakjshdgfasjkdfg
Firebase https://console.firebase.google.com/project/xxxx/database/xxxx/data
Go to https://console.cloud.google.com/appengine, click Settings at the lower-left, and enable/disable
Go to https://console.cloud.google.com/appengine/settings to setup cloud storage
Cloud storage browser https://console.cloud.google.com/storage/browser - click on "Lifecycle" for a bucket to set a data delete after time period rule - if you turn off billing to avoid the firebase warning, you lose access to your artifacts bucket.  Re-enable billing to get it back.
https://console.cloud.google.com/apis/credentials/serviceaccountkey
Go to https://console.cloud.google.com/apis/credentials to delete service account keys
Staging bucket is emptied automatically weekly.
valuable info at https://cloud.google.com/appengine/docs/standard/nodejs/runtime and https://cloud.google.com/nodejs/getting-started/hello-world

TODO:
https://cloud.google.com/appengine/docs/standard/nodejs/serving-static-files serve the client from static

```
