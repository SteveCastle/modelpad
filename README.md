# Modelpad

Modelpad is an Open Source AI assisted writing app with Notepad like features. Connect to cloud assisted writing models, or to your own locally hosted LLMs using Ollama.

https://github.com/SteveCastle/modelpad/assets/1828509/f61fe937-88ec-4aa6-a541-77a5eecc6b30

## Local Development

### Prerequisites

You will need the following installed to run the development environment.

#### Go

Modelpad uses Go for the backend server. You can download and install Go from the following link.

[Go Installation](https://go.dev/doc/install)

#### Node

Modelpad uses Node for the frontend build process. You can download and install Node from the following link.

[Node Installation](https://nodejs.org/en/download/package-manager)

#### Docker

Modelpad uses Docker for the dev database. You can download and install Docker from the following link.

[Docker Installation](https://docs.docker.com/engine/install/)

#### SuperTokens

Modelpad uses SuperTokens for auth. You can either self host super tokens are sign up for a free account.

[SuperTokens Sign Up](https://supertokens.com/)

### Environment Variables

Modelpad depends on a number of environment variables to run correctly. You can copy the `.example.env` file to `.env` with the following command and configure each environment variable with your own credentials.

```
cp .example.env .env
```

### Running the Dev environment.

To run the dev environment just install the dependencies and run the dev script. This will start the frontend and backend servers and a local database.

```
npm i
npm run dev
```

And that's it. You should now be able to access the app at `http://localhost:5173`.
