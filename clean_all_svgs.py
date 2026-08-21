#!/usr/bin/env python3
HTML_PATH = "/Users/cope/projects/fused-protective-services/index.html"

with open(HTML_PATH, "r", encoding="utf-8") as f:
    content = f.read()

SVG_PHONE = """<svg style="width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; vertical-align:middle; display:inline-block;" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>"""

SVG_BOLT = """<svg style="width:16px; height:16px; stroke:currentColor; fill:currentColor; stroke-width:1; vertical-align:middle; display:inline-block;" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>"""

SVG_TARGET = """<svg style="width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; vertical-align:middle; display:inline-block;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>"""

content = content.replace("<span>📞</span>", f"<span>{SVG_PHONE}</span>")
content = content.replace("📞 Call", f"{SVG_PHONE} Call")
content = content.replace("<span>⚡</span>", f"<span>{SVG_BOLT}</span>")
content = content.replace("<span>🎯</span>", f"<span>{SVG_TARGET}</span>")

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Replaced all remaining emojis with crisp vector SVGs.")
