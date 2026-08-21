#!/usr/bin/env python3
import os

HTML_PATH = "/Users/cope/projects/fused-protective-services/index.html"

with open(HTML_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Define the global SVG definitions
SVG_DEFS = """
    <!-- Global SVG Tactical Gradients -->
    <svg style="display:none;" width="0" height="0">
        <defs>
            <linearGradient id="tacticalGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="25%" stop-color="#f7e5b2" />
                <stop offset="50%" stop-color="#c6a25c" />
                <stop offset="75%" stop-color="#ba9857" />
                <stop offset="100%" stop-color="#72542b" />
            </linearGradient>
        </defs>
    </svg>
"""

# Insert SVG defs right after body tag if not present
if "id=\"tacticalGoldGrad\"" not in content:
    content = content.replace("<body>", "<body>" + SVG_DEFS)

# 1. Executive PPO Icon
SVG_1 = """<svg class="tactical-svg" viewBox="0 0 32 32">
                                <path d="M16 2 L27 6 V15 C27 22 16 29 16 29 C16 29 5 22 5 15 V6 L16 2 Z" stroke="url(#tacticalGoldGrad)" stroke-width="1.6" fill="none"/>
                                <circle cx="16" cy="14" r="5.5" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none" stroke-dasharray="2 1"/>
                                <circle cx="16" cy="14" r="2.5" fill="url(#tacticalGoldGrad)"/>
                                <line x1="16" y1="5" x2="16" y2="8" stroke="url(#tacticalGoldGrad)" stroke-width="1.2"/>
                                <line x1="16" y1="20" x2="16" y2="23" stroke="url(#tacticalGoldGrad)" stroke-width="1.2"/>
                                <line x1="7" y1="14" x2="10" y2="14" stroke="url(#tacticalGoldGrad)" stroke-width="1.2"/>
                                <line x1="22" y1="14" x2="25" y2="14" stroke="url(#tacticalGoldGrad)" stroke-width="1.2"/>
                                <path d="M12 24 C13 25 15 26 16 26 C17 26 19 25 20 24" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
                            </svg>"""

# 2. Event & Venue Access Icon
SVG_2 = """<svg class="tactical-svg" viewBox="0 0 32 32">
                                <path d="M4 26 V10 L16 3 L28 10 V26" stroke="url(#tacticalGoldGrad)" stroke-width="1.6" fill="none"/>
                                <path d="M10 26 V15 C10 12 22 12 22 15 V26" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
                                <line x1="2" y1="26" x2="30" y2="26" stroke="url(#tacticalGoldGrad)" stroke-width="1.8"/>
                                <circle cx="16" cy="9" r="2" fill="url(#tacticalGoldGrad)"/>
                                <path d="M16 17 V22" stroke="url(#tacticalGoldGrad)" stroke-width="1.2"/>
                                <circle cx="6" cy="10" r="1.5" fill="url(#tacticalGoldGrad)"/>
                                <circle cx="26" cy="10" r="1.5" fill="url(#tacticalGoldGrad)"/>
                                <path d="M12 26 V20 H20 V26" stroke="url(#tacticalGoldGrad)" stroke-width="1" fill="none"/>
                            </svg>"""

# 3. Commercial Patrol Icon
SVG_3 = """<svg class="tactical-svg" viewBox="0 0 32 32">
                                <rect x="5" y="8" width="10" height="18" rx="1" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
                                <rect x="17" y="4" width="10" height="22" rx="1" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
                                <line x1="8" y1="12" x2="12" y2="12" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <line x1="8" y1="16" x2="12" y2="16" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <line x1="8" y1="20" x2="12" y2="20" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <line x1="20" y1="8" x2="24" y2="8" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <line x1="20" y1="12" x2="24" y2="12" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <line x1="20" y1="16" x2="24" y2="16" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <line x1="20" y1="20" x2="24" y2="20" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <circle cx="22" cy="4" r="1.5" fill="url(#tacticalGoldGrad)"/>
                                <path d="M2 28 H30" stroke="url(#tacticalGoldGrad)" stroke-width="1.8"/>
                                <path d="M22 1 A5 5 0 0 1 27 6" stroke="url(#tacticalGoldGrad)" stroke-width="1" stroke-dasharray="2 1" fill="none"/>
                            </svg>"""

# 4. Construction Defense Icon
SVG_4 = """<svg class="tactical-svg" viewBox="0 0 32 32">
                                <path d="M6 28 L14 6 H28 L24 12 H14" stroke="url(#tacticalGoldGrad)" stroke-width="1.4" fill="none"/>
                                <line x1="28" y1="6" x2="28" y2="18" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" stroke-dasharray="2 1"/>
                                <rect x="25" y="18" width="6" height="5" rx="0.5" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
                                <line x1="14" y1="6" x2="14" y2="28" stroke="url(#tacticalGoldGrad)" stroke-width="1.5"/>
                                <line x1="9" y1="28" x2="19" y2="28" stroke="url(#tacticalGoldGrad)" stroke-width="2"/>
                                <path d="M10 18 L14 14 L18 18" stroke="url(#tacticalGoldGrad)" stroke-width="1" fill="none"/>
                                <path d="M10 24 L14 20 L18 24" stroke="url(#tacticalGoldGrad)" stroke-width="1" fill="none"/>
                                <circle cx="14" cy="6" r="1.8" fill="url(#tacticalGoldGrad)"/>
                            </svg>"""

# 5. Estate & Ranch Defense Icon
SVG_5 = """<svg class="tactical-svg" viewBox="0 0 32 32">
                                <path d="M3 26 V12 L16 3 L29 12 V26" stroke="url(#tacticalGoldGrad)" stroke-width="1.5" fill="none"/>
                                <path d="M7 26 V15 L16 8 L25 15 V26" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
                                <line x1="16" y1="8" x2="16" y2="26" stroke="url(#tacticalGoldGrad)" stroke-width="1.2"/>
                                <line x1="7" y1="20" x2="25" y2="20" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <circle cx="16" cy="14" r="2.5" fill="url(#tacticalGoldGrad)"/>
                                <line x1="1" y1="26" x2="31" y2="26" stroke="url(#tacticalGoldGrad)" stroke-width="2"/>
                                <path d="M12 26 V22 C12 20 20 20 20 22 V26" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" fill="none"/>
                            </svg>"""

# 6. Emergency Tactical Dispatch Icon
SVG_6 = """<svg class="tactical-svg" viewBox="0 0 32 32">
                                <polygon points="17,2 7,16 15,16 13,30 25,14 17,14" fill="url(#tacticalGoldGrad)" stroke="url(#tacticalGoldGrad)" stroke-width="1"/>
                                <circle cx="16" cy="16" r="13" stroke="url(#tacticalGoldGrad)" stroke-width="1.2" stroke-dasharray="3 2" fill="none"/>
                                <circle cx="16" cy="16" r="9" stroke="url(#tacticalGoldGrad)" stroke-width="0.8" fill="none"/>
                                <path d="M4 16 H1 M31 16 H28 M16 4 V1 M16 31 V28" stroke="url(#tacticalGoldGrad)" stroke-width="1.5"/>
                            </svg>"""

import re

# Replace each SVG inside spine-icon-housing in order
pattern = r'(<div class="spine-icon-housing">\s*)<svg[^>]*>.*?</svg>(\s*</div>)'

matches = list(re.finditer(pattern, content, flags=re.DOTALL))
if len(matches) == 6:
    print("Found 6 bookshelf icon slots. Replacing with bespoke tactical vector emblems...")
    
    replacements = [SVG_1, SVG_2, SVG_3, SVG_4, SVG_5, SVG_6]
    
    # Replace from back to front to preserve offsets
    for i in range(5, -1, -1):
        m = matches[i]
        new_block = f'{m.group(1)}{replacements[i]}{m.group(2)}'
        content = content[:m.start()] + new_block + content[m.end():]

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully updated index.html with custom icons!")
else:
    print(f"Warning: Found {len(matches)} matches, expected 6.")
