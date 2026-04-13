## 2024-11-23 - Accessibility Enhancements
**Learning:** Screen readers often struggle with icon-only buttons that rely solely on `title` attributes, and dynamic content injection often goes unannounced without proper `aria-live` attributes.
**Action:** Always ensure icon-only buttons have explicit `aria-label` attributes and use `aria-live="polite"` on containers where dynamic UI elements like suggestion chips are injected.
