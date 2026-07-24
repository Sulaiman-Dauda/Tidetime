# Getting started

This guide takes you from an empty server to a working booking page. It covers the quickest supported path (Docker) and a local development setup.

## What you need

- A server or machine with [Docker](https://docs.docker.com/get-docker/) and the Docker Compose plugin.
- A domain name if you want public HTTPS booking pages. You can start without one and add it later.

Tidetime runs one company per instance. If you need to schedule for several unrelated organizations, run a separate instance for each.

## Option 1: install script

On a fresh server with Docker installed, run:

```bash
curl -fsSL https://raw.githubusercontent.com/Sulaiman-Dauda/Tidetime/main/install.sh | bash
```

The script checks for Docker, downloads the project, generates the required secrets, writes a `.env` file, and starts the containers. When it finishes it prints the address to open. Read the script first if you prefer; piping to a shell always deserves a look.

## Option 2: Docker Compose by hand

```bash
git clone https://github.com/Sulaiman-Dauda/Tidetime.git tidetime
cd tidetime
cp .env.example .env
```

Edit `.env` and set at least these values:

- `APP_URL` is the public URL of the instance, for example `https://book.yourcompany.com`.
- `DATABASE_URL` can stay as the bundled database in the production Compose file.
- `POSTGRES_PASSWORD` is the password for the bundled PostgreSQL container.
- `AUTH_SECRET` and `CRON_SECRET` are random values of at least 32 characters each.

Generate a secret with:

```bash
openssl rand -base64 32
```

Then start everything:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The app applies database migrations on startup. For domains, backups, and upgrades, see the [deployment guide](./DEPLOYMENT.md).

## First run

1. Open your `APP_URL` (or `http://localhost:3000` if you have not set a domain) and go to `/setup`.
2. Create the company and the owner account. This is a one-time step and is only available while the instance has no users.
3. You land in the dashboard.

## Create your first bookable service

1. Go to **Providers** and confirm your owner account is listed. Add more providers here and send them an invite by email.
2. Go to **Services** and create a service. Give it a name, a duration, and a location such as a Jitsi meeting or a phone call. Assign at least one provider.
3. Go to **Availability** and set the working hours for each provider.

## Take a test booking

1. Open your public booking page at `/book/<your-company-slug>`.
2. Choose the service, pick a provider or leave it on "any available", and choose a time.
3. Fill in the details and confirm.

The booking now appears under **Bookings** in the dashboard, and a confirmation email is sent if email is configured. To set up email, branding, and your custom domain, continue with the [admin guide](./ADMIN_GUIDE.md).

## Local development

For working on the code rather than running in production:

```bash
git clone https://github.com/Sulaiman-Dauda/Tidetime.git tidetime
cd tidetime
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:migrate
npm run db:seed        # optional demo company and service
npm run dev
```

The dev server runs at `http://localhost:3100`. See the [contributing guide](../CONTRIBUTING.md) for the full workflow and checks.
