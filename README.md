# Shopify App using SvelteKit

Warning: Expermimental code ahead

## Steps to follow

```shell
git clone https://github.com/unlocomqx/shopify-app-sveltekit my-app
cd my-app
npm install
# Switch to another folder
shopify create # You can also create an app on partners.shopify.com
# This will create an app and will clone the react app which we don't need
# Back to the clone folder 
shopify connect
# By now your .env file should be generated
shopify serve
# Shopify serve will update the urls of your app and will use ngrok to make your local server visible to the outside
``` 
