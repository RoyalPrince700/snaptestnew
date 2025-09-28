# StudyAI - AI-Powered Learning Platform

A comprehensive MERN stack application that revolutionizes education through AI-driven personalized learning experiences. Students can learn any topic interactively, upload course materials, take quizzes, and even get help with final year projects.

## Features

### 🎓 Interactive Topic Learning
- **AI-Powered Teaching**: Learn any subject by simply saying "teach me photosynthesis" - the AI breaks down complex topics into digestible modules
- **Engage with AI**: Ask questions about any aspect you don't understand and get instant, personalized explanations
- **Progress Tracking**: AI monitors your understanding and adapts explanations based on your responses

### 📝 Smart Quiz System
- **Automatic Quizzes**: AI generates quizzes between lessons to test comprehension
- **Custom Quiz Requests**: Ask the AI to create quizzes on topics covered so far
- **Multiple Formats**: Choose between multiple choice questions or theory-based assessments
- **Instant Scoring**: AI evaluates responses and provides detailed feedback
- **Adaptive Learning**: Quiz results inform future explanations and focus areas

### 📄 PDF Course Upload
- **Document Integration**: Upload PDF course materials and study guides
- **OCR Technology**: Advanced text extraction from uploaded PDFs
- **AI Course Teaching**: AI processes and teaches based on your uploaded materials
- **Seamless Learning**: Combine uploaded content with AI-generated explanations

### 📊 Organized Learning Interface
- **Module Breakdown**: Topics are automatically organized into logical modules in the sidebar
- **Structured Learning Paths**: Clear progression through course materials
- **Easy Navigation**: Jump between modules and track your learning journey

### 🎯 Project Writing Assistant
- **Final Year Project Support**: Specialized section for undergraduate project writing
- **Chapter Generation**: AI generates comprehensive project chapters based on your topic
- **Lecturer Integration**: Incorporate and follow lecturer instructions and feedback
- **Iterative Updates**: Request AI to update and refine project sections

### 🔐 Additional Features
- **User Authentication**: Secure login and registration system
- **Study Session Tracking**: Log and monitor study sessions
- **Dashboard**: View study statistics and progress
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Navigation Structure

### 📱 Main Sidebar Navigation

- **🏠 Dashboard**
  - Overview of learning progress
  - Study statistics and analytics
  - Recent activities and achievements

- **🎓 Learn Topics**
  - Start new topic learning session
  - Continue previous learning paths
  - Browse learning history

- **📝 Quiz Center**
  - Take auto-generated quizzes
  - Request custom topic quizzes
  - View quiz history and scores
  - Performance analytics

- **📄 Course Materials**
  - Upload PDF documents
  - Browse uploaded courses
  - AI-processed learning modules
  - Document library management

- **🎯 Project Assistant**
  - Start new project
  - Continue existing projects
  - Project templates and guides
  - Chapter management

- **👤 Profile**
  - Account settings
  - Learning preferences
  - Progress reports
  - Study goals

- **⚙️ Settings**
  - Notification preferences
  - Privacy settings
  - AI interaction settings

### 📊 Module Organization

When learning a topic, the sidebar dynamically organizes content into:

- **📚 Topic Modules**: Automatically generated learning modules
- **📋 Subtopics**: Break down of main concepts
- **✅ Progress Indicators**: Visual progress tracking
- **🔗 Quick Navigation**: Jump between modules
- **📖 Resources**: Related materials and references

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose
- **AI Integration**: Fireworks AI API
- **OCR Technology**: Text extraction from PDF documents
- **Authentication**: JWT tokens
- **File Processing**: PDF upload and processing capabilities

## Project Structure

```
snaptest/
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   └── services/
│   ├── public/
│   └── package.json
└── README.md
```

## Environment Variables

### Backend (.env)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/snaptest

# JWT
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-secure
JWT_EXPIRE=7d

# Fireworks AI
FIREWORKS_API_KEY=your-fireworks-ai-api-key-here

# Server
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```env
# API Base URL
VITE_API_URL=http://localhost:5000/api
```

## Installation & Setup

1. **Clone and navigate to the project**
   ```bash
   cd snaptest
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Copy .env values from backend/.env-values.txt to .env
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   # Copy .env values from frontend/.env-values.txt to .env
   npm run dev
   ```

4. **MongoDB**
   - Make sure MongoDB is running locally on port 27017
   - Or update MONGODB_URI to point to your MongoDB instance

## Available Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Study Sessions
- `POST /api/study/sessions` - Create study session
- `GET /api/study/sessions` - Get user's study sessions
- `GET /api/study/sessions/:id` - Get specific study session
- `PUT /api/study/sessions/:id` - Update study session
- `DELETE /api/study/sessions/:id` - Delete study session
- `GET /api/study/stats` - Get study statistics

### AI Assistant
- `POST /api/ai/learn-topic` - Start learning a new topic with AI breakdown
- `POST /api/ai/ask-question` - Ask questions about current topic
- `POST /api/ai/generate-quiz` - Generate quizzes (MCQ or theory)
- `POST /api/ai/score-quiz` - Submit and score quiz responses
- `POST /api/ai/upload-pdf` - Upload PDF for AI processing and teaching
- `POST /api/ai/project-help` - Get help with final year project writing
- `POST /api/ai/update-project` - Update project sections based on feedback
- `POST /api/ai/study-plan` - Generate personalized study plans
- `POST /api/ai/feedback` - Submit feedback on AI responses

## Development

The application is structured as a modern MERN stack with:
- JWT-based authentication
- Protected routes
- Responsive UI with Tailwind CSS
- RESTful API design
- AI integration for study assistance

## Future Enhancements

- [ ] Enhanced OCR accuracy for complex document layouts
- [ ] Advanced quiz analytics and performance insights
- [ ] Collaborative learning features for study groups
- [ ] Mobile app version with offline capabilities
- [ ] Integration with popular learning management systems
- [ ] Voice interaction capabilities for hands-free learning
- [ ] Advanced project template library for different academic fields
- [ ] Real-time collaboration on project writing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.
