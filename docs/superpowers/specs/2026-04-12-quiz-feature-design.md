# Design Spec: Quiz Feature - Fire Safety & Australian Wildfires

**Date:** 2026-04-12  
**Status:** Approved  
**Target Audience:** Young Adults (Engaging, practical, science-grounded)

## 1. Overview
A dedicated quiz feature for the FireCommander platform to educate users on Australian bushfire behavior, ecology, and prevention. The quiz is accessible from the landing page and provides interactive feedback via the project mascot.

## 2. User Flow
1.  **Entry:** User clicks a "Quiz" button in the top-right header of the `LandingPage`.
2.  **Transition:** `App.jsx` switches the view state to `quiz`.
3.  **Quiz Loop (10 Questions):**
    -   A random selection of 10 questions is presented one by one.
    -   User selects one of 4 options.
    -   **Immediate Feedback:** A mascot speech bubble appears, stating if the answer was correct/incorrect and providing a "Fun Fact".
    -   User clicks "Next Question" to proceed.
4.  **Results Screen:**
    -   Final score is displayed.
    -   Mascot provides a personalized "Fun Statement" based on the score.
    -   Options to "Restart Quiz" or "Back to Home".

## 3. Architecture & Components

### A. Data Layer (`src/data/quiz-questions.js`)
An array of question objects containing:
- `question`: (string)
- `options`: (string[]) - 4 choices
- `correctIndex`: (number)
- `fact`: (string) - The fun fact for the mascot to share.

### B. Logic Layer (`QuizPage.jsx`)
- **State Management:**
  - `shuffledQuestions`: Randomized subset of 10 questions.
  - `currentIndex`: Track progress (0-9).
  - `score`: Count of correct answers.
  - `selectedOption`: Index of the user's choice (null until clicked).
  - `isAnswered`: Boolean to toggle feedback UI.
- **Randomization:** Uses a basic shuffle algorithm (e.g., Fisher-Yates) on mount.

### C. Visual Layer (`MascotBubble.jsx`)
- **Mascot:** Uses `@frontend/public/mascot-ingame.png`.
- **Bubble:** Friendly, rounded speech bubble with a tail pointing to the mascot.
- **Theme:** "Tactical Sentinel" (dark mode containers) mixed with "Friendly" (orange/white bubble accents).
- **Navigation:** Progress bar showing 1/10, 2/10, etc.

## 4. Content

### Mascot Final Statements
- **0–3 correct:** "Don't sweat it, recruit! Even the best firefighters started as trainees. Let's hit the books and try again?"
- **4–7 correct:** "Nice work, Fire Watcher! You've got the basics down, but there's more to learn about the bush. Want to go again?"
- **8–9 correct:** "Impressive! You're a Fire Warden in the making. Just a few more facts to master and you'll be unstoppable!"
- **10 correct:** "Incredible! You're a Fire Commander! The forest is safer with you on watch. You've mastered the fire science!"

### Question Bank (10 randomized per session)
| # | Question | Options | Correct | Mascot Fun Fact |
|---|---|---|---|---|
| 1 | What are the three factors in the "Fire Behaviour Triangle"? | A) Oxygen, Heat, Fuel<br>B) **Vegetation, Weather, Terrain**<br>C) Wind, Slope, Humidity<br>D) Ignition, Fuel, Suppression | B | While the 'Fire Triangle' (Oxygen/Heat/Fuel) starts a fire, the 'Behaviour Triangle' determines how it spreads! |
| 2 | What is the primary purpose of a "controlled burn"? | A) Clear land for houses<br>B) **Reduce fuel load**<br>C) Test equipment<br>D) Kill pests | B | By burning dry grass and leaves safely in winter, we prevent massive, uncontrollable 'megafires' in the summer. |
| 3 | How do many Eucalyptus trees survive a bushfire? | A) Fire-retardant sap<br>B) **Epicormic buds**<br>C) Deep roots<br>D) Dropping leaves | B | Those fuzzy green leaves you see on burnt trunks are from 'epicormic buds' hidden deep under the protective bark! |
| 4 | A "Catastrophic" fire rating means you should... | A) Stay and defend<br>B) **Leave early**<br>C) Wait for smoke<br>D) Call triple zero | B | Under 'Catastrophic' conditions, even the strongest homes aren't safe. Leaving early is the only way to guarantee your safety. |
| 5 | What is an ember "spot fire"? | A) Unattended campfire<br>B) Cooking fire<br>C) **New fire started by wind-blown embers**<br>D) Small, non-spreading fire | C | Embers can fly over 30 kilometers ahead of a fire, starting new fires where you least expect them! |
| 6 | What is the best way to protect your home from embers? | A) Paint it white<br>B) **Clear gutters and move woodpiles**<br>C) Keep windows open<br>D) Water the roof once | B | Most houses are lost to tiny embers getting into gutters or under decks, not the main wall of flame! |
| 7 | Why do some Banksia pods need fire? | A) To stay warm<br>B) **To release seeds**<br>C) To change color<br>D) To attract birds | B | Many Australian plants are 'serotinous'—their woody pods only pop open to release seeds after the heat of a fire! |
| 8 | How does "Cultural Burning" differ from modern hazard reduction? | A) It uses chemicals<br>B) **It's cooler, patchier, and promotes biodiversity**<br>C) It's done from planes<br>D) It burns everything | B | First Nations people have used 'cool fires' for millennia to protect the land and keep the ecosystem in balance. |
| 9 | Fire travels fastest... | A) Downhill<br>B) **Uphill**<br>C) On flat ground<br>D) Against the wind | B | Fire moves much faster uphill because the flames 'pre-heat' the fuel above them. For every 10° of slope, a fire doubles its speed! |
| 10 | Which of these belongs in a Bushfire Survival Kit? | A) Battery radio & torch<br>B) Protective cotton clothing<br>C) Plenty of water<br>D) **All of the above** | D | A battery radio is vital because the internet and power often go out during a major fire event. |

## 5. Technical Details
- **Styling:** Tailwind CSS v4.
- **Icons:** `lucide-react` (Check, X, ArrowRight, RotateCcw, Home).
- **Navigation:** State-based in `App.jsx` using a `currentView` variable.
- **Assets:** `frontend/public/mascot-ingame.png`.
