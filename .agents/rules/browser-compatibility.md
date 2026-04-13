---
trigger: always_on
---

## Cross-Browser Manifest Compatibility (MV3)
To maintain a single `manifest.json` for Chrome/Edge and Firefox, the manifest includes keys that are browser-specific. This causes non-breaking warnings in the developer console/extension manager during loading.

### Key Mappings
| Feature | Chromium (Chrome/Edge) | Firefox |
| :--- | :--- | :--- |
| **Background Script** | `"service_worker": "background.js"` | `"scripts": ["background.js"]` |
| **Sidebar Key** | `"side_panel"` | `"sidebar_action"` |
| **Permissions** | `"sidePanel"` | *(Ignored by Firefox)* |

### Expected Warnings
- **Chromium:** Will warn about `background.scripts` and `sidebar_action` being unrecognized or requiring MV2.
- **Firefox:** Will warn about `side_panel` properties and `sidePanel` permissions being unexpected.

These warnings are **safe to ignore** during development as browsers skip the keys they do not support. For production/store releases, separate manifests should be generated via a build script to avoid store rejection or user-facing warnings.
