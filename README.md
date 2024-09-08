# Modelpad

Modelpad is an Open Source AI assisted writing app with Notepad like features. Connect to cloud assisted writing models, or to your own locally hosted LLMs using Ollama.

https://github.com/SteveCastle/modelpad/assets/1828509/f61fe937-88ec-4aa6-a541-77a5eecc6b30

## Running the App Locally

## Prerequisites

You will need the following installed to run this app.
https://go.dev/doc/install
https://nodejs.org/en/download/package-manager
https://docs.docker.com/engine/install/

### SuperTokens Auth

Modelpad uses supertokens for auth. You can either self host super tokens are sign up for a free account.
Once you have an account you will need the following values to set in your environment variables.

```
SUPERTOKENS_CONNECTION_URI
SUPERTOKENS_API_KEY
```

https://supertokens.com/

## Environment Variables

Modelpad depends on a number of environment variables to run correctly.

```
cp .example.env .env
```

and configure each environment variable with your own credentials.

### Running the Dev environment.

```
npm i
npm run dev
```
