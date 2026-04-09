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
# After cloning the repository: activate the hook(s)
git config core.hooksPath .githooks
```

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

## CI/CD

The GitHub Actions workflow (`.github/workflows/build.yml`) triggers on version tags (`v*`) and:

1. Builds and pushes the Docker image to Docker Hub as `pirraste/reimagined-disco-ui:<tag>`
2. **Write-back** — clones the [k8s repo](https://github.com/pste/reimagined-disco-k8s), updates the image tag in `k8s/kustomization.yaml` via `kustomize edit set image`, and pushes the change back

Required secrets/vars: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `K8S_REPO_TOKEN`.
`K8S_REPO_TOKEN` is a GitHub fine-grained PAT with `Contents: Read and write` on the k8s repo, stored as a secret in the app repo. 

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