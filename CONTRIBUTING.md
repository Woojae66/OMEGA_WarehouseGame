# Contributing to OMEGA Warehouse Game

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/OMEGA_WarehouseGame.git`
3. Create a feature branch from `dev`: `git checkout -b feature/your-feature dev`
4. Make your changes in `src/index.html`
5. Test locally by opening `src/index.html` in a browser
6. Commit your changes: `git commit -m "feat: add your feature"`
7. Push to your fork: `git push origin feature/your-feature`
8. Open a Pull Request against the `dev` branch

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — auto-deploys to GitHub Pages |
| `dev` | Development — merge features here first |

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `style:` — Formatting (no logic change)
- `refactor:` — Code restructuring
- `perf:` — Performance improvement
- `test:` — Adding tests

## Code Style

- Follow `.editorconfig` settings
- Keep all code in a single HTML file (`src/index.html`)
- Use semantic HTML where possible
- Comment complex canvas rendering logic

## Testing

Open `src/index.html` in your browser and verify:
- Canvas renders correctly
- All interactive controls work
- No console errors
- Responsive on mobile
