# Project Roadmap & TODOs

These are the suggested improvements focused on robustness, user experience, and code quality.

## 🛠️ Robustness & Stability
- [ ] **Better History Scraper**: Implement more specific CSS selectors for JanitorAI's React structure to improve scraper accuracy.
- [ ] **Advanced Error Handling**: Handle API-specific errors like rate limits (HTTP 429) or token context exhaustion.

## ✨ User Experience
- [ ] **Custom System Prompts**: Allow users to save and use their own writing styles.

## 🧹 Code Quality
- [ ] **Logic Refactoring**: Extract heuristic scraping and API logic into separate utility modules.
- [ ] **Shadow DOM Implementation**: Wrap UI components in Shadow DOM to prevent CSS leakage or conflicts with the host site.
