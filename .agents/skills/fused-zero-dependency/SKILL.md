---
name: fused-zero-dependency
description: Enforces the strict zero-dependency, vanilla ES6, and pure CSS architecture for Fused Protective Services frontend development.
---

# Fused Protective Services - Frontend Architecture Skill

When you are asked to build, modify, or debug frontend code (HTML, CSS, JS) in this repository, you **MUST** adhere to the following rules:

## 1. Zero Dependency Rule
- **NO `npm install`**. Do not suggest or install any Node modules for the frontend.
- **NO Frameworks**. Do not use React, Vue, Svelte, or TailwindCSS. 
- **NO External CDNs**. All assets must be hosted locally.

## 2. Vanilla JavaScript (ES Modules)
- All JavaScript must be written as vanilla ES6 modules (`.mjs`).
- UI logic should rely on native DOM APIs (`document.getElementById`, `querySelector`).
- State management for internal tools should utilize `localStorage` for offline-first resilience.

## 3. Styling & CSS Architecture
- Use pure CSS with native CSS variables (Custom Properties) for theming.
- Follow the component-based architecture in `src/styles/components`.
- Rely heavily on CSS Grid and Flexbox. Do not use floats or layout frameworks.

## 4. Build Pipeline
- The project uses a custom Node.js compiler (`build.mjs`).
- If you add a new page or stylesheet, you must ensure it is registered in `build.mjs` for compilation.

## 5. UI/UX Standards
- Fused Protective Services requires ultra-premium, modern, "glassmorphism" or dark/gold accented designs. 
- Always reference `context/ui-standards.md` for exact hex codes (e.g., Fused Gold) and typography rules.
