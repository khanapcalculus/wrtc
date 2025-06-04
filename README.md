# WebRTC Collaborative Whiteboard

A real-time collaborative whiteboard with continuous drawing preview using WebRTC Data Channels.

## ✨ Features

- 🎨 **Real-time collaborative drawing** with sub-100ms latency
- 📱 **Cross-device support** (computer, tablet, mobile)
- 🖊️ **High-fidelity drawing** perfect for cursive and small text
- 🎨 **Customizable tools** with expandable color and stroke palettes
- 📄 **Multi-page support** with 1200x2400 canvas
- 🔒 **Secure P2P connection** via WebRTC Data Channels
- 🌍 **Global deployment ready**

## 🚀 Quick Start (Local Development)

```bash
npm install
npm run dev
```

Access at: `http://192.168.31.158:3000` (replace with your IP)

## 🌐 Global Deployment for Worldwide Access

### Option 1: Render.com (Recommended - FREE) 🏆

**Perfect for your GitHub repo: `khanapcalculus/wrtc`**

#### Step 1: Deploy Signaling Server
1. Go to [render.com](https://render.com) and sign up
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub and select `khanapcalculus/wrtc`
4. Settings:
   - **Name**: `wrtc-signaling-server`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node signaling-server.js`
   - **Plan**: Free
5. Click **"Create Web Service"**
6. Your signaling server will be at: `https://wrtc-signaling-server.onrender.com`

#### Step 2: Deploy Frontend (React App)
1. Click **"New +"** → **"Static Site"**
2. Select same repo: `khanapcalculus/wrtc`
3. Settings:
   - **Name**: `wrtc-whiteboard`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `build`
   - **Plan**: Free
4. Click **"Create Static Site"**
5. Your app will be at: `https://wrtc-whiteboard.onrender.com`

#### Step 3: Update Configuration
Update your signaling URL in `src/services/WebRTCManager.js`:
```javascript
const signalingUrl = 'https://wrtc-signaling-server.onrender.com';
```

### Option 2: Free Deployment (Netlify + Railway)

#### Step 1: Deploy Frontend to Netlify
1. Push your code to GitHub
2. Go to [Netlify](https://netlify.com)
3. Connect your GitHub repo
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
5. Your app will be available at: `https://your-app-name.netlify.app`

#### Step 2: Deploy Signaling Server to Railway
1. Go to [Railway](https://railway.app)
2. Connect your GitHub repo
3. Deploy the `server` folder
4. Add environment variable: `PORT=3001`
5. Your signaling server will be at: `https://your-project.railway.app`

#### Step 3: Update Configuration
Update `src/services/WebRTCManager.js`:
```javascript
const signalingUrl = 'https://your-project.railway.app';
```

### Option 3: Heroku (Paid)
1. Deploy both frontend and backend to Heroku
2. Configure environment variables
3. Access via Heroku URLs

### Option 4: DigitalOcean/AWS (Advanced)
1. Deploy to cloud VPS
2. Configure HTTPS certificates
3. Set up domain name

## 📚 For Students Worldwide

Once deployed on Render.com, share this link with your students:
```
https://wrtc-whiteboard.onrender.com
```

Students can:
1. **Create Room** (teacher)
2. **Join Room** using room ID (students)
3. **Draw collaboratively** with real-time preview
4. **Use on any device** (computer, tablet, phone)

## 🔧 Technical Architecture

- **Frontend**: React + Konva.js
- **Signaling**: Socket.io server
- **P2P Communication**: WebRTC Data Channels
- **STUN Servers**: Google STUN for NAT traversal
- **Latency**: Sub-100ms real-time drawing

## 🎓 Educational Use

Perfect for:
- ✏️ Math problem solving
- 🎨 Art collaboration
- 📝 Language learning
- 👥 Group projects
- 🌍 Remote classrooms

## 💻 Development

```bash
# Install dependencies
npm install

# Start development servers
npm run dev

# Start with HTTPS
npm run dev-https

# Build for production
npm run build
```

## 🌟 Why WebRTC?

- **Fastest possible connection** (direct peer-to-peer)
- **No server costs** for data transfer (only signaling)
- **Secure encryption** built-in
- **Works globally** with STUN servers
- **Sub-100ms latency** for real-time collaboration

## 📱 Mobile Support

Fully responsive design works on:
- 📱 iOS Safari
- 🤖 Android Chrome
- 💻 Desktop browsers
- 🖥️ Tablets

---

**Built with ❤️ for education and collaboration** 