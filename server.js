import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const allowedEventTypes = new Set([
  "Wedding",
  "Birthday",
  "Anniversary",
  "Corporate Gala",
  "Community Festival",
]);
const allowedVibes = new Set([
  "Modern Minimalist",
  "Royal Traditional",
  "Bohemian",
  "Cyberpunk",
]);
const maxPromptChars = 12_000;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: "32kb", strict: true }));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again in a few minutes." },
  }),
);
app.use("/api", (request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

const aiRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI request limit reached. Please wait a few minutes and try again." },
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    aiConfigured: Boolean(apiKey),
    model: apiKey ? model : null,
  });
});

app.post("/api/blueprint", aiRateLimit, async (request, response, next) => {
  try {
    const event = validateEvent(request.body);
    const prompt = [
      "You are EventGenie, an experienced event planner. Create a practical, culturally thoughtful event blueprint.",
      "Return only valid JSON with this shape:",
      '{"theme":"short theme","summary":"2-3 sentences","recommendations":["..."],"timeline":[{"title":"...","phase":"..."}],"vendors":[{"category":"...","estimate":0}],"budgetTips":["..."]}',
      "Keep recommendations specific, realistic, and within the stated budget.",
      `Event: ${event.name}`,
      `Type: ${event.type}`,
      `Date: ${event.date}`,
      `Guests: ${event.guests}`,
      `Budget: ${event.currency} ${event.budget}`,
      `Vibe: ${event.vibe}`,
      `Traditions and preferences: ${event.preferences || "None specified"}`,
    ].join("\n");

    const generated = await generateContent(prompt, true);
    let blueprint;
    try {
      blueprint = JSON.parse(generated);
    } catch {
      throw new UpstreamError("Gemini returned a response that was not valid JSON.");
    }

    response.json({ blueprint: validateBlueprint(blueprint) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", aiRateLimit, async (request, response, next) => {
  try {
    const message = readText(request.body?.message, "message", 2_000);
    if (
      request.body?.context !== undefined &&
      typeof request.body.context !== "string"
    ) {
      throw new ValidationError("Chat context must be text.");
    }
    const context = (request.body?.context ?? "").trim().slice(0, 4_000);
    const history = validateHistory(request.body?.history);
    const conversation = [
      "You are EventCopilot, a practical and friendly celebration-planning assistant.",
      "Give concise, actionable answers, use markdown bullets when useful, and respect the user's stated budget and traditions.",
      context ? `Current event context:\n${context}` : "",
      ...history.map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`),
      `User: ${message}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const answer = await generateContent(conversation, false);

    response.json({ answer });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDir, { index: "index.html", maxAge: "1h" }));

app.use((request, response, next) => {
  if (request.path.startsWith("/api/")) {
    response.status(404).json({ error: "API endpoint not found." });
    return;
  }
  next();
});

app.use((error, _request, response, _next) => {
  if (error instanceof ValidationError) {
    response.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof UpstreamError) {
    response.status(502).json({ error: error.message });
    return;
  }
  if (error?.type === "entity.too.large") {
    response.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }

  console.error("Request failed:", error);
  response.status(500).json({ error: "The server could not complete this request." });
});

app.listen(port, () => {
  console.log(`EventGenie is running at http://localhost:${port}`);
  console.log(apiKey ? `Gemini AI is enabled (${model}).` : "Gemini AI is not configured; local planning remains available.");
});

async function generateContent(prompt, jsonResponse) {
  if (!apiKey) {
    throw new UpstreamError("Gemini is not configured. Add GEMINI_API_KEY to your .env file.");
  }

  let upstream;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt.slice(0, maxPromptChars) }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 1_500,
            ...(jsonResponse ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new UpstreamError("Gemini took too long to respond. Please try again.");
    }
    throw new UpstreamError("Could not reach Gemini. Check the server's network connection.");
  }

  if (!upstream.ok) {
    if (upstream.status === 429) {
      throw new UpstreamError("Gemini is temporarily rate-limited. Please try again shortly.");
    }
    if (upstream.status === 401 || upstream.status === 403) {
      throw new UpstreamError("Gemini rejected the server API key. Check GEMINI_API_KEY.");
    }
    console.error(`Gemini request failed with status ${upstream.status}.`);
    throw new UpstreamError("Gemini could not complete the request. Please try again.");
  }

  const payload = await upstream.json();
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new UpstreamError("Gemini returned an empty response. Please try again.");
  }
  return text;
}

function validateEvent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Event details must be sent as an object.");
  }
  const type = readText(body.type, "event type", 40);
  const name = readText(body.name, "event name", 100);
  const date = readText(body.date, "event date", 10);
  const currency = body.currency === "INR" ? "INR" : body.currency === "USD" ? "USD" : null;
  const vibe = readText(body.vibe, "vibe", 40);
  if (body.preferences !== undefined && typeof body.preferences !== "string") {
    throw new ValidationError("Event preferences must be text.");
  }
  const preferences = (body.preferences ?? "").trim();
  const guests = Number(body.guests);
  const budget = Number(body.budget);

  if (!allowedEventTypes.has(type)) {
    throw new ValidationError("Choose a supported event type.");
  }
  if (!allowedVibes.has(vibe)) {
    throw new ValidationError("Choose a supported event vibe.");
  }
  if (!currency) {
    throw new ValidationError("Currency must be USD or INR.");
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new ValidationError("Enter a valid event date.");
  }
  if (preferences.length > 500) {
    throw new ValidationError("Event preferences must be 500 characters or fewer.");
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 100_000) {
    throw new ValidationError("Guest count must be between 1 and 100000.");
  }
  if (!Number.isFinite(budget) || budget <= 0 || budget > 1_000_000_000) {
    throw new ValidationError("Budget must be a positive amount.");
  }

  return { type, name, date, currency, vibe, preferences, guests, budget };
}

function readText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new ValidationError(`${label} must contain 1 to ${maxLength} characters.`);
  }
  return value.trim();
}

function validateHistory(history) {
  if (history === undefined) {
    return [];
  }
  if (!Array.isArray(history)) {
    throw new ValidationError("Chat history must be an array.");
  }
  return history.slice(-8).map((item) => {
    if (!item || !["user", "assistant"].includes(item.role)) {
      throw new ValidationError("Chat history contains an invalid role.");
    }
    return {
      role: item.role,
      content: readText(item.content, "chat history message", 2_000),
    };
  });
}

function validateBlueprint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UpstreamError("Gemini returned an invalid event blueprint.");
  }
  const readList = (items, maxItems, maxLength) =>
    Array.isArray(items)
      ? items
          .filter((item) => typeof item === "string" && item.trim())
          .slice(0, maxItems)
          .map((item) => item.trim().slice(0, maxLength))
      : [];
  const timeline = Array.isArray(value.timeline)
    ? value.timeline
        .filter((item) => item && typeof item.title === "string")
        .slice(0, 12)
        .map((item) => ({
          title: item.title.trim().slice(0, 120),
          phase: typeof item.phase === "string" ? item.phase.trim().slice(0, 40) : "Planning",
        }))
    : [];
  const vendors = Array.isArray(value.vendors)
    ? value.vendors
        .filter((item) => item && typeof item.category === "string")
        .slice(0, 8)
        .map((item) => ({
          category: item.category.trim().slice(0, 50),
          estimate: Number.isFinite(Number(item.estimate))
            ? Math.max(0, Number(item.estimate))
            : 0,
        }))
    : [];

  return {
    theme: typeof value.theme === "string" ? value.theme.trim().slice(0, 120) : "A celebration made personal",
    summary: typeof value.summary === "string" ? value.summary.trim().slice(0, 1_000) : "",
    recommendations: readList(value.recommendations, 8, 240),
    timeline,
    vendors,
    budgetTips: readList(value.budgetTips, 6, 240),
  };
}

class ValidationError extends Error {}
class UpstreamError extends Error {}
