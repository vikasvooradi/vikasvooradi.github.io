# LeetCode SQL Solutions Viewer

A beautiful website to showcase your LeetCode SQL solutions hosted on GitHub Pages.

## 🚀 Setup Instructions

### Step 1: Create a New Repository

1. Go to GitHub and create a new repository named `vikasvooradi.github.io`
2. Make it **public**

### Step 2: Add Your GitHub Token as a Secret

1. Go to your repository settings
2. Click on **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `LEETCODE_TOKEN`
5. Value: Paste your GitHub token (the one named "sql-problems")
6. Click **Add secret**

### Step 3: Upload These Files

Upload all these files to your repository:
- `index.html`
- `build.js`
- `.github/workflows/deploy.yml`
- `README.md`

### Step 4: Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Source: Select **gh-pages** branch
3. Click **Save**

### Step 5: Wait for Build

- GitHub Actions will automatically run
- It will fetch your problems securely using your token
- It will generate `problems.json`
- It will deploy to `vikasvooradi.github.io`

**That's it!** Your website will be live at:
👉 **https://vikasvooradi.github.io**

## 🔄 Auto-Updates

The website automatically updates:
- Every time you push to the repository
- Every day at midnight (to catch new problems)
- Manually from Actions tab → "Build and Deploy" → "Run workflow"

## 🔐 Security

- Your GitHub token is stored securely as a GitHub Secret
- It's never exposed in the website code
- Only GitHub Actions can access it
- The public website only loads pre-built data

## 📁 File Structure

```
vikasvooradi.github.io/
├── index.html              # Main website
├── build.js                # Script to fetch problems
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions workflow
└── README.md              # This file
```

## 🎨 Features

- ✅ Beautiful gradient design
- ✅ Search functionality
- ✅ Collapsible questions
- ✅ Show/hide solutions
- ✅ Mobile responsive
- ✅ Auto-updates daily
- ✅ Fast loading
- ✅ Secure (no token exposure)

---

Made with ❤️ by Vikas Vooradi
