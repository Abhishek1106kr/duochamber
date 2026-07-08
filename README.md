# DuoChat - Secure & Private Two-Person ChatRoom

A zero-knowledge, end-to-end encrypted (E2EE) chat application with WebRTC voice calls and administrator access approval, designed exclusively for two approved peers.

## Key Features

1. **End-to-End Encryption (E2EE)**:
   - Built on top of the browser's native **Web Crypto API**.
   - Keys are generated client-side using **ECDH (P-256)** curves.
   - Message payloads and image attachments are encrypted client-side using **AES-GCM (256-bit)** before transport.
   - The server only stores encrypted ciphertext strings, file URLs, and nonces. It never sees private keys or raw messages.
2. **WebRTC Secure Calling**:
   - Establish direct, encrypted peer-to-peer voice calls between browsers.
   - Leverages a self-contained Socket.io signaling bridge to route connection SDP negotiation and ICE candidates.
3. **Admin Registration Approval Panel**:
   - The first user to register becomes the **Admin/Creator**.
   - Subsequent users are marked as `pending` and cannot log in until the Admin approves them from the in-app Admin panel.
4. **Interactive UI/UX**:
   - Modern dark mode with glowing accents, glassmorphic card wrappers, real-time typing indicators, presence tracking, emoji selection, and encrypted image uploads.

---

## Technical Stack

* **Frontend**: React 18, Vite, TypeScript, Socket.io-client, Lucide React (icons), Vanilla CSS.
* **Backend**: Node.js, Express, Socket.io, SQLite, Prisma ORM, JSON Web Tokens (JWT), BcryptJS.

---

## Project Structure

```
├── package.json         # Frontend configuration & scripts
├── vite.config.ts       # Vite bundler proxy configuration
├── tsconfig.json        # Frontend TypeScript config
├── index.html           # Frontend entry HTML mount
├── src/                 # Frontend source
│   ├── auth/            # Login, Register, & Pending UI
│   ├── chat/            # ChatWindow, message bubble, image viewer
│   ├── calls/           # WebRTC Call overlay UI & state negotiation
│   ├── crypto/          # Web Crypto E2EE keys, text & image crypto helpers
│   ├── App.tsx          # App routing and entry
│   ├── index.css        # Global CSS dark theme system
│   └── main.tsx         # React DOM renderer
└── server/              # Backend source
    ├── package.json     # Backend configuration & scripts
    ├── tsconfig.json    # Backend TypeScript config
    ├── server.ts        # App bootstrap and Socket.io setup
    ├── prisma/          # Prisma database schema definition
    ├── database/        # Prisma client instantiation
    └── routes/          # API Routers (Auth, Messages, Keys, Uploads)
```

---

## Local Setup & Run Guide

Follow these steps to run the application locally:

### 1. Install Dependencies
Run `npm install` in both the project root (frontend) and the server directories.

```bash
# In the project root:
npm install

# In the server folder:
cd server
npm install
```

### 2. Run Database Migrations
Initialize the SQLite database schema inside the `server/` directory:

```bash
cd server
npx prisma migrate dev --name init
```

### 3. Start the Development Servers
Open two terminals:

**Terminal 1 (Backend API & Socket server)**:
```bash
cd server
npm run dev
# Starts backend server on http://localhost:5000
```

**Terminal 2 (Frontend Client)**:
```bash
# In the workspace root:
npm run dev
# Starts Vite app on http://localhost:3000
```

Go to `http://localhost:3000` in your web browser.

---

## End-to-End Verification Check

To test the full system locally:

1. Open `http://localhost:3000` in browser window #1 and click **Register Request** to create the admin account (e.g. `alice`). Since she is the first user, Alice is automatically approved. Log in.
2. Open an Incognito window or another browser at `http://localhost:3000` and register a second user (e.g. `bob`). Bob will see a **Pending Approval** notice.
3. In browser #1 (Alice's view), click the **Shield** icon in the sidebar to open the **Admin User Management** panel. You will see Bob's request. Click **Approve**.
4. In browser #2 (Bob's view), click **Check Approval Status**. Bob will log in.
5. Key exchange starts immediately. Once completed, a green "Key Exchanged E2EE" badge appears.
6. Swap text messages, emojis, and upload files. Check the SQLite DB (`server/prisma/dev.db`)—all message payloads are encrypted text.
7. Click the **Phone** icon in the header to start a WebRTC voice call. Accept on the other browser. Allow microphone access.
