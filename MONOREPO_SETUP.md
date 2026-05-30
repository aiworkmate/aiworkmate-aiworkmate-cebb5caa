# Monorepo Setup Instructions

## Overview

This document describes how to consolidate all four AI WorkMate repositories (workmate-nexus-ui, aiworkmategpt, ai-workmate-frontend, and AI-WorkMate) into a single unified monorepo.

## Prerequisites

- Git installed and configured
- Node.js >= 20
- npm >= 9 (for workspace support)

## Consolidation Process

### Step 1: Clone the Target Repository

```bash
git clone https://github.com/aiworkmate/AI-WorkMate.git
cd AI-WorkMate
```

### Step 2: Add Remote References

```bash
git remote add nexus-ui https://github.com/aiworkmate/workmate-nexus-ui.git
git remote add gpt-module https://github.com/aiworkmate/aiworkmategpt.git
git remote add frontend https://github.com/aiworkmate/ai-workmate-frontend.git
```

### Step 3: Fetch All Repository Histories

```bash
git fetch nexus-ui --all
git fetch gpt-module --all
git fetch frontend --all
```

### Step 4: Create Subtrees for Each Repository

Import each repository as a subtree under `packages/`:

```bash
# Import nexus-ui
git subtree add --prefix packages/nexus-ui nexus-ui/main --squash

# Import gpt-module
git subtree add --prefix packages/gpt-module gpt-module/main --squash

# Import frontend
git subtree add --prefix packages/frontend frontend/main --squash
```

If you encounter merge conflicts, use:

```bash
git subtree add --prefix packages/nexus-ui nexus-ui/main --squash --allow-unrelated-histories
```

### Step 5: Clean Up Remotes

```bash
git remote remove nexus-ui
git remote remove gpt-module
git remote remove frontend
```

### Step 6: Verify Structure

```bash
ls -la packages/
# Should output:
# frontend/
# gpt-module/
# nexus-ui/
```

### Step 7: Install Dependencies

```bash
npm install
```

### Step 8: Test the Monorepo

```bash
npm run build
npm run lint
npm test
```

### Step 9: Push to GitHub

```bash
git push origin main
```

## Post-Consolidation Steps

### Archive Old Repositories

On GitHub, archive the old repositories to prevent accidental pushes:

1. Go to each repository's settings:
   - https://github.com/aiworkmate/workmate-nexus-ui
   - https://github.com/aiworkmate/aiworkmategpt
   - https://github.com/aiworkmate/ai-workmate-frontend

2. Scroll to "Danger Zone"
3. Click "Archive this repository"

### Update Team Workflows

- Update CI/CD pipelines to reference the new monorepo
- Update documentation with new repository URL
- Update team processes to use workspace commands

### Verify Build Pipeline

```bash
# Test individual package builds
npm run build:nexus
npm run build:gpt
npm run build:frontend

# Test combined build
npm run build

# Test development mode
npm run dev
```

## Monorepo Directory Structure

After consolidation, your repository structure will be:

```
AI-WorkMate/
├── packages/
│   ├── nexus-ui/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── ...
│   ├── gpt-module/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── ...
│   └── frontend/
│       ├── src/
│       ├── public/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── ...
├── src/                    # Core modules
├── server/                 # Server implementation
├── supabase/              # Supabase migrations
├── tests/                 # Integration tests
├── .env.example
├── .env.supabase.example
├── package.json           # Monorepo root with workspaces
├── tsconfig.json
├── README.md
└── MONOREPO_SETUP.md
```

## Workspace Commands

npm workspaces enable these commands:

```bash
# Run command in all packages
npm run build -ws
npm run lint -ws
npm run format -ws

# Run command in specific package
npm run build -w packages/nexus-ui
npm run dev -w packages/frontend

# Install dependencies in all packages
npm install

# Add dependency to specific package
npm install lodash -w packages/nexus-ui
```

## Updating Subtrees Later

To pull updates from the original repositories after consolidation:

```bash
# Update nexus-ui from original repo
git subtree pull --prefix packages/nexus-ui nexus-ui/main --squash

# Update gpt-module from original repo
git subtree pull --prefix packages/gpt-module gpt-module/main --squash

# Update frontend from original repo
git subtree pull --prefix packages/frontend frontend/main --squash
```

## Troubleshooting

### Merge Conflicts During Subtree Add

If conflicts occur:

```bash
git merge --abort  # Cancel current operation
git subtree add --prefix packages/nexus-ui nexus-ui/main --squash --allow-unrelated-histories
```

### Dependencies Not Resolving

Clear node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Port Conflicts When Running Dev

Each package may use different ports. Check package.json scripts:

```bash
npm run dev -w packages/nexus-ui  # Terminal 1
npm run dev -w packages/gpt-module # Terminal 2
npm run dev -w packages/frontend   # Terminal 3
```

### CI/CD Pipeline Issues

Update your GitHub Actions or other CI workflows to:

1. Build specific packages: `npm run build:nexus`
2. Run tests for monorepo: `npm test -ws`
3. Reference correct paths in scripts

## Benefits of Monorepo

✅ Single source of truth  
✅ Unified versioning  
✅ Simplified dependency management  
✅ Easier cross-package refactoring  
✅ Unified CI/CD pipeline  
✅ Reduced repository clutter  

## Reference

- [Git Subtree Documentation](https://git-scm.com/book/en/v2/Git-Tools-Subtrees)
- [npm Workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces)
- [Monorepo Best Practices](https://monorepo.tools/)
