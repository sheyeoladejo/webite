# SheyeOladejo — Shopify Theme

Custom Shopify Online Store theme for [SheyeOladejo](https://sheyeoladejo.com), a luxury womenswear brand founded by Oluwaseye Oladejo. The storefront covers ready-to-wear, couture consultations, editorial “Moments” content, and brand storytelling.

**Live site:** [https://sheyeoladejo.com](https://sheyeoladejo.com)

The theme is built on [Shopify Dawn](https://github.com/Shopify/dawn) (v15.4.1) and extended with custom sections, templates, and brand assets for SheyeOladejo.

---

## Repository structure

This is a standard Shopify theme layout. Most day-to-day work happens in `sections/`, `templates/`, `snippets/`, and `assets/`.

```
sheye/
├── assets/          # CSS, JavaScript, fonts, SVG logos, and icons
├── config/          # Theme settings (settings_schema.json, settings_data.json)
├── layout/          # Base HTML shells (theme.liquid, password.liquid)
├── locales/         # Translation strings for the theme editor and storefront
├── sections/        # Reusable page blocks and section groups (header, footer)
├── snippets/        # Smaller Liquid partials included by sections
├── templates/       # JSON templates that map URLs to sections
└── .shopify/        # Local Shopify CLI metadata (gitignored)
```

### Where to look for common changes

| Goal                        | Start here                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Homepage layout             | `templates/index.json`                                                                                |
| Header / navigation         | `sections/header.liquid`, `sections/header-group.json`, `snippets/header-*.liquid`                    |
| Footer                      | `sections/footer.liquid`, `sections/footer-group.json`                                                |
| About page                  | `templates/page.about.json`, `sections/about-brand.liquid`, `sections/about-values.liquid`            |
| Couture / book consultation | `templates/product.book-consultation.json`, `sections/appointment-couture.liquid`                     |
| Blog / Moments              | `templates/blog.json`, `templates/article.about-blog.json`, `sections/moments-home.liquid`            |
| Collection pages            | `templates/collection.json`, `sections/collection-grid.liquid`                                        |
| Product pages               | `templates/product.json`, `sections/main-product.liquid`                                              |
| FAQ                         | `templates/page.faq.json`, `sections/faq-accordion-grid.liquid`, `snippets/shared-faq-content.liquid` |
| Policy pages                | `templates/page.privacy-policy.json`, `templates/page.delivery-policy.json`, etc.                     |
| Global styles               | `assets/base.css`, `config/settings_schema.json`                                                      |
| Brand logos                 | `assets/brand/`                                                                                       |

### Custom sections (beyond Dawn defaults)

Notable SheyeOladejo-specific sections include:

- **Brand & content:** `about-brand`, `about-values`, `about-products`, `row-content-card-section`, `callout-banner`
- **Couture:** `appointment-couture`, `book-consult-images`, `book-consultation-image-cluster`, `book-consultation-video-gallery`
- **Editorial:** `moments-home`, `moments-grid`, `ejire-video-gallery`, `testimonials-carousel`
- **Layout:** `hero-secondary`, `hero-tertiary`, `page-breadcrumbs`, `faq-accordion-grid`
- **Collections:** `collections-ejire`, `collection-about-row`, `collection-three-column-grid`

Section groups (`header-group.json`, `footer-group.json`) define which sections appear globally and are often updated via the Shopify theme editor.

---

## Prerequisites

1. **Shopify CLI** — [Install Shopify CLI](https://shopify.dev/docs/api/shopify-cli)
2. **Store access** — Collaborator or staff access to the SheyeOladejo Shopify store
3. **Git** — For version control (remote: `https://github.com/sheyeoladejo/webite`)

Verify the CLI is installed:

```bash
shopify version
```

---

## Local development

From the repo root:

```bash
cd sheye
```

### 1. Authenticate and connect to the store

```bash
shopify theme dev --store czy1xj-na.myshopify.com
```

On first run, the CLI opens a browser to log in and link this folder to the store.

### 2. Start the development server

If the store is already linked:

```bash
shopify theme dev
```

This:

- Uploads theme changes to a temporary development theme
- Opens a preview URL with hot reload for Liquid, CSS, and JS edits
- Watches files and syncs updates as you save

Press `Ctrl+C` to stop the dev server.

### 3. Other useful commands

```bash
# Pull the latest theme from Shopify (overwrites local files)
shopify theme pull

# Push local changes to a theme on the store
shopify theme push

# Run Shopify theme lint checks
shopify theme check

# List themes on the connected store
shopify theme list
```

Use `shopify theme push --unpublished` to push to a draft theme without affecting the live storefront.

---

## Deployment

Production changes typically go through one of these flows:

1. **Theme editor (Shopify Admin)** — Merchants can adjust section content and settings in **Online Store → Themes → Customize**. Those edits may update JSON files like `config/settings_data.json` and template JSON files.
2. **CLI push** — Developers push code changes with `shopify theme push` and publish the theme in admin when ready.
3. **Git** — Push commits to GitHub; coordinate with whoever manages the live theme in Shopify.

The live storefront is served from the published theme on Shopify, not directly from this repo.

---

## Notes

- **`config/settings_data.json`** and many `templates/*.json` files are auto-generated or updated by the theme editor. Treat edits with care—they can be overwritten when settings are saved in admin.
- **`.shopify/`** is gitignored and holds local CLI state (for example metafield definitions). Each developer generates this locally when using the CLI.
- **Locales** in `locales/` support multiple languages; default English strings live in `en.default.json` and `en.default.schema.json`.

---

## Links

- **Website:** [https://sheyeoladejo.com](https://sheyeoladejo.com)
- **Instagram:** [@sheyeoladejo](https://instagram.com/sheyeoladejo)
- **Email:** info@sheyeoladejo.com
- **Shopify theme docs:** [Shopify Themes documentation](https://shopify.dev/docs/storefronts/themes)
- **Dawn base theme:** [Shopify/dawn on GitHub](https://github.com/Shopify/dawn)
