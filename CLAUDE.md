# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend Development
- `npm i` - Install dependencies
- `npm run dev` - Start full development environment (frontend + backend + database)
- `npm run dev:vite` - Start only the Vite frontend development server
- `npm run build` - Build frontend for production (TypeScript compilation + Vite build)
- `npm run lint` - Run ESLint on TypeScript/TSX files
- `npm run preview` - Preview production build locally

### Backend Development  
- `npm run dev:go` - Start only the Go backend server
- `go run main.go` - Alternative way to run backend directly

### Database
- `npm run dev:db` - Start PostgreSQL database with pgvector extension via Docker Compose

### Full Development Stack
The main development command `npm run dev` uses concurrently to run all services:
- Vite frontend server (port 5173)
- Go backend server (default Gin port 8080)
- PostgreSQL database (port 5432)

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite, Lexical rich text editor
- **Backend**: Go with Gin web framework, PostgreSQL with pgvector extension
- **Authentication**: SuperTokens for user management
- **AI Integration**: Anthropic Claude API and local Ollama models
- **State Management**: Zustand with persistence to localStorage
- **Styling**: CSS modules and custom CSS

### Project Structure
```
frontend/          - React frontend application
├── components/    - React components (editors, UI elements, plugins)
├── hooks/         - Custom React hooks  
├── providers/     - AI provider integrations (Claude, Ollama)
└── store.ts       - Zustand global state management

main.go           - Go backend entry point
models/           - Go data models
notes/            - Note CRUD operations
streaming/        - AI generation streaming
usersync/         - User data synchronization
markdown/         - JSON to Markdown conversion
```

### Core Concepts

**Stories/Notes**: The primary content type - documents with rich text content stored as Lexical JSON. Stories can be organized hierarchically with parent-child relationships.

**Tags**: Hierarchical tagging system with slash-separated paths (e.g., "project/frontend/components"). Tags are stored with both full path and segmented arrays.

**AI Integration**: Dual provider support:
- Cloud: Anthropic Claude via ModelPad hosted service
- Local: Ollama for self-hosted LLMs
- Configurable model settings (temperature, top_p, etc.)

**Real-time Generation**: Streaming AI responses with abort capability and generation state management.

**Lexical Editor**: Advanced rich text editor with custom nodes for AI prompts, tags, and generated content. Content stored as JSON and converted to Markdown for AI processing.

### Key Files
- `frontend/store.ts` - Central state management with all app state and actions
- `main.go` - Backend server setup, routing, and core handlers
- `frontend/components/StoryEditor.tsx` - Main Lexical editor component
- `frontend/providers/` - AI service integrations
- `models/models.go` - Database models and schema

### Database Schema
Uses PostgreSQL with tables for:
- `notes` - Story/document storage with JSON content, tags, sharing status
- User authentication handled by SuperTokens

### Environment Setup
Requires `.env` file with:
- Database connection string
- SuperTokens configuration
- AI service API keys
- Domain configuration for authentication

### Testing
No specific test commands found in package.json. Check if tests exist and add appropriate commands if implementing testing.