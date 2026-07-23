# End-to-end tests

Start PostgreSQL, run `npm run db:migrate && npm run db:seed`, install Chromium with
`npx playwright install chromium`, then run `npm run test:e2e`. The suite verifies the public
company service list and a complete provider-backed booking at `/book/demo-company/intro`.
