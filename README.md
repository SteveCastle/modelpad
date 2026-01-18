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

### Environment Variables

Modelpad depends on a number of environment variables to run correctly. You can copy the `.example.env` file to `.env` with the following command and configure each environment variable with your own credentials.

```
cp .example.env .env
```

#### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/modelpad` |
| `JWT_SECRET` | Secret key for signing JWTs (min 32 chars) | `your-super-secret-key-at-least-32-characters` |
| `JWT_ACCESS_EXPIRY` | Access token expiration | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token expiration | `168h` (7 days) |
| `ENV` | Environment (development/production) | `production` |

### Running the Dev environment.

To run the dev environment just install the dependencies and run the dev script. This will start the frontend and backend servers and a local database.

```
npm i
npm run dev
```

And that's it. You should now be able to access the app at `http://localhost:5173`.

---

## Deployment

### GitHub Actions CI/CD

The project includes a GitHub Actions workflow that automatically:

1. **Builds** the frontend and Docker image
2. **Runs database migrations** against your production database
3. **Deploys** to Kubernetes

### Required GitHub Secrets

Add the following secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

| Secret | Description | Required |
|--------|-------------|----------|
| `DATABASE_URL` | Production PostgreSQL connection string | ✅ Yes |
| `KUBECONFIG` | Base64-encoded kubeconfig for Kubernetes deployment | ✅ Yes |
| `JWT_SECRET` | Secret key for JWT signing (set in K8s ConfigMap/Secret) | ✅ Yes |

#### How to set secrets:

1. Go to your repository on GitHub
2. Navigate to `Settings` > `Secrets and variables` > `Actions`
3. Click `New repository secret`
4. Add each secret listed above

#### DATABASE_URL Format

```
postgres://username:password@hostname:5432/database_name?sslmode=require
```

#### KUBECONFIG

Encode your kubeconfig file:
```bash
cat ~/.kube/config | base64 -w 0
```

### Kubernetes Secrets

In addition to GitHub secrets, ensure your Kubernetes deployment has these environment variables configured (via ConfigMap or Secret):

```yaml
# k8s/config-map.yaml or k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: modelpad-secrets
  namespace: modelpad
type: Opaque
stringData:
  DATABASE_URL: "postgres://user:pass@host:5432/db"
  JWT_SECRET: "your-production-jwt-secret-min-32-chars"
  JWT_ACCESS_EXPIRY: "15m"
  JWT_REFRESH_EXPIRY: "168h"
  ENV: "production"
```

### Database Migrations

Migrations are automatically run during deployment. Migration scripts are located in `init-scripts/` and are executed in alphabetical order:

- `01_create_tables.sql` - Core notes and revisions tables
- `02_add_parent_field.sql` - Hierarchical note structure
- `03_add_tags_field.sql` - Tag support
- `04_create_users_table.sql` - JWT authentication tables

To run migrations manually:

```bash
psql $DATABASE_URL -f init-scripts/01_create_tables.sql
psql $DATABASE_URL -f init-scripts/02_add_parent_field.sql
psql $DATABASE_URL -f init-scripts/03_add_tags_field.sql
psql $DATABASE_URL -f init-scripts/04_create_users_table.sql
```

### Manual Deployment

If not using GitHub Actions, you can deploy manually:

```bash
# Build frontend
npm run build

# Build Docker image
docker build -t modelpad:latest .

# Push to registry
docker tag modelpad:latest your-registry/modelpad:latest
docker push your-registry/modelpad:latest

# Apply Kubernetes manifests
kubectl apply -f k8s/
```
