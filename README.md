# Reimagined Disco UI

A modern web application for storing and streaming music. Built with Vue 3, this application provides a beautiful interface for browsing your music collection, managing playlists, and streaming audio with full playback controls.

## Features

- **Music Collection Browser** - Browse albums and songs in your collection with a stylish MiniDisc-inspired UI
- **Audio Streaming** - Stream music with full playback controls (play, pause, next, previous)
- **Playlist Management** - Create and manage playlists with enqueue functionality
- **Time Seeking** - Seek within songs using an interactive progress slider
- **Volume Control** - Adjustable volume with mute toggle
- **User Authentication** - Secure login system with session management
- **User Preferences** - Personalizable settings including collection sorting options
- **Error Handling** - Toast notifications for errors and session management

## Tech Stack

- **Vue 3** - Progressive JavaScript framework with Composition API
- **PrimeVue** - Rich UI component library
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **Vite** - Fast build tool and dev server

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/      # Reusable Vue components (AudioPlayer, MiniDisc, ToolBar)
├── pages/          # Page components (Album, Collection, Login, Parameters)
├── plugins/        # Vue plugins (API, router, pinia, logger, toast)
├── stores/         # Pinia stores for state management
├── assets/         # Static assets
└── main.js         # Application entry point
```