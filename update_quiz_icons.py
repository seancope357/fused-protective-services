#!/usr/bin/env python3
import re

HTML_PATH = "/Users/cope/projects/fused-protective-services/index.html"

with open(HTML_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Step 1 Icons (24x24 custom SVGs)
SVG_QUIZ_VIP = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <path d="M12 2 L20 5 V11 C20 16 12 21 12 21 C12 21 4 16 4 11 V5 L12 2 Z" stroke="url(#tacticalGoldGrad)" stroke-width="1.5" fill="none"/>
  <circle cx="12" cy="10" r="3" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
  <path d="M9 17 C9 15 11 14 12 14 C13 14 15 15 15 17" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
</svg>"""

SVG_QUIZ_EVENT = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <path d="M3 20 V8 L12 2 L21 8 V20" stroke="url(#tacticalGoldGrad)" stroke-width="1.5" fill="none"/>
  <path d="M8 20 V12 C8 9.5 16 9.5 16 12 V20" stroke="url(#tacticalGoldGrad)" stroke-width="1.3" fill="none"/>
  <circle cx="12" cy="7" r="1.5" fill="url(#tacticalGoldGrad)"/>
  <line x1="2" y1="20" x2="22" y2="20" stroke="url(#tacticalGoldGrad)" stroke-width="1.8"/>
</svg>"""

SVG_QUIZ_COMMERCIAL = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <rect x="4" y="6" width="7" height="14" rx="1" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
  <rect x="13" y="3" width="7" height="17" rx="1" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
  <line x1="6" y1="9" x2="9" y2="9" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="6" y1="13" x2="9" y2="13" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="15" y1="7" x2="18" y2="7" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="15" y1="11" x2="18" y2="11" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="15" y1="15" x2="18" y2="15" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="2" y1="21" x2="22" y2="21" stroke="url(#tacticalGoldGrad)" stroke-width="1.8"/>
</svg>"""

SVG_QUIZ_CONSTRUCTION = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <path d="M4 21 L10 4 H21 L18 9 H10" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
  <line x1="21" y1="4" x2="21" y2="14" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" stroke-dasharray="2 1"/>
  <rect x="18.5" y="14" width="5" height="4" rx="0.5" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
  <line x1="10" y1="4" x2="10" y2="21" stroke="url(#tacticalGoldGrad)" stroke-width="1.5"/>
  <line x1="2" y1="21" x2="22" y2="21" stroke="url(#tacticalGoldGrad)" stroke-width="1.8"/>
</svg>"""

# Step 2 Icons
SVG_QUIZ_LOW = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="9" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
  <polyline points="9 12 11 14 15 10" stroke="var(--color-emerald)" stroke-width="1.6" fill="none"/>
</svg>"""

SVG_QUIZ_MED = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="9" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
  <circle cx="12" cy="12" r="4" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
  <line x1="12" y1="5" x2="12" y2="8" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="12" y1="16" x2="12" y2="19" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="5" y1="12" x2="8" y2="12" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
  <line x1="16" y1="12" x2="19" y2="12" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
</svg>"""

SVG_QUIZ_HIGH = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
  <circle cx="12" cy="12" r="2" fill="url(#tacticalGoldGrad)"/>
</svg>"""

SVG_QUIZ_ELEVATED = """<svg class="tactical-svg" style="width:22px; height:22px; flex-shrink:0;" viewBox="0 0 24 24">
  <path d="M12 2 L22 20 H2 Z" stroke="var(--color-crimson)" stroke-width="1.5" fill="none"/>
  <line x1="12" y1="8" x2="12" y2="13" stroke="var(--color-crimson)" stroke-width="1.5"/>
  <circle cx="12" cy="16.5" r="1" fill="var(--color-crimson)"/>
</svg>"""

SVG_QUIZ_RESULT_SHIELD = """<svg class="tactical-svg" style="width:48px; height:48px; margin:0 auto 12px;" viewBox="0 0 32 32">
  <path d="M16 2 L27 6 V15 C27 22 16 29 16 29 C16 29 5 22 5 15 V6 L16 2 Z" stroke="url(#tacticalGoldGrad)" stroke-width="1.6" fill="none"/>
  <polyline points="11 16 15 20 21 12" stroke="url(#tacticalGoldGrad)" stroke-width="1.8" fill="none"/>
</svg>"""

# Replace in content
old_step1 = """                    <div class="quiz-options-grid">
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Private VIP / Executive Itinerary')">
                            <span>👔</span> Executive Travel / VIP Personal Escort
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Special Event / Luxury Wedding / Gala')">
                            <span>🎪</span> Luxury Event / Wedding / Gala Venue
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Commercial Property / Office Complex')">
                            <span>🏢</span> Commercial Property / Corporate Complex
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Active Construction / High-Value Asset Site')">
                            <span>🏗️</span> Construction / High-Value Equipment Site
                        </button>
                    </div>"""

new_step1 = f"""                    <div class="quiz-options-grid">
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Private VIP / Executive Itinerary')">
                            {SVG_QUIZ_VIP} Executive Travel / VIP Personal Escort
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Special Event / Luxury Wedding / Gala')">
                            {SVG_QUIZ_EVENT} Luxury Event / Wedding / Gala Venue
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Commercial Property / Office Complex')">
                            {SVG_QUIZ_COMMERCIAL} Commercial Property / Corporate Complex
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(1, 'Active Construction / High-Value Asset Site')">
                            {SVG_QUIZ_CONSTRUCTION} Construction / High-Value Equipment Site
                        </button>
                    </div>"""

old_step2 = """                    <div class="quiz-options-grid">
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'Low Risk / Private Gathering (< 100 Guests)')">
                            <span>🟢</span> Low / Intimate (&lt; 100 Guests)
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'Medium Risk / Large Event (100 - 500 Guests)')">
                            <span>🟡</span> Moderate / Public (100–500 Attendees)
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'High Profile / Public VIP Presence')">
                            <span>🟠</span> High Profile / VIP Media Attention
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'Elevated Threat / Immediate Asset Protection')">
                            <span>🔴</span> Elevated / Immediate Known Threat
                        </button>
                    </div>"""

new_step2 = f"""                    <div class="quiz-options-grid">
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'Low Risk / Private Gathering (< 100 Guests)')">
                            {SVG_QUIZ_LOW} Low / Intimate (&lt; 100 Guests)
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'Medium Risk / Large Event (100 - 500 Guests)')">
                            {SVG_QUIZ_MED} Moderate / Public (100–500 Attendees)
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'High Profile / Public VIP Presence')">
                            {SVG_QUIZ_HIGH} High Profile / VIP Media Attention
                        </button>
                        <button type="button" class="quiz-option-btn" onclick="selectQuizOption(2, 'Elevated Threat / Immediate Asset Protection')">
                            {SVG_QUIZ_ELEVATED} Elevated / Immediate Known Threat
                        </button>
                    </div>"""

old_step3 = """                <div class="threat-quiz-step" id="quizStep3" style="text-align: center;">
                    <div style="font-size: clamp(32px, 5vw, 44px); margin-bottom: 10px;">🛡️</div>"""

new_step3 = f"""                <div class="threat-quiz-step" id="quizStep3" style="text-align: center;">
                    {SVG_QUIZ_RESULT_SHIELD}"""

content = content.replace(old_step1, new_step1)
content = content.replace(old_step2, new_step2)
content = content.replace(old_step3, new_step3)

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Replaced Threat Assessment emojis with custom tactical vector SVGs successfully!")
