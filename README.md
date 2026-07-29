# Code-to-Create Platform

A student learning platform: 14 weekly lessons with slide links, per-student
progress tracking, a Creator Space feed, and a portfolio gallery.

This is a real, deployable website — not a Claude artifact. It needs two
free services in addition to GitHub:

- **Firebase** — handles student accounts (login) and stores all the data
  (progress, posts, gallery). This is your "database."
- **Vercel or Netlify** — hosts the site itself and gives you a free URL.
  You'll point your purchased domain here later.

Nothing here costs money at this scale (Firebase's free "Spark" plan and
Vercel/Netlify's free tier easily cover a single class).

---

## 1. Create your Firebase project (the database)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. `code-to-create`) → finish the wizard.
2. In the left sidebar: **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. In the left sidebar: **Build → Firestore Database → Create database → Start in production mode → choose a location → Enable.**
4. Once created, go to the **Rules** tab of Firestore, delete what's there, and paste in the contents of `firestore.rules` from this project. Click **Publish**.
5. Go to **Project settings** (gear icon, top left) → scroll to **Your apps** → click the **</> (Web)** icon → give it a nickname → **Register app**. Firebase will show you a config object with values like `apiKey`, `authDomain`, etc. Keep this tab open — you'll need it in step 3 below.

## 2. Get the code running on your computer

You'll need [Node.js](https://nodejs.org) installed (any recent version).

```bash
# unzip/open this project folder, then inside it:
npm install
cp .env.example .env
```

Open `.env` in a text editor and paste in the six values from your Firebase
config (step 1.5 above), one per line, e.g.:

```
VITE_FIREBASE_API_KEY=AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN=code-to-create.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=code-to-create
VITE_FIREBASE_STORAGE_BUCKET=code-to-create.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

Then run it locally to test:

```bash
npm run dev
```

Open the localhost link it prints. Try creating an account — if it works,
your Firebase connection is good.

**Note:** `.env` is listed in `.gitignore` on purpose — it never gets
uploaded to GitHub, since it (indirectly) controls access to your database.
`.env.example` (no real values) is what goes to GitHub instead, so anyone
who clones the repo knows what to fill in.

## 3. Push it to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Then on [github.com](https://github.com), create a new empty repository
(don't initialize it with a README), and follow the "push an existing
repository" instructions it shows you, e.g.:

```bash
git remote add origin https://github.com/YOUR-USERNAME/code-to-create.git
git branch -M main
git push -u origin main
```

## 4. Deploy it live (Vercel — recommended)

1. Go to [vercel.com](https://vercel.com) → sign up with your GitHub account.
2. **Add New → Project** → select your `code-to-create` repo → **Import**.
3. Vercel auto-detects it's a Vite project. Before deploying, open
   **Environment Variables** and add the same six `VITE_FIREBASE_...`
   values from your `.env` file.
4. Click **Deploy**. In about a minute you'll get a live URL like
   `code-to-create.vercel.app`.

(Netlify works almost identically if you'd rather use that — "Add new site
→ Import an existing project," connect GitHub, add the same env vars under
**Site settings → Environment variables**.)

## 5. Add your domain later

Once you buy a domain: in Vercel, go to your project → **Settings → Domains
→ Add**, type your domain, and follow the DNS instructions it gives you
(usually just adding one or two records at your domain registrar). Free SSL
(the padlock/https) is automatic.

## 6. Day-to-day updates

Any time you edit the code, just:

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel/Netlify automatically redeploys on every push to `main` — no extra
steps needed.

## Adding lesson slides

Log in to the site as any student, go to **Lessons**, expand a week, and
click "add link" to paste a Google Slides / PowerPoint Online sharing link.
It's saved for everyone. Consider being the one who fills these in first, or
tighten `firestore.rules` (see the comment in that file) so only your
Firebase user ID can edit them.

## Project structure

```
├── src/
│   ├── App.jsx          # the whole app
│   ├── firebase.js      # connects to your Firebase project
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind
├── firestore.rules      # paste into Firebase Console → Firestore → Rules
├── .env.example          # template — copy to .env and fill in
├── package.json
└── index.html
```
