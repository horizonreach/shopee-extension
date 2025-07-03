# Shopee Product Auto Publisher - Installation Guide

## Prerequisites
- Google Chrome browser
- Active Shopee Seller account (Philippines)
- Access to Shopee Seller Center

## Installation Steps

### 1. Download Files
Download all extension files to a folder on your computer:
- `manifest.json`
- `popup.html`, `popup.css`, `popup.js`
- `content.js`
- `background.js`
- Icon files (optional - can use create_icons.html to generate)

### 2. Create Icons (Optional)
If you don't have icon files:
1. Open `create_icons.html` in Chrome
2. Right-click each canvas and save as PNG
3. Save files as: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
4. Place them in the `icons/` folder

### 3. Install Extension
1. Open Chrome
2. Go to `chrome://extensions/`
3. Turn ON "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select your extension folder
6. Extension appears in extensions list

### 4. Pin Extension
1. Click puzzle piece icon (🧩) in Chrome toolbar
2. Find "Shopee Product Auto Publisher"
3. Click pin icon to add to toolbar

## Quick Test

1. Go to [Shopee Seller Center](https://seller.shopee.ph/)
2. Navigate to: Products → Product List → Unpublished → Draft
3. Click the extension icon
4. You should see the popup with toggle switch

## Usage

1. **On Draft Products Page**: Extension only works on the draft products page
2. **Toggle ON**: Click the switch to start automation
3. **Monitor Progress**: Watch logs and progress bar
4. **Toggle OFF**: Stop automation anytime

## Troubleshooting

**Extension not loading:**
- Check all files are in the folder
- Reload extension at chrome://extensions/
- Check Chrome console for errors

**Extension not working:**
- Ensure you're on: `seller.shopee.ph/portal/product/list/unpublished/draft`
- Refresh the page
- Check if you're logged in to Shopee

**High error rate:**
- Refresh page and try again
- Check your session hasn't expired
- Ensure products have Content Quality Level 2

## Files Structure
```
extension-folder/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── content.js
├── background.js
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
├── USER_MANUAL.md
└── create_icons.html
```

## Support

- Read `USER_MANUAL.md` for detailed usage instructions
- Check browser console (F12) for technical errors
- Ensure compliance with Shopee's Terms of Service

---

**Important**: This extension automates your Shopee publishing workflow. Always verify results and use responsibly. 