# Poly'sen

A play-money prediction market for one friend group. No real money goes in or comes out.

- Product spec: [docs/PRD.md](docs/PRD.md)
- Build plan: [docs/build-plan.md](docs/build-plan.md)
- Rules the coin maths must follow: [docs/core-test-cases.md](docs/core-test-cases.md)
- Design decisions: [docs/decisions/](docs/decisions/)

## Develop

```bash
pnpm install
cp .env.example .env.local   # then fill in
pnpm dev                     # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test
```

The coin maths lives in `src/core/` and is covered by unit tests plus property tests that play 10,000 random games and check after every step that no coin is created or lost and no balance goes negative.
