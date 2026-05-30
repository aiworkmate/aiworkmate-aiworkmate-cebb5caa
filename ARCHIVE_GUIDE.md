# Post-Consolidation Archive Guide

After successfully consolidating all repositories into `aiworkmate/AI-WorkMate`, follow these steps to archive the old repositories.

## Why Archive?

Archiving prevents accidental pushes, makes it clear these repos are deprecated, and keeps them for reference while marking them as read-only.

## Step-by-Step Archive Instructions

### Repository 1: workmate-nexus-ui

1. Go to: https://github.com/aiworkmate/workmate-nexus-ui
2. Click the **Settings** tab (top right)
3. Scroll down to the **Danger Zone** section (near the bottom)
4. Click **Archive this repository**
5. Read the warning and type the repository name to confirm: `workmate-nexus-ui`
6. Click **I understand the consequences, archive this repository**

**Status**: ✓ Archived

---

### Repository 2: aiworkmategpt

1. Go to: https://github.com/aiworkmate/aiworkmategpt
2. Click the **Settings** tab (top right)
3. Scroll down to the **Danger Zone** section (near the bottom)
4. Click **Archive this repository**
5. Read the warning and type the repository name to confirm: `aiworkmategpt`
6. Click **I understand the consequences, archive this repository**

**Status**: ✓ Archived

---

### Repository 3: ai-workmate-frontend

1. Go to: https://github.com/aiworkmate/ai-workmate-frontend
2. Click the **Settings** tab (top right)
3. Scroll down to the **Danger Zone** section (near the bottom)
4. Click **Archive this repository**
5. Read the warning and type the repository name to confirm: `ai-workmate-frontend`
6. Click **I understand the consequences, archive this repository**

**Status**: ✓ Archived

---

## Verification Checklist

After archiving all three repositories, verify:

- [ ] workmate-nexus-ui shows "Archived" badge on GitHub
- [ ] aiworkmategpt shows "Archived" badge on GitHub
- [ ] ai-workmate-frontend shows "Archived" badge on GitHub
- [ ] All repositories are read-only (no push allowed)
- [ ] Consolidated code is in aiworkmate/AI-WorkMate under `packages/`

## Post-Archive Tasks

### 1. Update Team Documentation
- Update any internal wiki/docs pointing to the old repos
- Link to the new consolidated repo: https://github.com/aiworkmate/AI-WorkMate

### 2. Update CI/CD Pipelines
- Update GitHub Actions workflows to use the new repository
- Update any external CI/CD tools referencing the old repos

### 3. Update Clone Instructions
Old:
```bash
git clone https://github.com/aiworkmate/workmate-nexus-ui.git
git clone https://github.com/aiworkmate/aiworkmategpt.git
git clone https://github.com/aiworkmate/ai-workmate-frontend.git
```

New:
```bash
git clone https://github.com/aiworkmate/AI-WorkMate.git
cd AI-WorkMate
npm install
```

### 4. Notify Team Members
Send a message to your team:

---

**Announcement:**

All AI WorkMate development has been consolidated into a single monorepo:

**📍 New Repository:** https://github.com/aiworkmate/AI-WorkMate

**Old repositories archived:**
- workmate-nexus-ui (archived)
- aiworkmategpt (archived)
- ai-workmate-frontend (archived)

**New structure:**
```
AI-WorkMate/
├── packages/
│   ├── nexus-ui/     (formerly workmate-nexus-ui)
│   ├── gpt-module/   (formerly aiworkmategpt)
│   └── frontend/     (formerly ai-workmate-frontend)
├── src/
├── server/
└── supabase/
```

**Getting started:**
```bash
git clone https://github.com/aiworkmate/AI-WorkMate.git
cd AI-WorkMate
npm install
npm run dev
```

See [README.md](https://github.com/aiworkmate/AI-WorkMate/blob/main/README.md) and [MONOREPO_SETUP.md](https://github.com/aiworkmate/AI-WorkMate/blob/main/MONOREPO_SETUP.md) for more details.

---

## Reverting an Archive (If Needed)

If you need to unarchive a repository:

1. Go to the archived repository
2. Click **Settings**
3. Scroll to **Danger Zone**
4. Click **Unarchive this repository**
5. Confirm

## Support

For questions about the consolidation:
- Check [MONOREPO_SETUP.md](https://github.com/aiworkmate/AI-WorkMate/blob/main/MONOREPO_SETUP.md)
- Review [README.md](https://github.com/aiworkmate/AI-WorkMate/blob/main/README.md)
- Contact the AI WorkMate team

---

**Date Archived:** 2026-05-30
**Consolidated Into:** aiworkmate/AI-WorkMate
