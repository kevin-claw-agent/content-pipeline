# Release Process

This document describes the release process for Content Pipeline.

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Incompatible API changes
- **MINOR** (0.X.0): Backwards-compatible functionality additions
- **PATCH** (0.0.X): Backwards-compatible bug fixes

## Release Types

### 1. Standard Release

Regular feature releases following the normal development cycle.

### 2. Hotfix Release

Critical fixes for production issues.

### 3. Pre-release

Alpha, beta, or release candidate versions for testing.

## Release Checklist

### Before Release

- [ ] All features for the milestone are complete
- [ ] All tests pass locally and in CI
- [ ] Code coverage meets requirements (>80%)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated with new version
- [ ] No security vulnerabilities (check `npm audit`)
- [ ] Performance benchmarks pass (if applicable)

### Version Bump

Update the version in `package.json`:

```bash
# For patch release
npm version patch

# For minor release
npm version minor

# For major release
npm version major

# For pre-release
npm version prerelease --preid=beta
```

Or manually edit `package.json`:

```json
{
  "version": "1.1.0"
}
```

### Release Steps

#### Option 1: Automated Release (Recommended)

1. **Create a release PR**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.1.0
   ```

2. **Update version and changelog**:
   - Update `package.json` version
   - Update `CHANGELOG.md` with release date and notes

3. **Commit and push**:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore(release): prepare v1.1.0"
   git push origin release/v1.1.0
   ```

4. **Create PR to test branch**:
   - Target: `test`
   - Ensure all CI checks pass
   - Deploy to staging for final verification

5. **Create PR to master**:
   - Target: `master`
   - Get at least one approval
   - Merge using "Create a merge commit"

6. **Create and push tag**:
   ```bash
   git checkout master
   git pull origin master
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
   ```

7. **GitHub Actions handles the rest**:
   - Runs full test suite
   - Builds Docker image
   - Pushes to GitHub Container Registry
   - Creates GitHub Release with notes

#### Option 2: Manual Release

If automated release fails, you can create a manual release:

1. Go to GitHub repository → Releases
2. Click "Draft a new release"
3. Choose tag: `v1.1.0`
4. Target: `master`
5. Title: `Release v1.1.0`
6. Description: Copy from CHANGELOG.md
7. Publish release

## Post-Release

### Verification

- [ ] Docker image is available in GitHub Packages
- [ ] GitHub Release is published
- [ ] Staging deployment is successful
- [ ] Production deployment is successful (if applicable)

### Announcement

- [ ] Update documentation site
- [ ] Announce in relevant channels
- [ ] Monitor for issues

### Merge Back

After release, merge changes back to develop:

```bash
git checkout develop
git merge master --no-ff -m "chore(release): merge v1.1.0 back to develop"
git push origin develop
```

## Hotfix Process

For critical production fixes:

1. **Create hotfix branch from master**:
   ```bash
   git checkout master
   git pull origin master
   git checkout -b hotfix/critical-fix
   ```

2. **Make the fix** with minimal changes

3. **Bump version** (patch increment)

4. **Create PR directly to master** (bypassing test branch for critical fixes)

5. **After merge**, create tag and deploy

6. **Merge back** to develop and test branches

## Rollback Procedure

If a release causes issues:

1. **Identify the last stable version**

2. **Rollback deployment**:
   ```bash
   # Using Docker
   docker pull ghcr.io/kevin-claw-agent/content-pipeline:v1.0.0
   # Redeploy with previous version
   ```

3. **Create rollback PR** if needed to revert code changes

4. **Investigate and fix** the issue

5. **Release new patch version** with the fix

## Release Schedule

- **Patch releases**: As needed for bug fixes
- **Minor releases**: Every 2-4 weeks with new features
- **Major releases**: As needed for breaking changes, planned in advance

## Release Automation

The following is automated via GitHub Actions:

- Test suite execution
- Docker image building
- Container registry publishing
- GitHub Release creation
- NPM publishing (if configured)
- Deployment notifications

## Questions?

For questions about the release process, contact the maintainers or open an issue.
