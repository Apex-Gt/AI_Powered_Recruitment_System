# OpenCode with NVIDIA API Provider - Windows Setup Guide

Complete beginner-friendly guide for setting up OpenCode with NVIDIA API on Windows using VS Code integrated terminal.

## Prerequisites

- **Windows 10/11**
- **VS Code** - [Download](https://code.visualstudio.com/)
- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **npm** (included with Node.js)

### Verify Installation

```powershell
node --version
npm --version
```

Expected output:
```
v18.x.x
9.x.x
```

## Install OpenCode

```powershell
npm install -g opencode
```

### Verify Installation

```powershell
opencode --version
```

## Open and Configure Project

1. **Open project in VS Code**
   - File → Open Folder → Select `D:\AI\AI_Powered_Recruitment_System`

2. **Open integrated terminal**
   - Terminal → New Terminal (or `Ctrl+``)

3. **Navigate to project directory** (if not already there)
   ```powershell
   cd D:\AI\AI_Powered_Recruitment_System
   ```

4. **Start OpenCode**
   ```powershell
   opencode
   ```

## NVIDIA API Setup

### Generate API Key

1. Go to [NVIDIA API Key Page](https://build.nvidia.com/)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Generate API Key**
5. Copy the key immediately (shown only once)

> **⚠️ SECURITY WARNING**: Never commit API keys to GitHub, share publicly, or include in code. Treat like a password.

## Connect NVIDIA to OpenCode

1. In OpenCode terminal, type:
   ```
   /connect
   ```

2. Select **NVIDIA** from the provider list

3. Paste your NVIDIA API key when prompted

## Select an NVIDIA Model

```powershell
/models
```

- Lists all available NVIDIA models
- Available models may change over time
- Example NVIDIA models: `nvidia/llama-3.1-nemotron-70b-instruct`, `nvidia/nemotron-3-ultra`

## Verify Configuration

### Check Authentication

```powershell
opencode auth list
```

### Restart OpenCode

```powershell
# Exit OpenCode with Ctrl+C, then:
opencode
```

### Test Prompt

```
Explain what this project does in 2 sentences
```

## How to Use OpenCode Effectively

| Step | Action | Command/Prompt |
|------|--------|----------------|
| 1 | Analyze project before modifying | `Analyze the project architecture and structure` |
| 2 | Identify problems | `Find potential bugs or issues in the codebase` |
| 3 | Ask for explanations | `Explain the planned changes before implementing` |
| 4 | Implement changes | `Implement the fix for [specific issue]` |
| 5 | Review changes | `Review the changes you made` |
| 6 | Run tests | `Run the test suite to verify changes` |

## Useful OpenCode Commands

| Command | Description |
|---------|-------------|
| `opencode` | Start OpenCode |
| `opencode --version` | Show version |
| `opencode auth list` | List configured providers |
| `/connect` | Connect to a provider |
| `/models` | List available models |

## Example Workflow for Spring Boot Project

```text
# 1. Analyze architecture
Analyze the Spring Boot project architecture and main components

# 2. Analyze authentication/JWT
Examine the JWT authentication implementation and security configuration

# 3. Find bugs
Identify potential security vulnerabilities or bugs in the auth system

# 4. Implement specific fix
Fix the token refresh endpoint to handle expired refresh tokens properly

# 5. Review changes
Review the authentication changes for correctness and security
```

### .env.example Template

```env
# Copy to .env and fill in your values
NVIDIA_API_KEY=your_nvidia_api_key_here
```

> **Never include real API keys in .env.example or any committed file.**

## Troubleshooting

### `opencode is not recognized`

```powershell
# Add npm global to PATH
npm config get prefix
# Add the output path to System Environment Variables → PATH
# Restart terminal
```

### NVIDIA Authentication Failure

1. Verify API key is correct
2. Check internet connection
3. Regenerate API key at [NVIDIA Build](https://build.nvidia.com/)
4. Reconnect: `/connect` → NVIDIA → paste new key

### NVIDIA Model Unavailable

```powershell
/models
# Select a different available model
# Models change periodically; check NVIDIA documentation
```

### OpenCode Installation Problems

```powershell
# Clear npm cache
npm cache clean --force

# Reinstall
npm uninstall -g opencode
npm install -g opencode
```

## Quick Start

Copy-paste this sequence:

```powershell
# 1. Open project
code D:\AI\AI_Powered_Recruitment_System

# 2. In VS Code terminal (Ctrl+`):
cd D:\AI\AI_Powered_Recruitment_System

# 3. Install & start OpenCode
npm install -g opencode
opencode

# 4. In OpenCode:
/connect
# Select NVIDIA
# Paste your NVIDIA API key

# 5. Select model
/models

# 6. Test
Explain this project in 2 sentences
```

---

## Using This Repository

### Clone the Repository

```powershell
git clone https://github.com/your-username/AI_Powered_Recruitment_System.git
cd AI_Powered_Recruitment_System
```

### Setup Development Environment

```powershell
# Backend (if applicable)
cd backend
# Follow backend-specific setup instructions

# Frontend
cd frontend
npm install
npm run dev
```

### Run Tests

```powershell
# Frontend tests
cd frontend
npm test

# Backend tests (if applicable)
cd backend
# Follow backend test commands
```

### Environment Configuration

```powershell
# Copy example env file
cp .env.example .env

# Edit .env with your values
# Add your NVIDIA_API_KEY and other secrets
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and test
4. Commit: `git commit -m "feat: your feature description"`
5. Push: `git push origin feature/your-feature`
6. Open a Pull Request

---

**Happy Coding with OpenCode & NVIDIA!** 🚀