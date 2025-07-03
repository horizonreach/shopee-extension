# Shopee Product Auto Publisher

A Chrome extension for automatically publishing qualified draft products on Shopee Seller Center using API requests.

## Features

- ✅ Automatically scans all draft products across multiple pages
- ✅ Filters products with Content Quality Level 2 (Qualified)
- ✅ Publishes qualified products using Shopee's API
- ✅ Real-time progress tracking and logging
- ✅ Modern, intuitive UI with toggle switch
- ✅ Comprehensive error handling and retry logic
- ✅ Statistics tracking (processed, published, errors)
- ✅ Visual completion notification

## Requirements

- Google Chrome browser
- Active Shopee Seller account
- Access to Shopee Seller Center (Philippines)

## Installation

### Method 1: Developer Mode (Recommended)

1. **Download the Extension Files**
   - Download all files from this repository
   - Extract to a folder on your computer

2. **Enable Developer Mode in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Verify Installation**
   - Look for the Shopee Auto Publisher icon in your Chrome toolbar
   - The extension is ready to use!

### Method 2: Chrome Web Store (Future)
*This extension may be published to the Chrome Web Store in the future.*

## Usage

### Getting Started

1. **Navigate to Draft Products Page**
   - Go to [Shopee Seller Center](https://seller.shopee.ph/)
   - Navigate to: `Products` > `Product List` > `Unpublished` > `Draft`
   - Or directly visit: `https://seller.shopee.ph/portal/product/list/unpublished/draft`

2. **Open Extension Popup**
   - Click the Shopee Auto Publisher icon in your toolbar
   - The popup will show current status and controls

3. **Start Automation**
   - Toggle the "Auto Publish" switch to ON
   - The extension will automatically:
     - Scan all draft products across all pages
     - Filter products with Content Quality Level 2
     - Publish each qualified product
     - Show real-time progress and logs

4. **Monitor Progress**
   - Watch the progress bar and activity log
   - View statistics for processed, published, and error counts
   - The extension will show a completion notification when done

### Understanding the Interface

#### Status Indicators
- **OFF**: Extension is inactive
- **ON**: Extension is running
- **COMPLETED**: Processing finished

#### Statistics
- **Processed**: Total products examined
- **Published**: Successfully published products  
- **Errors**: Failed publication attempts

#### Activity Log
- Real-time logging of all actions
- Color-coded messages (success, error, info)
- Automatically scrolls to latest entries

#### Controls
- **Clear Logs**: Remove all log entries
- **Reset Counters**: Reset statistics to zero

## How It Works

### Automation Flow

1. **Product Discovery**
   - Calls `get_draft_product_list` API for each page
   - Retrieves all draft products with pagination

2. **Quality Assessment**
   - Calls `get_content_quality_info` API for product batches
   - Filters products with `quality_level: 2` (Qualified)

3. **Product Publishing**
   - For each qualified product:
     - Calls `get_product_info` API to get detailed information
     - Calls `create_product_info_for_draft` API to publish
     - Handles success/error responses

4. **Progress Tracking**
   - Updates UI with current status
   - Logs all activities with timestamps
   - Maintains statistics throughout process

### API Endpoints Used

- `GET /api/v3/mpsku/list/v2/get_draft_product_list` - Get draft products
- `GET /api/v3/mpsku/list/v2/get_content_quality_info` - Get quality information
- `GET /api/v3/product/get_product_info` - Get detailed product info
- `POST /api/v3/product/create_product_info_for_draft` - Publish product

## Technical Details

### Architecture
- **Manifest V3**: Latest Chrome extension standard
- **Content Script**: Runs on Shopee pages, handles automation
- **Background Service Worker**: Manages extension lifecycle
- **Popup Interface**: User control and monitoring

### Security
- Only works on Shopee Seller Center domain
- Uses existing browser session and cookies
- No external data transmission
- All processing happens locally

### Performance
- Rate limiting between API calls (1-second delay)
- Batch processing for efficiency
- Progress tracking for large datasets
- Graceful error handling and recovery

## Troubleshooting

### Common Issues

**Extension not working:**
- Ensure you're on the correct Shopee page
- Check that you're logged into Shopee Seller Center
- Refresh the page and try again

**No products found:**
- Verify you have draft products in your account
- Check that products have Content Quality assessments
- Ensure products are eligible for publishing

**API errors:**
- Session may have expired - refresh and re-login
- Network connectivity issues
- Shopee server temporary issues

**Permission errors:**
- Ensure extension has proper permissions
- Check Chrome's site permissions for Shopee

### Getting Help

1. Check the Activity Log in the extension popup
2. Open Chrome DevTools (F12) and check Console for errors
3. Verify your Shopee account has proper permissions
4. Try refreshing the page and restarting the extension

## Development

### File Structure
```
shopee-extension/
├── manifest.json           # Extension configuration
├── popup.html             # Popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup logic
├── content.js             # Main automation logic
├── background.js          # Background service worker
├── icons/                 # Extension icons
└── README.md              # This file
```

### Local Development
1. Make changes to source files
2. Go to `chrome://extensions/`
3. Click "Reload" button for the extension
4. Test changes on Shopee Seller Center

## Version History

### v1.0.0 (Current)
- Initial release
- Basic automation functionality
- Modern UI with progress tracking
- Comprehensive error handling
- Real-time logging and statistics

## License

This project is provided as-is for educational and automation purposes. Use responsibly and in accordance with Shopee's Terms of Service.

## Disclaimer

This extension automates interactions with Shopee Seller Center. Users are responsible for:
- Ensuring compliance with Shopee's Terms of Service
- Verifying product information before publishing
- Monitoring automation results
- Using the tool responsibly

The developers are not responsible for any issues arising from the use of this extension. 