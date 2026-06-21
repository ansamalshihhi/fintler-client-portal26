# Fintler Document Portal

A two-sided document management system built for Fintler Financial Consultancy.

- **Fintler view** (`/`) — full portal with client management, AI statement reader, and Excel export
- **Client view** (`/client/`) — password-protected, clean checklist only

---

## Deploy to GitHub Pages (step by step)

### Step 1 — Create a new GitHub repository

1. Go to [github.com](https://github.com) and log in
2. Click the **+** button (top right) → **New repository**
3. Name it: `fintler-portal` (or anything you prefer)
4. Set it to **Public** (required for free GitHub Pages)
5. Click **Create repository**

---

### Step 2 — Upload the files

**Option A — Using GitHub's web interface (no technical knowledge needed):**

1. Inside your new repository, click **uploading an existing file**
2. Drag and drop the entire `fintler-portal` folder contents
3. You must maintain this exact structure:
   ```
   index.html
   _config.yml
   README.md
   assets/
     style.css
     shared.js
     portal.js
     client.js
   client/
     index.html
   ```
4. Click **Commit changes**

**Option B — Using Git (if you have Git installed):**

```bash
cd fintler-portal
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/fintler-portal.git
git branch -M main
git push -u origin main
```

---

### Step 3 — Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select **Deploy from a branch**
5. Under **Branch**, select **main** and folder **/ (root)**
6. Click **Save**
7. Wait 2–3 minutes, then your site will be live at:
   ```
   https://YOUR_USERNAME.github.io/fintler-portal/
   ```

---

## How to use

### Fintler team
- Open: `https://YOUR_USERNAME.github.io/fintler-portal/`
- Create a client engagement, set a password for them
- Click **Share with client** to get their link and a ready-to-send message
- Upload bank statements for AI analysis and Excel export

### Client
- They open: `https://YOUR_USERNAME.github.io/fintler-portal/client/?ref=CLIENT-SLUG`
- Enter the password you gave them
- They see only their checklist — no Fintler data visible
- They can mark items as submitted and add extra documents

---

## Notes

- All data is stored in the browser's localStorage — no server or database needed
- The Fintler view and client view share the same localStorage when opened on the same device/browser
- For real production use across different devices, a simple backend (Supabase or Firebase free tier) can be added — reach out to your developer

---

*Built for Fintler Financial Consultancy, Muscat, Oman*
