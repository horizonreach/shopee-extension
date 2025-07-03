# Shopee Product Auto Publisher - User Manual

## Quick Start Guide

### 1. Installation

#### Step 1: Download Extension Files
- Download all extension files to a folder on your computer
- Make sure you have all these files:
  - `manifest.json`
  - `popup.html`, `popup.css`, `popup.js`
  - `content.js`
  - `background.js`
  - `README.md`

#### Step 2: Install in Chrome
1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Turn ON "Developer mode" (toggle in top right)
4. Click "Load unpacked" button
5. Select the folder containing the extension files
6. The extension should now appear in your extensions list

#### Step 3: Verify Installation
- Look for the Shopee Auto Publisher icon in your Chrome toolbar
- If you don't see it, click the puzzle piece icon (🧩) and pin the extension

### 2. Getting Started

#### Step 1: Login to Shopee Seller Center
1. Go to [https://seller.shopee.ph/](https://seller.shopee.ph/)
2. Login with your seller account credentials
3. Make sure you have access to the seller dashboard

#### Step 2: Navigate to Draft Products
1. From the seller dashboard, go to:
   - **Products** → **Product List** → **Unpublished** → **Draft**
2. Or directly visit: `https://seller.shopee.ph/portal/product/list/unpublished/draft`
3. You should see your list of draft products

#### Step 3: Check Extension Status
1. Click the Shopee Auto Publisher icon in your toolbar
2. The popup should show:
   - Status: OFF
   - All counters at 0
   - "Ready" in the progress section

### 3. Using the Extension

#### Understanding the Interface

**Status Indicators:**
- 🔴 **OFF**: Extension is inactive
- 🔵 **ON**: Extension is running automation
- 🟢 **COMPLETED**: Processing finished successfully

**Statistics:**
- **Processed**: Total number of products examined
- **Published**: Number of products successfully published
- **Errors**: Number of failed publication attempts

**Progress Bar:**
- Shows current automation progress (0-100%)
- Text below shows current activity

**Activity Log:**
- Real-time log of all actions
- Color coded: Green (success), Red (error), Blue (info)
- Automatically scrolls to latest entries

#### Running the Automation

1. **Start the Process**
   - Make sure you're on the draft products page
   - Click the Shopee Auto Publisher icon
   - Toggle the "Auto Publish" switch to ON
   - The automation will start immediately

2. **Monitor Progress**
   - Watch the progress bar advance
   - Read activity logs for detailed information
   - Check statistics for current counts

3. **What Happens Automatically**
   - Scans ALL pages of draft products
   - Filters products with Content Quality Level 2 (Qualified)
   - Publishes each qualified product
   - Handles errors gracefully
   - Shows completion notification when done

4. **Stop if Needed**
   - Toggle the switch to OFF to stop automation
   - Processing will stop after current product

#### Expected Process Flow

```
1. Starting automation...
2. Fetching draft products...
3. Page 1: Found X products
4. Found Y qualified products on page 1
5. [Repeats for all pages]
6. Total qualified products found: Z
7. Processing: [Product Name]
8. Successfully published: [Product Name]
9. [Repeats for each product]
10. Automation completed. Published: X, Errors: Y
```

### 4. Understanding Results

#### Successful Publication
- Log shows: "Successfully published: [Product Name]" in green
- Published counter increases
- Product moves from Draft to Published status

#### Common Errors and Solutions

**HTTP 403 Errors:**
- **Cause**: Authentication/authorization issues
- **Solution**: 
  - Refresh the page and try again
  - Ensure you're logged in to Shopee
  - Check if your session expired

**HTTP 404 Errors:**
- **Cause**: Product not found or URL issues
- **Solution**: 
  - Product may have been moved/deleted
  - Refresh the page

**Network Errors:**
- **Cause**: Internet connectivity issues
- **Solution**: 
  - Check your internet connection
  - Try again after a few minutes

**No Qualified Products:**
- **Cause**: No products have Content Quality Level 2
- **What to do**: 
  - Check your products' content quality in Shopee
  - Improve product information to meet quality standards

### 5. Tips for Best Results

#### Before Starting
1. **Check Product Quality**
   - Ensure products have good descriptions
   - Add proper images
   - Complete all required fields
   - Wait for Content Quality assessment

2. **Verify Session**
   - Make sure you're logged in
   - Refresh the page before starting
   - Don't navigate away during automation

3. **Prepare for Automation**
   - Close unnecessary browser tabs
   - Ensure stable internet connection
   - Don't interrupt the process

#### During Automation
1. **Monitor Progress**
   - Keep the extension popup open to monitor
   - Watch for any error patterns
   - Note which products fail repeatedly

2. **Don't Interfere**
   - Don't refresh the page
   - Don't navigate away
   - Don't make manual changes to products

3. **Be Patient**
   - Large product lists take time
   - Each product has a 1-second delay (rate limiting)
   - 100 products ≈ 2-3 minutes

#### After Completion
1. **Review Results**
   - Check published vs error counts
   - Review failed products manually
   - Verify published products are visible

2. **Clear Data if Needed**
   - Use "Clear Logs" to clean activity log
   - Use "Reset Counters" to start fresh
   - Extension remembers settings between sessions

### 6. Troubleshooting

#### Extension Not Working
1. **Check Page URL**
   - Must be on: `seller.shopee.ph/portal/product/list/unpublished/draft`
   - Extension only works on this specific page

2. **Refresh and Retry**
   - Refresh the browser page
   - Reload the extension (chrome://extensions/)
   - Try logging out and back in to Shopee

3. **Check Browser Console**
   - Press F12 to open DevTools
   - Look at Console tab for error messages
   - Look for red error messages

#### High Error Rate
1. **Session Issues**
   - Log out and back in to Shopee
   - Clear browser cookies for Shopee
   - Try using an incognito window

2. **Product Issues**
   - Some products may have validation errors
   - Check failed products manually in Shopee
   - Ensure products meet publishing requirements

3. **Rate Limiting**
   - Extension already includes delays
   - If errors persist, try smaller batches
   - Contact Shopee support if issues continue

#### No Products Found
1. **Check Filters**
   - Ensure you're viewing ALL draft products
   - Remove any filters on the page
   - Check if products actually exist

2. **Content Quality**
   - Products need Content Quality Level 2
   - Check individual products for quality status
   - Improve product content to meet standards

### 7. Safety and Best Practices

#### Account Safety
- **Use Responsibly**: Don't abuse the automation
- **Monitor Results**: Always check what was published
- **Backup Important Data**: Keep records of your products
- **Follow Shopee ToS**: Ensure compliance with Shopee's terms

#### Technical Safety
- **One Browser Tab**: Only run on one tab at a time
- **Stable Connection**: Use reliable internet
- **Regular Breaks**: Don't run continuously for hours
- **Update Chrome**: Keep browser updated

#### Data Safety
- **No External Data**: Extension doesn't send data elsewhere
- **Local Processing**: All automation happens locally
- **Session-Based**: Uses your existing Shopee session
- **No Password Storage**: Doesn't store login credentials

### 8. Frequently Asked Questions

**Q: How many products can it process?**
A: Unlimited. It processes all pages of draft products automatically.

**Q: How long does it take?**
A: Approximately 1-2 seconds per product. 100 products ≈ 2-3 minutes.

**Q: Can I run it multiple times?**
A: Yes, but only run one instance at a time.

**Q: What if I have thousands of products?**
A: The extension handles large datasets. Monitor progress and take breaks if needed.

**Q: Does it work on mobile?**
A: No, this is a Chrome desktop extension only.

**Q: Can I customize which products to publish?**
A: Currently it publishes all Content Quality Level 2 products. Manual filtering isn't available.

**Q: What if my internet disconnects?**
A: The automation will stop. Restart it when connection is restored.

**Q: Is my data safe?**
A: Yes, the extension only uses your existing Shopee session and doesn't transmit data externally.

### 9. Support

If you encounter issues:

1. **Check This Manual**: Review troubleshooting section
2. **Browser Console**: Check for error messages (F12)
3. **Activity Log**: Review extension logs for clues
4. **Shopee Support**: Contact Shopee for account-specific issues

### 10. Updates and Maintenance

The extension may receive updates for:
- Bug fixes
- Shopee API changes
- New features
- Performance improvements

To update:
1. Download new version files
2. Remove old extension (chrome://extensions/)
3. Install new version using same process

---

**Remember**: This extension automates your existing Shopee publishing workflow. Ensure you understand what products will be published before starting the automation. 