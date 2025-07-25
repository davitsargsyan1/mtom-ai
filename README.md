# MTOM AI - Smart Customer Support Chatbot Platform

A full-stack customer support chatbot platform powered by AI, featuring real-time chat, knowledge base integration, and admin dashboard.

## 🚀 Features

- **AI-Powered Chat**: Smart responses using OpenRouter/OpenAI integration
- **Knowledge Base**: Vector search with Pinecone for contextual answers
- **Session Management**: Persistent chat sessions with message history
- **Admin Dashboard**: Real-time statistics and session monitoring
- **Customer Information**: Optional customer context collection
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **TypeScript**: Full type safety across frontend and backend

## 🛠 Tech Stack

### Frontend

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Query** for API state management
- **React Router** for navigation
- **Lucide React** for icons
- **Zustand** for global state (if needed)

### Backend

- **Node.js** with Express
- **TypeScript** for type safety
- **OpenAI SDK** for LLM integration
- **Pinecone** for vector database
- **Zod** for request validation
- **Rate limiting** and security middleware

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- **npm** or **yarn** package manager
- **OpenRouter API key** (or OpenAI API key)
- **Pinecone account** and API key

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mtom-ai
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Update the `.env` file with your API keys:

```env
# Server Configuration
PORT=8000
NODE_ENV=development

# AI Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openai/gpt-3.5-turbo

# Vector Database
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment_here
PINECONE_INDEX_NAME=chatbot-knowledge-base

# Session Security
SESSION_SECRET=your_session_secret_here_minimum_32_characters

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:backend    # Backend on http://localhost:8000
npm run dev:frontend   # Frontend on http://localhost:3000
```

## 🔧 Configuration

### OpenRouter Setup

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Get your API key from the dashboard
3. Add it to your `.env` file as `OPENROUTER_API_KEY`

### Pinecone Setup

1. Create a free account at [Pinecone](https://www.pinecone.io/)
2. Create a new index with:
   - **Dimension**: 1536 (for OpenAI embeddings)
   - **Metric**: cosine
   - **Environment**: your Pinecone environment
3. Add your API key and environment to `.env`

## 📁 Project Structure

```
mtom-ai/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment and configuration
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic services
│   │   ├── types/           # TypeScript type definitions
│   │   └── server.ts        # Express server setup
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript types
│   │   └── main.tsx         # React app entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── .env.example
├── package.json
└── README.md
```

## 🎯 Usage

### Customer Chat Interface

1. Navigate to `http://localhost:3000`
2. Optionally provide customer information
3. Start chatting with the AI assistant
4. View message history and confidence scores

### Admin Dashboard

1. Navigate to `http://localhost:3000/admin`
2. View real-time chat statistics
3. Monitor system status
4. Access quick actions for session management

### API Endpoints

#### Chat Operations

- `POST /api/chat/send` - Send a message and get AI response
- `GET /api/chat/session/:id` - Get session details
- `PUT /api/chat/session/:id/status` - Update session status
- `GET /api/chat/session/:id/transcript` - Export session transcript
- `GET /api/chat/stats` - Get chat statistics

#### Health Check

- `GET /health` - Server health status

## 🔒 Security Features

- **Rate Limiting**: Prevents API abuse
- **CORS Protection**: Configurable allowed origins
- **Helmet.js**: Security headers
- **Input Validation**: Zod schema validation
- **Environment Variables**: Sensitive data protection

## 🧪 Testing

```bash
# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run all tests
npm test
```

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
```

### Environment Variables for Production

Update your production environment with:

```env
NODE_ENV=production
PORT=8000
OPENROUTER_API_KEY=your_production_key
PINECONE_API_KEY=your_production_key
SESSION_SECRET=your_secure_session_secret
ALLOWED_ORIGINS=https://yourdomain.com
```

### Docker Deployment (Optional)

Create a `Dockerfile` in the root directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build applications
RUN npm run build

EXPOSE 8000

CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Write meaningful commit messages

### Architecture Principles

- Keep components small and focused
- Separate business logic from UI components
- Use custom hooks for stateful logic
- Implement proper error handling
- Add loading states for better UX

### Adding New Features

- Create types first
- Add backend API endpoints
- Implement frontend components
- Add error handling
- Update documentation

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**

- Check your `.env` file configuration
- Ensure all required environment variables are set
- Verify your API keys are valid

**Frontend build errors:**

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript errors in your IDE

**Pinecone connection issues:**

- Verify your API key and environment
- Check if your index exists
- Ensure network connectivity

**OpenRouter API errors:**

- Check your API key validity
- Verify you have sufficient credits
- Check the model name is correct

### Development Tips

- Use the browser dev tools for debugging
- Check backend logs for API errors
- Monitor network requests in the browser
- Use the admin dashboard for system monitoring

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenRouter](https://openrouter.ai/) for AI model access
- [Pinecone](https://www.pinecone.io/) for vector database
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide](https://lucide.dev/) for icons

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

Built with ❤️ by the MTOM AI team
