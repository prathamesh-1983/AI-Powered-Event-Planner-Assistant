# EventGenie / UtsavPlan 🪄✨
> **AI-Powered Celebration & Event Planner Assistant**
> *Built for Hack2Skill PromptWars Challenge 5*

EventGenie is a modern, full-stack, AI-driven event planning assistant designed to help users seamlessly organize weddings, birthdays, anniversaries, corporate galas, and community festivals. Powered by Google's Gemini API, it dynamically generates personalized budgets, timelines, vendor checklists, and offers an interactive AI event strategist.

![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![UI Theme](https://img.shields.io/badge/UI-Dark%20Theme-slate.svg)
![AI Powered](https://img.shields.io/badge/AI-Google%20Gemini-blue.svg)

---

## 🌟 Key Features

- 🎯 **Interactive Multi-Step Wizard**: Custom tailored event generation based on type, budget, guest count, cultural preferences, and theme vibes.
- 📊 **Smart Budget Allocator**: Real-time spending calculators with dynamic category breakdowns (Venue, Catering, Decor, etc.) and visual progress indicators.
- ⏱️ **Phased Milestone Timeline**: Chronological event roadmap ("6 Months Out" to "Day-Of") with interactive task trackers.
- 📋 **Prioritized Vendor Checklist**: Status management (Not Contacted, Booked, Paid) with estimated vs. actual cost comparisons.
- 💬 **Context-Aware AI Assistant**: Integrated chatbot powered by Gemini API for on-the-fly theme suggestions, custom menus, and timeline adjustments.
- 🌙 **Sleek Dark UI**: Built with a high-contrast dark aesthetic for effortless readability and smooth user experience.
- 💾 **Local Persistence**: Integrated local state management so your event progress is never lost.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ES6+), Lucide Icons
- **Backend**: Node.js, Express.js
- **AI Integration**: Google Gemini API (`@google/genai`)
- **State & Storage**: Browser `localStorage` & Express REST APIs

---

## 📁 Repository Structure

```text
EventGenie/
├── public/
│   ├── index.html        # Main application entry point & layout
│   ├── styles.css        # Custom styles & Tailwind overrides
│   └── app.js            # Client-side UI renderer & state controller
├── server.js             # Express backend & Gemini API integration
├── .env.example          # Environment variable template
├── package.json          # Project dependencies & scripts
└── README.md             # Project documentation
```

---

## 🚀 Getting Started

Follow these steps to get the application up and running locally.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- A **Google Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/))

### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/prathamesh-1983/AI-Powered-Event-Planner-Assistant
   cd event-genie
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to create your `.env` file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and add your Gemini API Key:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. **Run the Application**:
   - For production mode:
     ```bash
     npm start
     ```
   - For development mode (with hot reload):
     ```bash
     npm run dev
     ```

5. **Open in Browser**:
   Navigate to `http://localhost:3000` to interact with EventGenie.

---

## 📸 Core Screenshots & Workflow

| Event Wizard | Smart Dashboard & Budget | AI Assistant Chat |
| :---: | :---: | :---: |
| *3-step detailed setup form* | *Dynamic visual spending breakdown* | *Instant tailored event planning tips* |

---

## 🤖 API Routes

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/generate-plan` | `POST` | Sends event inputs to Gemini API & returns complete JSON blueprint |
| `/api/chat` | `POST` | Handles ongoing conversational query prompts for event context |
| `/api/status` | `GET` | Health check route to verify backend & API readiness |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🏆 Hackathon Context

This project was built for **Hack2Skill PromptWars (Virtual) - Challenge 5: Celebration & Event Planner**.
