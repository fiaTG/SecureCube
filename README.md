# SecureCube Auth System

A professional-grade frontend portfolio project demonstrating advanced HTML, CSS, and vanilla JavaScript engineering through a fully animated 3D cube authentication interface.

---

## Overview

SecureCube presents a complete authentication flow inside a hardware-accelerated 3D CSS cube. Each face of the cube contains a distinct screen — login, registration, MFA verification, password reset, success confirmation, and account settings. Rotating between screens animates the cube smoothly in 3D space.

This project is a frontend-only demo built to showcase:
- 3D CSS perspective and transform-style: preserve-3d
- Smooth, production-quality animations with cubic-bezier easing
- Real-world form UX patterns (validation, strength meters, MFA inputs)
- Simulated auth flows using localStorage
- Accessible, WCAG-friendly markup and behavior
- Dark/light theme with OS preference detection
- Modular, clean vanilla JS architecture

---

## Features

### Authentication Screens
| Face | Screen | Direction |
|------|--------|-----------|
| Front | Login | — |
| Right | Register | Rotate Y -90° |
| Back | MFA Verification | Rotate Y 180° |
| Left | Forgot Password | Rotate Y +90° |
| Top | Success/Confirmation | Rotate X +90° |
| Bottom | Account Settings | Rotate X -90° |

### Login
- Email + password fields with inline validation
- Show/hide password toggle
- Remember me preference (persisted to localStorage)
- Rate limiting: 5 failed attempts triggers 5-minute lockout
- Loading state with animated spinner

### Registration
- Full name, email, password, confirm password
- Live password strength meter (Weak / Fair / Good / Strong)
- Live password match detection
- Terms of service checkbox
- Duplicate email prevention

### MFA Verification
- 6 individual digit inputs with auto-advance and backspace navigation
- Paste support (distributes across all digit fields)
- 60-second countdown timer with expiry warning
- Resend code (generates new 6-digit code)
- Demo code displayed on-screen for testing

### Forgot Password
- Email lookup, new password, confirm password
- Password updated in localStorage if account exists
- Generic error messages (avoids email enumeration)

### Success Page
- Animated SVG checkmark with stroke-dashoffset draw animation
- Dynamic title and message based on context
- Contextual continue button (login → settings, register/reset → login)

### Account Settings
- User info card with avatar initial
- Change password action
- Sign out
- Delete demo account
- Activity log showing last 8 events with timestamps

### Extra Polish
- Dark / light mode toggle with OS preference detection
- Saved theme preference in localStorage
- Toast notification system (top-right, auto-dismiss)
- Animated particle network background
- Smooth reduced-motion support (CSS `prefers-reduced-motion`)
- All forms have aria-live error regions, sr-only announcements, visible focus states

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Markup | HTML5 (semantic, accessible) |
| Styles | CSS3 (custom properties, 3D transforms, keyframes) |
| Logic | Vanilla JavaScript ES6+ (modules pattern, IIFE) |
| Storage | Web Storage API (localStorage) |
| Fonts | Google Fonts — Inter |
| Dependencies | **None** |

No frameworks. No build tools. No npm. Runs directly in the browser.

---

## Project Structure

```
SecureCube/
├── index.html              Main HTML — all 6 cube faces
├── css/
│   └── style.css           All styles (cube, forms, animations, responsive)
├── js/
│   ├── storage.js          localStorage abstraction (users, session, MFA, audit)
│   ├── validation.js       Pure validation functions (email, password, etc.)
│   ├── cube.js             3D cube rotation controller
│   ├── ui.js               Toast, theme, form helpers, particles, countdown
│   └── app.js              Main app controller — event handlers, orchestration
├── assets/                 Static assets (empty — all icons are inline SVG)
└── README.md
```

---

## How to Run Locally

No build step required — open directly in a browser.

**Option 1 — File protocol (simplest)**
```
Open index.html in Chrome, Firefox, Safari, or Edge.
```
Note: Some browsers restrict localStorage on `file://`. Use a local server if needed.

**Option 2 — Local server (recommended)**

Using Python:
```bash
cd SecureCube
python -m http.server 8080
# Open http://localhost:8080
```

Using Node.js (npx):
```bash
cd SecureCube
npx serve .
# Open the URL shown in terminal
```

Using XAMPP (already configured):
```
Place in htdocs/ and visit http://localhost/files/portfolio_projects/SecureCube/
```

Using VS Code Live Server extension:
```
Right-click index.html → Open with Live Server
```

---

## How to Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `securecube`)

2. Push the project:
```bash
git init
git add .
git commit -m "Initial commit: SecureCube Auth System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/securecube.git
git push -u origin main
```

3. Enable GitHub Pages:
   - Go to repository **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** / **root**
   - Click **Save**

4. Your site will be live at:
```
https://YOUR_USERNAME.github.io/securecube/
```

GitHub Pages serves static files natively — no configuration needed.

---

## Demo Credentials

This is a frontend demo — all data is stored locally in your browser.

To try the full flow:
1. Click **Create account** and register with any email + strong password
2. Sign in with those credentials
3. Enter the 6-digit code shown in the blue demo notice box
4. Explore Account Settings

To reset everything:
```javascript
// Run in browser console:
Object.keys(localStorage)
  .filter(k => k.startsWith('securecube_'))
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

---

## Security Notice

> **This project is a frontend demo simulation. It does NOT implement real security.**

Real authentication requires:
- Server-side credential validation
- Proper password hashing (bcrypt, argon2id)
- HTTPS transport
- Secure, httpOnly session cookies
- Server-side rate limiting and CSRF protection
- Proper MFA (TOTP via authenticator app or SMS gateway)

The password "encoding" in this demo uses a simple XOR + Base64 scheme for visual purposes — this is explicitly marked in `storage.js` and is not a substitute for real cryptography.

---

## Browser Support

Tested and compatible with:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

CSS 3D transforms, custom properties, and backdrop-filter are required. All are supported in modern browsers.

---

## License

MIT — free to use, modify, and deploy as a portfolio piece.
