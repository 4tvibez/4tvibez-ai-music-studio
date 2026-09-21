# 4TVIBEZ AI Music Studio

An AI-assisted music generation web application built as part of the **4TVIBEZ** developer portfolio.

The project provides a browser-based music creation interface connected to a Node.js/Express backend and the **ACE-Step V1.5** music-generation service.

## ✨ Features

- AI music generation interface
- Prompt-based music creation
- Lyrics input
- Music style and genre controls
- Support for creative workflows such as simple and custom generation
- Browser-to-backend API integration
- Generation status handling
- Audio generation workflow
- Responsive music-studio interface
- Health-check endpoint for backend status
- Railway deployment support

## 🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript
- Node.js
- Express.js
- `@gradio/client`
- ACE-Step V1.5
- Git & GitHub
- Railway

## 🤖 AI Backend

The current project is designed around **ACE-Step V1.5** rather than the older Replicate implementation.

The backend connects to the ACE-Step service and handles communication between the web interface and the AI music-generation system.

The configured Hugging Face Space is:

`ACE-Step/Ace-Step-v1.5`

## 🏗️ How It Works

1. A user enters a music prompt and optional lyrics.
2. The frontend sends the request to the Node/Express backend.
3. The backend communicates with ACE-Step.
4. The generation job is monitored while processing.
5. The resulting audio is returned to the application when available.

This architecture keeps the AI-service communication on the backend instead of requiring the browser to connect directly to the AI service.

## 🚀 Run Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
npm start
```

The application uses the `PORT` environment variable when provided and otherwise uses port 3000.

Then open the application through the running server rather than opening the HTML file directly.

## ☁️ Railway Deployment

The project is designed to run on Railway as a Node.js application.

After deployment, the backend health endpoint can be checked at:

`/api/health`

A healthy deployment should report that the ACE-Step V1.5 provider is configured.

## 🎯 What I Built

This project demonstrates practical experience with:

- Frontend UI development
- JavaScript event handling
- REST-style backend integration
- Node.js and Express
- AI service integration
- Asynchronous generation jobs
- API error handling
- Deployment and troubleshooting
- GitHub-based development workflows

## 🔒 Security

Do not commit private API credentials, access tokens, session secrets, or other sensitive environment variables to GitHub.

Production secrets should be configured through the hosting platform's secure environment-variable settings.

## 👨‍💻 Developer

**Desmond Nador**  
Junior Front-End Developer | Web Developer

GitHub: https://github.com/4tvibez

Portfolio: https://4tvibez.github.io/desmond-portfolio/

---

This project is part of my developer portfolio and demonstrates my experience connecting a modern web interface to an AI-powered backend and deploying the application to the cloud.
