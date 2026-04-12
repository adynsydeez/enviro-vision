from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

education_router = APIRouter(prefix="/education", tags=["education"])
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a friendly and engaging teacher creating educational content 
for Queensland primary school students in Years 3–6 (ages 8–12)."""

QUIZ_PROMPT_TEMPLATE = """Generate a {num_questions}-question multiple choice quiz about 
bushfire safety in Queensland, Australia. Follow these requirements:

Quiz structure:
- Each question must have 4 answer options (A, B, C, D)
- Cover a broad range of topics including: fire warning levels, evacuation plans, 
  what to do at home, emergency contacts, and causes of bushfires
- After the quiz, provide a full answer key with the correct answer and a 1–2 sentence 
  explanation for each question

Writing style:
- Use simple, clear vocabulary suitable for primary school students — avoid technical jargon
- Keep sentences short and easy to read
- Use a warm, encouraging tone — avoid scary or alarming language
- Frame questions positively (e.g. "What is the safest thing to do?" rather than 
  "What happens if you don't evacuate?")
- Tailor the difficulty to Year {year_group} students (ages {age_range})

Fun facts:
- After each answer key explanation, include one short fun or interesting fact related 
  to the question topic to keep students engaged

Format the output as:
- Numbered questions (1–{num_questions})
- Answer options on separate lines
- A clearly separated Answer Key section at the end"""

# ── Request / Response Models ─────────────────────────────────────────────────

class QuizRequest(BaseModel):
    num_questions: int         = Field(5,   ge=1, le=10,  description="Number of quiz questions")
    year_group:    int         = Field(4,   ge=3, le=6,   description="Target year group (3–6)")
    scenario_id:   Optional[int] = Field(None,            description="Link quiz to a simulation scenario")

class QuizResponse(BaseModel):
    scenario_id:   Optional[int]
    year_group:    int
    num_questions: int
    content:       str                                     # Raw quiz text from Claude

# ── Helper ────────────────────────────────────────────────────────────────────

YEAR_AGE_MAP = {3: "8–9", 4: "9–10", 5: "10–11", 6: "11–12"}

# ── Routes ────────────────────────────────────────────────────────────────────

@education_router.post("/quiz", response_model=QuizResponse)
def generate_quiz(body: QuizRequest):
    """Generate a bushfire safety quiz tailored to a Queensland primary school year group."""
    age_range = YEAR_AGE_MAP[body.year_group]

    prompt = QUIZ_PROMPT_TEMPLATE.format(
        num_questions = body.num_questions,
        year_group    = body.year_group,
        age_range     = age_range,
    )

    try:
        response = client.messages.create(
            model      = "claude-sonnet-4-20250514",
            max_tokens = 500 + (body.num_questions * 200),  # Scale with question count
            system     = SYSTEM_PROMPT,
            messages   = [{"role": "user", "content": prompt}]
        )
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=503, detail="Could not reach Anthropic API — check your connection.")
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Anthropic API key — check your .env file.")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic rate limit hit — try again shortly.")
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e.message}")

    return QuizResponse(
        scenario_id   = body.scenario_id,
        year_group    = body.year_group,
        num_questions = body.num_questions,
        content       = response.content[0].text,
    )