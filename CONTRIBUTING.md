# Contributing to Content Pipeline

Thank you for your interest in contributing to Content Pipeline! This document provides guidelines and instructions for contributing.

## Branch Workflow

We follow the **GitFlow** branching model:

```
master (production)
  ↑
develop (integration)
  ↑
test (staging)
  ↑
feature/*
```

### Branch Types

- **`master`**: Production-ready code. Protected branch - only merge via PR.
- **`develop`**: Integration branch for features. All feature branches merge here.
- **`test`**: Staging environment for pre-production testing.
- **`feature/*`**: New features or enhancements.
- **`bugfix/*`**: Bug fixes.
- **`hotfix/*`**: Critical fixes for production.
- **`release/*`**: Release preparation branches.

### Workflow

1. **Start from develop**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, maintainable code
   - Follow existing code style
   - Add/update tests as needed
   - Update documentation

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```
   
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `test:` Test changes
   - `refactor:` Code refactoring
   - `perf:` Performance improvements
   - `chore:` Build process or auxiliary tool changes

4. **Push and create PR to develop**:
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Create a Pull Request targeting the `develop` branch.

5. **After merge to develop**:
   - Changes are automatically deployed to the development environment
   - Monitor for any issues

6. **Promote to test (staging)**:
   - Create PR from `develop` to `test`
   - After merge, automatic deployment to staging occurs

7. **Promote to master (production)**:
   - Create PR from `test` to `master`
   - Requires at least one approval
   - After merge, create a release tag

## Development Setup

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/kevin-claw-agent/content-pipeline.git
cd content-pipeline

# Install dependencies
npm install

# Set up environment
cp .env.development .env

# Start infrastructure services
docker-compose -f docker/docker-compose.yml up -d

# Run migrations (if applicable)
npm run db:migrate

# Start development server
npm run dev
```

## Code Standards

### TypeScript

- Use strict TypeScript settings
- Define explicit return types for functions
- Avoid `any` type - use proper types

### Testing

- Write unit tests for all new features
- Maintain test coverage above 80%
- Run tests before committing: `npm test`

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Linting

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Check formatting
npm run format:check

# Fix formatting
npm run format
```

All code must pass linting and type checking before merging.

## Pull Request Process

1. **Fill out the PR template** completely
2. **Ensure all checks pass**:
   - CI tests pass
   - Code coverage meets requirements
   - Linting passes
   - Type checking passes
3. **Request review** from at least one maintainer
4. **Address review feedback** promptly
5. **Squash merge** when approved

## Reporting Issues

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages

## Feature Requests

For feature requests:

- Describe the feature and its use case
- Explain why it would be valuable
- Consider implementation approach
- Be open to discussion and alternatives

## Security Issues

Please report security vulnerabilities privately to the maintainers. Do not open public issues for security problems.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Questions?

Feel free to open an issue for questions or join our discussions.

Thank you for contributing!
