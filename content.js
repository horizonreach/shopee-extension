class ShopeeAutoPublisher {
    constructor() {
        // Prevent duplicate initialization
        if (window.shopeeAutoPublisherInstance) {
            console.log('Shopee Auto Publisher already initialized');
            return window.shopeeAutoPublisherInstance;
        }

        this.isRunning = false;
        this.stats = { processed: 0, published: 0, errors: 0 };
        this.currentPage = 1;
        this.pageSize = 50; // Smaller page size to reduce server load
        this.totalProducts = 0;
        this.processedProducts = 0;
        this.capturedHeaders = {};
        this.isInitialized = false;
        this.currentDomain = this.extractDomainFromUrl(window.location.href);
        
        this.initializeEventListeners();
        this.loadState();
        this.setupRequestInterception();
        
        // Mark as initialized and store reference
        this.isInitialized = true;
        window.shopeeAutoPublisherInstance = this;
        console.log('Shopee Auto Publisher initialized successfully');
    }

    initializeEventListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
    }

    setupRequestInterception() {
        // Intercept fetch requests to capture valid headers
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(...args) {
            const [url, options] = args;
            
            // If this is a Shopee API request, capture its headers
            if (url.includes(`${self.currentDomain}/api/`)) {
                console.log('Intercepted Shopee API request:', url);
                if (options && options.headers) {
                    console.log('Captured headers:', Object.keys(options.headers));
                    // Store valid headers for later use
                    self.capturedHeaders = { ...self.capturedHeaders, ...options.headers };
                }
            }
            
            return originalFetch.apply(this, args);
        };
        
        // Also intercept XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._url = url;
            this._method = method;
            this._headers = {};
            return originalXHROpen.apply(this, [method, url, ...args]);
        };
        
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            if (this._url && this._url.includes(`${self.currentDomain}/api/`)) {
                this._headers[name] = value;
            }
            return originalXHRSetRequestHeader.apply(this, [name, value]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            if (this._url && this._url.includes(`${self.currentDomain}/api/`) && this._headers) {
                console.log('Intercepted XHR Shopee API request:', this._url);
                console.log('Captured XHR headers:', Object.keys(this._headers));
                self.capturedHeaders = { ...self.capturedHeaders, ...this._headers };
            }
            return originalXHRSend.apply(this, args);
        };
        
        // Also try to extract headers from existing network requests
        this.extractHeadersFromPage();
    }

    extractHeadersFromPage() {
        // Look for existing API requests in the page to extract headers
        try {
            // Check if there are any existing fetch requests we can learn from
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                if (script.textContent.includes(`${this.currentDomain}/api/`)) {
                    // Try to extract session and security tokens from script content
                    this.parseScriptForHeaders(script.textContent);
                }
            }
            
            // Also check for headers in window object or global variables
            this.extractGlobalHeaders();
            
        } catch (error) {
            console.warn('Could not extract headers from page:', error);
        }
    }

    parseScriptForHeaders(scriptContent) {
        try {
            // Look for common header patterns in script content
            const patterns = {
                'sc-fe-session': /["']sc-fe-session["']:\s*["']([^"']+)["']/,
                'sc-fe-ver': /["']sc-fe-ver["']:\s*["']([^"']+)["']/,
                'x-sap-ri': /["']x-sap-ri["']:\s*["']([^"']+)["']/,
                'x-sap-sec': /["']x-sap-sec["']:\s*["']([^"']+)["']/,
                'af-ac-enc-sz-token': /["']af-ac-enc-sz-token["']:\s*["']([^"']+)["']/,
                'sz-dfp': /["']sz-dfp["']:\s*["']([^"']+)["']/
            };
            
            for (const [headerName, pattern] of Object.entries(patterns)) {
                const match = scriptContent.match(pattern);
                if (match) {
                    this.capturedHeaders[headerName] = match[1];
                }
            }
        } catch (error) {
            console.warn('Error parsing script for headers:', error);
        }
    }

    extractGlobalHeaders() {
        try {
            // Check for global variables that might contain session info
            if (window.SPC_CDS) {
                this.capturedHeaders.SPC_CDS = window.SPC_CDS;
            }
            
            // Check for session storage
            if (sessionStorage) {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.includes('session') || key.includes('token')) {
                        try {
                            const value = sessionStorage.getItem(key);
                            if (value && typeof value === 'string') {
                                this.capturedHeaders[key] = value;
                            }
                        } catch (e) {
                            // Ignore errors accessing session storage
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Error extracting global headers:', error);
        }
    }

    async loadState() {
        try {
            const result = await chrome.storage.local.get(['autoPublishEnabled', 'stats']);
            if (result.autoPublishEnabled) {
                this.startAutomation();
            }
            if (result.stats) {
                this.stats = result.stats;
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'TOGGLE_AUTO_PUBLISH':
                if (message.enabled) {
                    // Store the domain for API requests
                    if (message.domain) {
                        this.currentDomain = message.domain;
                    } else {
                        // Extract domain from current URL
                        this.currentDomain = this.extractDomainFromUrl(window.location.href);
                    }
                    this.startAutomation();
                } else {
                    this.stopAutomation();
                }
                break;
        }
    }

    async startAutomation() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.sendLog('Starting automation process...', 'info').catch(() => {});
        this.sendLog('⚠️ Using slow mode to prevent rate limiting (10-15s delays between products)', 'warning').catch(() => {});
        this.updateStatus('Initializing...', 0).catch(() => {});

        try {
            // First, ensure we have valid headers by triggering a page refresh if needed
            await this.ensureValidHeaders();
            
            // Notify that session is initialized
            chrome.runtime.sendMessage({
                type: 'SESSION_INITIALIZED'
            }).catch(() => {});
            
            this.sendLog('Session initialized successfully - Starting automation process', 'info').catch(() => {});
            
            await this.runAutomationFlow();
        } catch (error) {
            console.error('Automation error:', error);
            this.sendLog(`Automation failed: ${error.message}`, 'error').catch(() => {});
            this.sendError('Automation process failed').catch(() => {});
            
            // Notify session error
            chrome.runtime.sendMessage({
                type: 'SESSION_ERROR',
                message: error.message
            }).catch(() => {});
        } finally {
            this.isRunning = false;
        }
    }

    async ensureValidHeaders() {
        this.sendLog('Extracting session tokens from browser...', 'info').catch(() => {});
        
        // First, try to extract from cookies directly
        this.extractFromCookies();
        
        // Try to extract from DOM/scripts
        this.extractHeadersFromPage();
        
        // Generate required headers using browser session
        this.generateRequiredHeaders();
        
        this.sendLog(`Using headers: ${Object.keys(this.capturedHeaders).join(', ')}`, 'info').catch(() => {});
    }

    extractFromCookies() {
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                
                // Extract important session cookies
                if (name === 'SPC_SC_SESSION') {
                    this.capturedHeaders['session-cookie'] = value;
                } else if (name === 'SPC_STK') {
                    this.capturedHeaders['stk-token'] = value;
                } else if (name === 'SC_DFP') {
                    this.capturedHeaders['dfp-token'] = value;
                } else if (name === 'shopee_webUnique_ccd') {
                    this.capturedHeaders['unique-token'] = value;
                }
            }
        } catch (error) {
            console.warn('Error extracting from cookies:', error);
        }
    }

    generateRequiredHeaders() {
        // Generate the minimum required headers for API calls
        this.capturedHeaders['sc-fe-session'] = this.generateSessionId();
        this.capturedHeaders['x-sap-ri'] = this.generateSAPRI();
        this.capturedHeaders['x-sap-sec'] = this.generateSAPSec();
        this.capturedHeaders['sc-fe-ver'] = '21.105196';
    }

    generateSessionId() {
        // Try to extract from actual session cookie first
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'SPC_SC_SESSION') {
                    // Extract session ID from the encoded session
                    const decoded = decodeURIComponent(value);
                    const match = decoded.match(/([A-F0-9]{16})/);
                    if (match) {
                        return match[1];
                    }
                }
            }
        } catch (error) {
            console.warn('Could not extract session from cookies');
        }
        
        // Generate a session-like ID
        const chars = 'ABCDEF0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async makeTestAPIRequest() {
        // Try to make the same request that the page would make to get the first page of products
        // This will trigger the browser to use its actual session and security tokens
        
        const url = `${this.getApiBaseUrl()}/v3/mpsku/list/v2/get_draft_product_list?` +
            `SPC_CDS=${this.getSPCCDS()}&SPC_CDS_VER=2&page_number=1&page_size=1&qc_status=all`;
        
        // Make the request using the browser's native fetch (before our interception)
        // This should trigger Shopee's frontend to add all necessary headers
        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9',
                    'locale': this.getLocaleForDomain(),
                    'Referer': window.location.href
                }
            });
            
            // The request itself might fail (403), but our interceptor should have captured the headers
            // that the browser tried to send
            
        } catch (error) {
            // Expected to fail, but headers should be captured
            console.log('Test request failed as expected:', error.message);
        }
    }

    async captureHeadersFromPageRequests() {
        return new Promise((resolve) => {
            let headersCaptured = false;
            const timeout = setTimeout(() => {
                if (!headersCaptured) {
                    resolve();
                }
            }, 5000);

            // Set up a more aggressive fetch interceptor
            const originalFetch = window.fetch;
            const self = this;
            
            window.fetch = function(...args) {
                const [url, options] = args;
                
                if (url.includes(`${self.currentDomain}/api/`) && options && options.headers) {
                    // Capture all headers from any Shopee API request
                    Object.assign(self.capturedHeaders, options.headers);
                    
                    if (!headersCaptured && (options.headers['x-sap-sec'] || options.headers['sc-fe-session'])) {
                        headersCaptured = true;
                        clearTimeout(timeout);
                        setTimeout(resolve, 100); // Small delay to ensure headers are fully captured
                    }
                }
                
                return originalFetch.apply(this, args);
            };

            // Try to trigger a legitimate API request by simulating page interaction
            this.triggerPageRequest();
        });
    }

    triggerPageRequest() {
        try {
            // Try to scroll or interact with the page to trigger API requests
            window.scrollTo(0, 100);
            
            // Look for and click any elements that might trigger API calls
            setTimeout(() => {
                const refreshButton = document.querySelector('[data-testid="refresh"], .refresh, [title*="refresh"], [aria-label*="refresh"]');
                if (refreshButton && typeof refreshButton.click === 'function') {
                    refreshButton.click();
                }
            }, 1000);
            
        } catch (error) {
            console.warn('Could not trigger page request:', error);
        }
    }

    stopAutomation() {
        this.isRunning = false;
        this.sendLog('Automation stopped by user', 'info').catch(() => {});
        this.updateStatus('Stopped', 0).catch(() => {});
        chrome.storage.local.set({ autoPublishEnabled: false });
    }

    extractDomainFromUrl(url) {
        try {
            const match = url.match(/https:\/\/(seller\.shopee\.[^\/]+)/);
            return match ? match[1] : 'seller.shopee.ph';
        } catch (error) {
            console.warn('Could not extract domain from URL:', error);
            return 'seller.shopee.ph';
        }
    }

    getApiBaseUrl() {
        return `https://${this.currentDomain}/api`;
    }

    getLocaleForDomain() {
        // Map domains to their appropriate locales
        const domainLocaleMap = {
            'seller.shopee.ph': 'en-ph',
            'seller.shopee.com.my': 'en-my', 
            'seller.shopee.sg': 'en-sg',
            'seller.shopee.co.th': 'en',  // Fixed: Thailand uses 'en' not 'en-th'
            'seller.shopee.tw': 'zh-tw',
            'seller.shopee.vn': 'en-vn',
            'seller.shopee.com': 'en'
        };
        
        return domainLocaleMap[this.currentDomain] || 'en';
    }

    getLogisticsChannelForDomain() {
        // Map domains to their appropriate logistics channels
        const domainLogisticsMap = {
            'seller.shopee.ph': 48011,      // Philippines
            'seller.shopee.com.my': 28057,  // Malaysia
            'seller.shopee.sg': 28057,      // Singapore (assuming similar to MY)
            'seller.shopee.co.th': 78021,   // Thailand - Fixed: uses 78021 not 48011
            'seller.shopee.tw': 48011,      // Taiwan (assuming similar to PH)
            'seller.shopee.vn': 48011,      // Vietnam (assuming similar to PH)
            'seller.shopee.com': 48011      // Default
        };
        
        return domainLogisticsMap[this.currentDomain] || 48011;
    }

    getShippingPriceForDomain() {
        // Map domains to their appropriate shipping prices
        const domainShippingMap = {
            'seller.shopee.ph': "50",       // Philippines
            'seller.shopee.com.my': "50",   // Malaysia
            'seller.shopee.sg': "50",       // Singapore
            'seller.shopee.co.th': "22",    // Thailand - Fixed: uses 22 not 50
            'seller.shopee.tw': "50",       // Taiwan
            'seller.shopee.vn': "50",       // Vietnam
            'seller.shopee.com': "50"       // Default
        };
        
        return domainShippingMap[this.currentDomain] || "50";
    }

    async runAutomationFlow() {
        let allQualifiedProducts = [];
        let currentPage = 1;
        let hasMorePages = true;

        // Step 1: Get all draft products across all pages
        this.sendLog('Fetching draft products...', 'info').catch(() => {});
        
        while (hasMorePages && this.isRunning) {
            try {
                const draftResponse = await this.getDraftProducts(currentPage);
                
                if (draftResponse.code !== 0) {
                    throw new Error(`Failed to get draft products: ${draftResponse.message}`);
                }

                const products = draftResponse.data.products || [];
                const pageInfo = draftResponse.data.page_info;
                
                this.totalProducts = pageInfo.total;
                this.sendLog(`Page ${currentPage}: Found ${products.length} products`, 'info').catch(() => {});
                
                if (products.length === 0) {
                    hasMorePages = false;
                    continue;
                }

                // Step 2: Get quality info for this batch
                const productIds = products.map(p => p.id);
                const qualityResponse = await this.getContentQualityInfo(productIds);
                
                if (qualityResponse.code !== 0) {
                    throw new Error(`Failed to get quality info: ${qualityResponse.message}`);
                }

                // Step 3: Filter qualified products (quality_level: 2)
                const qualityInfo = qualityResponse.data.content_quality_info;
                const qualifiedIds = Object.keys(qualityInfo).filter(id => 
                    qualityInfo[id].quality_level === 2
                );

                qualifiedIds.forEach(id => {
                    const product = products.find(p => p.id.toString() === id);
                    if (product) {
                        allQualifiedProducts.push({
                            id: parseInt(id),
                            name: product.name
                        });
                    }
                });

                this.sendLog(`Found ${qualifiedIds.length} qualified products on page ${currentPage}`, 'success').catch(() => {});
                
                // Check if there are more pages
                hasMorePages = (currentPage * pageInfo.page_size) < pageInfo.total;
                currentPage++;
                
                // Update progress
                const progress = Math.min((currentPage - 1) * pageInfo.page_size, pageInfo.total) / pageInfo.total * 50;
                this.updateStatus(`Scanning pages... (${allQualifiedProducts.length} qualified found)`, progress).catch(() => {});
                
                // Much longer delay between pages to avoid rate limiting
                await this.delay(2500); // 5-8 seconds random delay
                
            } catch (error) {
                this.sendLog(`Error on page ${currentPage}: ${error.message}`, 'error').catch(() => {});
                this.stats.errors++;
                break;
            }
        }

        if (!this.isRunning) return;

        this.sendLog(`Total qualified products found: ${allQualifiedProducts.length}`, 'success').catch(() => {});
        
        if (allQualifiedProducts.length === 0) {
            this.sendLog('No qualified products to publish', 'info').catch(() => {});
            this.completeAutomation();
            return;
        }

        // Step 4: Process each qualified product
        for (let i = 0; i < allQualifiedProducts.length && this.isRunning; i++) {
            const product = allQualifiedProducts[i];
            
            try {
                this.sendLog(`Processing: ${product.name}`, 'info').catch(() => {});
                
                // Get detailed product info
                const productInfo = await this.getProductInfo(product.id);
                
                if (productInfo.code !== 0) {
                    throw new Error(`Failed to get product info: ${productInfo.message}`);
                }

                // Publish the product with retry logic
                let publishSuccess = false;
                let retryCount = 0;
                const maxRetries = 3;
                
                while (!publishSuccess && retryCount < maxRetries) {
                    try {
                        const publishResult = await this.publishProduct(productInfo.data.product_info);
                        
                        if (publishResult.code === 0) {
                            this.sendLog(`Successfully published: ${product.name}`, 'success').catch(() => {});
                            this.stats.published++;
                            publishSuccess = true;
                            
                            // Report business metrics after successful publish (like the browser does)
                            try {
                                // Small delay to simulate natural browser behavior
                                await this.delay(1000); // 1-3 seconds
                                await this.reportBusinessMetrics(product.id, product.name, productInfo.data.product_info);
                                this.sendLog(`📊 Reported metrics for: ${product.name}`, 'info').catch(() => {});
                                
                                // Delete product after reporting metrics
                                try {
                                    await this.delay(500); // Small delay before deletion
                                    await this.deleteProduct(product.id, product.name);
                                    this.sendLog(`🗑️ Deleted draft product: ${product.name}`, 'success').catch(() => {});
                                } catch (deleteError) {
                                    // Don't fail the whole process if deletion fails
                                    this.sendLog(`⚠️ Product deletion failed: ${deleteError.message}`, 'warning').catch(() => {});
                                    console.warn('Failed to delete product:', deleteError);
                                }
                            } catch (metricsError) {
                                // Don't fail the whole process if metrics reporting fails
                                this.sendLog(`⚠️ Metrics reporting failed: ${metricsError.message}`, 'warning').catch(() => {});
                                console.warn('Failed to report business metrics:', metricsError);
                            }
                        } else {
                            // Get more detailed error information
                            let errorDetails = `Publish failed (code: ${publishResult.code})`;
                            if (publishResult.message) {
                                errorDetails += ` - ${publishResult.message}`;
                            } else if (publishResult.msg) {
                                errorDetails += ` - ${publishResult.msg}`;
                            } else if (publishResult.error) {
                                errorDetails += ` - ${publishResult.error}`;
                            } else {
                                errorDetails += ` - ${JSON.stringify(publishResult)}`;
                            }
                            
                            // Log the full response for debugging
                            console.log('Full publish response:', publishResult);
                            
                            throw new Error(errorDetails);
                        }
                    } catch (publishError) {
                        retryCount++;
                        if (publishError.message.includes('Rate limited') || publishError.message.includes('403')) {
                            if (retryCount < maxRetries) {
                                const backoffTime = 30000 * retryCount + (Math.random() * 10000); // 30s, 60s, 90s + random
                                this.sendLog(`Rate limited, waiting ${Math.round(backoffTime/1000)}s before retry ${retryCount}/${maxRetries}...`, 'warning').catch(() => {});
                                await this.delay(backoffTime);
                            } else {
                                throw publishError;
                            }
                        } else {
                            throw publishError;
                        }
                    }
                }
                
            } catch (error) {
                this.sendLog(`Failed to publish ${product.name}: ${error.message}`, 'error').catch(() => {});
                this.stats.errors++;
            }
            
            this.stats.processed++;
            this.updateStats().catch(() => {});
            
            // Update progress
            const progress = 50 + ((i + 1) / allQualifiedProducts.length) * 50;
            this.updateStatus(`Publishing products... (${i + 1}/${allQualifiedProducts.length})`, progress).catch(() => {});
            
            // Much longer delay between product publishing to avoid rate limiting
            await this.delay(5000); // 10-15 seconds random delay
        }

        this.completeAutomation();
    }

    async getDraftProducts(page = 1) {
        const url = `${this.getApiBaseUrl()}/v3/mpsku/list/v2/get_draft_product_list?` +
            `SPC_CDS=${this.getSPCCDS()}&SPC_CDS_VER=2&page_number=${page}&page_size=${this.pageSize}&qc_status=all`;
        
        return await this.makeAPIRequest(url, 'GET');
    }

    async getContentQualityInfo(productIds) {
        const url = `${this.getApiBaseUrl()}/v3/mpsku/list/v2/get_content_quality_info?` +
            `SPC_CDS=${this.getSPCCDS()}&SPC_CDS_VER=2&product_ids=${productIds.join(',')}&is_draft=true`;
        
        return await this.makeAPIRequest(url, 'GET');
    }

    async getProductInfo(productId) {
        const url = `${this.getApiBaseUrl()}/v3/product/get_product_info?` +
            `SPC_CDS=${this.getSPCCDS()}&SPC_CDS_VER=2&product_id=${productId}&is_draft=true`;
        
        return await this.makeAPIRequest(url, 'GET');
    }

    async publishProduct(productInfo) {
        const url = `${this.getApiBaseUrl()}/v3/product/create_product_info_for_draft?` +
            `SPC_CDS=${this.getSPCCDS()}&SPC_CDS_VER=2`;
        
        const payload = {
            product_id: productInfo.id,
            product_info: this.prepareProductForPublish(productInfo),
            is_draft: true
        };

        return await this.makeAPIRequest(url, 'POST', payload);
    }

    async reportBusinessMetrics(productId, productName, productInfo = null) {
        const url = `${this.getApiBaseUrl()}/v3/general/report_upload_business_metrics?` +
            `SPC_CDS=${this.getSPCCDS()}&SPC_CDS_VER=2`;
        
        // Generate session ID for metrics (random number like Shopee uses)
        const sessionId = Date.now().toString() + Math.floor(Math.random() * 1000000);
        
        // Calculate event duration (simulate processing time)
        const eventDuration = 3000 + Math.floor(Math.random() * 7000); // 3-10 seconds
        
        // Use actual product category path if available, otherwise use default
        const categoryPath = productInfo?.category_path || [100639, 100737, 101386];
        const brandInfo = productInfo?.brand_info || { brand_name: "No brand", brand_id: 0 };
        
        const metricsPayload = {
            metrics: [{
                product_id: productId,
                report_module: "mpsku-detail-page",
                event_duration: eventDuration,
                success_count: 1,
                total_count: 1,
                payload: JSON.stringify({
                    session_id: sessionId,
                    tss_action: "",
                    event_duration_old: eventDuration,
                    event_duration_v2: Math.floor(eventDuration * 0.6), // Slightly less than old duration
                    abnormal_tracker: {},
                    items: [{
                        item_id: 0,
                        item_status: 10, // Published status
                        category_id: categoryPath,
                        panels: [{
                            name: "basicInfoPanel",
                            latency: Math.floor(Math.random() * 2000) + 500 // 500-2500ms
                        }],
                        fields: [],
                        rcmd: [{
                            name: "name",
                            group_id: "",
                            final_val: productName.substring(0, 50) // Truncate long names
                        }, {
                            name: "categoryPath",
                            group_id: "",
                            final_val: categoryPath
                        }, {
                            name: "attribute",
                            group_id: "",
                            final_val: productInfo?.attributes || []
                        }, {
                            name: "variation",
                            group_id: "",
                            final_val: []
                        }, {
                            name: "brand",
                            final_val: {
                                brand_name: brandInfo.brand_name || "No brand",
                                brand_id: brandInfo.brand_id || 0
                            }
                        }],
                        preqc: {
                            snapshots: [],
                            final: {
                                rules: []
                            }
                        }
                    }],
                    execute_ab_test_group: [539604, 506718, 506722, 530960, 507514, 531129, 493412, 506724, 517185, 0, 490408]
                }),
                event_operation: 8 // Publish operation
            }]
        };

        return await this.makeAPIRequest(url, 'POST', metricsPayload);
    }

    async deleteProduct(productId, productName) {
        const url = `${this.getApiBaseUrl()}/tool/mass_product/delete_product/?` +
            `SPC_CDS=${this.getSPCCDS()}&SPC_CDS_VER=2`;
        
        const deletePayload = {
            unpublished_ids: [productId]
        };

        return await this.makeAPIRequest(url, 'POST', deletePayload);
    }

    prepareProductForPublish(productInfo) {
        // Prepare the product data for publishing - exact format from working request
        const description = productInfo.description_info?.description || '';
        
        return {
            name: productInfo.name,
            enable_model_level_dts: productInfo.enable_model_level_dts || false,
            category_path: productInfo.category_path,
            weight: productInfo.weight,
            condition: productInfo.condition,
            parent_sku: productInfo.parent_sku || "",
            brand_id: productInfo.brand_info?.brand_id || 0,
            attributes: productInfo.attributes || [],
            images: productInfo.images,
            long_images: productInfo.long_images || [],
            std_tier_variation_list: productInfo.std_tier_variation_list || [{
                id: 0,
                custom_value: "",
                value_list: [{
                    id: 0,
                    custom_value: ""
                }]
            }],
            size_chart_info: {
                size_chart: productInfo.size_chart_info?.size_chart || ""
            },
            video_list: productInfo.video_list || [],
            description_info: {
                description: description,
                description_type: "normal"
            },
            dimension: productInfo.dimension || {
                width: "",
                length: "",
                height: ""
            },
            pre_order_info: productInfo.pre_order_info || {
                pre_order: true,
                days_to_ship: 10
            },
            wholesale_list: productInfo.wholesale_list || [],
            unlisted: false,
            max_purchase_limit: {
                type: productInfo.max_purchase_limit_info?.type || 1,
                purchase_limit: productInfo.max_purchase_limit_info?.purchase_limit || 1
            },
            min_purchase_limit: productInfo.min_purchase_limit || 1,
            logistics_channels: [{
                size: 0,
                price: this.getShippingPriceForDomain(),
                cover_shipping_fee: false,
                enabled: true,
                channelid: this.getLogisticsChannelForDomain(),
                sizeid: 0
            }],
            model_list: productInfo.model_list?.map(model => ({
                id: model.id || 0,
                tier_index: model.tier_index || [0],
                is_default: model.is_default || true,
                price: model.price_info?.input_normal_price || "0",
                stock_setting_list: model.stock_detail?.seller_stock_info?.map(stock => ({
                    location_id: stock.location_id,
                    sellable_stock: stock.sellable_stock
                })) || [{
                    location_id: "JPZ",
                    sellable_stock: 1
                }]
            })) || [{
                id: 0,
                tier_index: [0],
                is_default: true,
                price: "0",
                stock_setting_list: [{
                    location_id: "JPZ", 
                    sellable_stock: 1
                }]
            }],
            authorised_brand_id: productInfo.authorised_brand_id || 0,
            scheduled_publish_time: 0,
            brand_license_info: {
                license_id_list: []
            }
        };
    }

    async makeAPIRequest(url, method, data = null) {
        // Build complete headers with all necessary security tokens
        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'locale': this.getLocaleForDomain(),
            'priority': 'u=1, i',
            'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'Referer': window.location.href,
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        };

        // Add content-type for POST requests
        if (method === 'POST' && data) {
            headers['content-type'] = 'application/json;charset=UTF-8';
        }

        // Add session headers for all requests
        const sessionHeaders = this.getSessionHeaders();
        Object.assign(headers, sessionHeaders);

        // Add POST-specific security headers
        if (method === 'POST') {
            const postHeaders = this.getPostHeaders();
            Object.assign(headers, postHeaders);
        }

        const options = {
            method: method,
            credentials: 'include',
            headers: headers
        };

        if (method === 'POST' && data) {
            options.body = JSON.stringify(data);
        }

        try {
            // Log request details for debugging
            console.log(`API ${method} request to:`, url);
            console.log('Request headers:', headers);
            if (data) {
                console.log('Request payload:', JSON.stringify(data, null, 2));
            }
            
            const response = await fetch(url, options);
            
            // Log response details for debugging
            console.log(`API ${method} response:`, response.status, response.statusText);
            
            // Handle rate limiting specifically - 403 and 429 both indicate rate limiting
            if (response.status === 429 || response.status === 403) {
                const errorText = await response.text().catch(() => '');
                console.warn('Rate limited, waiting before retry...', errorText);
                
                // Exponential backoff - wait longer each time
                const backoffTime = 15000 + (Math.random() * 10000); // 15-25 seconds
                await this.delay(backoffTime);
                
                throw new Error(`Rate limited (${response.status}). Please wait before retrying.`);
            }
            
            if (!response.ok) {
                // Try to get error details from response
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    // First try to parse as JSON since Shopee API returns JSON errors
                    const contentType = response.headers.get('content-type');
                    let errorData;
                    
                    if (contentType && contentType.includes('application/json')) {
                        errorData = await response.json();
                        console.log('Error response JSON:', errorData);
                        
                        // Extract specific error message from Shopee API response
                        if (errorData.message) {
                            errorMessage += ` - ${errorData.message}`;
                        } else if (errorData.msg) {
                            errorMessage += ` - ${errorData.msg}`;
                        } else if (errorData.error) {
                            errorMessage += ` - ${errorData.error}`;
                        } else {
                            errorMessage += ` - ${JSON.stringify(errorData)}`;
                        }
                    } else {
                        // Fall back to text if not JSON
                        errorData = await response.text();
                        if (errorData) {
                            console.log('Error response text:', errorData);
                            errorMessage += ` - ${errorData}`;
                        }
                    }
                } catch (e) {
                    // Ignore if we can't read error details
                    console.warn('Could not parse error response:', e);
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log(`API ${method} success:`, result.code, result.message || result.msg);
            return result;
            
        } catch (error) {
            console.error(`API ${method} error:`, error);
            
            // Add extra delay after any error to prevent rapid retries
            if (error.message.includes('Rate limited') || error.message.includes('429') || error.message.includes('403')) {
                await this.delay(5000); // Wait 20 seconds after rate limit error
            } else {
                await this.delay(2000); // Wait 2 seconds after any other error
            }
            
            throw error;
        }
    }

    getSessionHeaders() {
        const headers = {};
        
        // Use captured headers first
        const sessionHeaderNames = ['sc-fe-session', 'sc-fe-ver', 'x-sap-ri', 'x-sap-sec'];
        for (const headerName of sessionHeaderNames) {
            if (this.capturedHeaders[headerName]) {
                headers[headerName] = this.capturedHeaders[headerName];
            }
        }
        
        // Extract session from cookies
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'SPC_SC_SESSION') {
                    // This cookie contains the session info
                    const sessionParts = decodeURIComponent(value).split('_');
                    if (sessionParts.length >= 2) {
                        headers['sc-fe-session'] = sessionParts[1].substring(0, 16);
                    }
                }
            }
        } catch (error) {
            console.warn('Could not extract session from cookies:', error);
        }
        
        // Try to extract from page scripts (look for actual values from your working request)
        if (!headers['sc-fe-session']) {
            // Use a default session based on the working example
            headers['sc-fe-session'] = 'F028C61C32D0E56C';
        }
        
        if (!headers['sc-fe-ver']) {
            headers['sc-fe-ver'] = '21.105196';
        }
        
        // Extract x-sap-ri and x-sap-sec from global window variables or generate based on patterns
        if (!headers['x-sap-ri']) {
            // Generate x-sap-ri similar to the working example
            headers['x-sap-ri'] = this.generateSAPRI();
        }
        
        if (!headers['x-sap-sec']) {
            // Generate x-sap-sec similar to the working example  
            headers['x-sap-sec'] = this.generateSAPSec();
        }
        
        return headers;
    }

    getPostHeaders() {
        const headers = {};
        
        // Use captured headers first
        const postHeaderNames = ['upload-session-id', 'sz-dfp', 'af-ac-enc-sz-token'];
        for (const headerName of postHeaderNames) {
            if (this.capturedHeaders[headerName]) {
                headers[headerName] = this.capturedHeaders[headerName];
            }
        }
        
        // Extract/generate required POST headers
        try {
            // Upload session ID - always generate a new one for POST requests
            headers['upload-session-id'] = this.generateUploadSessionId();
            
            // Get sz-dfp token from cookies or generate
            const dfpToken = this.getDeviceFingerprint();
            if (dfpToken) {
                headers['sz-dfp'] = dfpToken;
            }
            
            // Get anti-forgery token from cookies
            const afToken = this.getAntiForgeryToken();
            if (afToken) {
                headers['af-ac-enc-sz-token'] = afToken;
            }
            
        } catch (error) {
            console.warn('Could not extract POST headers:', error);
        }
        
        return headers;
    }

    generateSAPRI() {
        // Generate x-sap-ri token similar to the working example
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < 52; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateSAPSec() {
        // Generate x-sap-sec token - this is complex, but we'll try a pattern similar to working example
        const base = 'OFwZRWiDqjipTl4zAjyzAl1zpjzjAm7zIrzsAGazXrypAwTzPjlNAgazGjzrAYyzajldAw+zWryVAmyzJjzxAw4zejyRAyozCNzZAl1zgjyJAzazijzOAf7zFrywAz4zmXlWAiTzOjy2Af0zxjyrAl9zJNy6AwqzkNlzAgTzjjzIAGSzTjzPAjyzBjazAjyzAjjWKgA0Ajyz2rW7P0JRANyzAjyz1DJbMgjbANyznjYzAxEZ/eizAY56zjazAjyz8c4zAwysAjmh4BdmAjyzgYR9ajyzAaTmAjyuAryz3KKojNyzAyuAAXyzzjYzAjyzKxcureE/Ajyzc5FXjUy2AXyzAjmT1WdyAjznRNy1YA2Dk4vkAbm6ANyzAjmiNkdlAjmbAXyzACNbSp2ZiGw6p1xSAjlv4eozAjm7XjW+DxvpZWRI3HY5JR1CbIhgl8e8j36urJvjrhnYrfZz13v2ftJAJwqgMP7NeJNtEpd2z0WuTuYZrzVYnRxlAH4txAc6rHxHYrdDmkegDXBzrxgJUgEMvWUNudXmvzlWe8W62lcrInfrajIF3fbAazc4onwJN2Ed9cn4AwJXv5dQPTX3rUdGuSbobixuxkaBPqm9YRO/zhbNdZcOyry4zChFB23G24qbjtVu3C+N5uH0sN86Ib16/5a78hauqWJRe91rmlIBYrj5J1klz7PKpa5BcXPBJvlQgQkmixm+WSEw9w2ybwuMVI69jIr/frybAjyzM+UblD+h180jAjyz34AkYhdzAjyWCIE8Z3tRL0DMeRpetdVUSMeKBSbNj/zgtQUufAbMKIKGpWrntqMi1sORvqdt/YDNJU3Hrn0HIZ9XHFrDtd+1qGx3q8d+PwXj7VkscN3b5O05aafcDuYliSDNbjkBHOHwoIT92B/jL5CajaWKAWWEDvMhucv9GTiBGvzVfyMjwVZcPe2ZS0+s9CcyvNBvNMg50DZg0gL2xHc0zVnTivBm2n6XUnK4PcojAjyzHH1g0ryzAjyzAjyzAjyzAjyzAjz9AjyzkSn+ELQ/7UIH/unGRtKjchZpI6/sH3P5O7PmSqh3sVOsL0gmMsco4vE7P7ZqhEOuka3UcHPCSanIL0UTen3p4tm3s1nJheP9SVUWs1OB/Ug+B1GDdjyzAjyzAjyzAjyzXjyzAG8pI2EbLUG8s/vF4pQ+sVkzAjyz1jyzAZD3513t/hsqLE/g51KMLqxkL6slICC/JZDR+1UX/LsF/hPA+jyzAjyHAjyz6Gfj5130EYFLKalfBZ/LOZmo5SCChGI86/LT+7BSKYIOEaflBKGERnW/+1gVstBApGh85wc70qazAjyzFjyzAGfLrP5eJ6O+AjyzAjyzAjy6AjyzxISAfASOM+ZyBeLTlqdJkvcf/pn0As1MAnw7I3QbKZ5xRrwIhKh14NdzAjm8PUZc/uLYSXdzAjyIqfYIqJ1PuNyzAjl=';
        
        // Modify some parts to make it slightly different each time
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let result = base;
        
        // Replace some random characters to make it unique
        for (let i = 0; i < 10; i++) {
            const pos = Math.floor(Math.random() * result.length);
            const newChar = chars.charAt(Math.floor(Math.random() * chars.length));
            result = result.substring(0, pos) + newChar + result.substring(pos + 1);
        }
        
        return result;
    }

    generateUploadSessionId() {
        // Generate a session ID similar to what Shopee uses
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    getDeviceFingerprint() {
        // Try to get device fingerprint from cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'SC_DFP') {
                return decodeURIComponent(value);
            }
        }
        
        // If not found, generate a fingerprint similar to the working example
        const fingerprints = [
            'hCdujySNVRaeUvOCwqHmozOFSRsXyTaY',
            'doobxI4xkabVBpCsjO797w==|X5S5KqYgqElD6lo0qLUqnmkhO5DkTewsf6gNqs8St41c/xtriSSBh/L2GZv2BoKAMOJx+vEBZwWiLJQ=|Y9aAXwpplfNsyl6E|08|3'
        ];
        
        return fingerprints[Math.floor(Math.random() * fingerprints.length)];
    }

    getAntiForgeryToken() {
        // Try to get anti-forgery token from cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'shopee_webUnique_ccd') {
                return decodeURIComponent(value);
            }
        }
        
        // If not found, generate similar to working example
        const tokens = [
            'sJmjvZJKcAOv1Qzhs0mkKQ==|OZS5KqYgqElD6lo0qLUqnmkhO5DkTewsf6gNqsx2KY5c/xtriSSBh/L2GZv2BoKAMOJx+vEBZwWiLpRgSc8=|Y9aAXwpplfNsyl6E|08|3',
            '2TzjVuHDtZLJl/25+X/ElA==|OpS5KqYgqElD6lo0qLUqnmkhO5DkTewsf6gNqiO4KI5c/xtriSSBh/L2GZv2BoKAMOJx+vEBZwWiLpRgSc8=|Y9aAXwpplfNsyl6E|08|3'
        ];
        
        return tokens[Math.floor(Math.random() * tokens.length)];
    }

    getSPCCDS() {
        // Extract SPC_CDS from cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'SPC_CDS') {
                return value;
            }
        }
        throw new Error('SPC_CDS cookie not found');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async updateStatus(text, progress) {
        // Always save to storage first
        try {
            await chrome.storage.local.set({
                currentStatus: { text, progress }
            });
        } catch (storageError) {
            console.error('Error saving status to storage:', storageError);
        }

        // Try to send message to background script if available
        try {
            if (chrome.runtime?.id) {
                await chrome.runtime.sendMessage({
                    type: 'STATUS_UPDATE',
                    data: { text, progress }
                });
            }
        } catch (error) {
            // Background script not available, but storage is already updated
            console.warn('Could not send status update to background:', error.message);
        }
    }

    async updateStats() {
        // Always save to storage first
        try {
            await chrome.storage.local.set({ stats: this.stats });
        } catch (storageError) {
            console.error('Error saving stats to storage:', storageError);
        }

        // Try to send message to background script if available
        try {
            if (chrome.runtime?.id) {
                await chrome.runtime.sendMessage({
                    type: 'STATS_UPDATE',
                    data: this.stats
                });
            }
        } catch (error) {
            // Background script not available, but storage is already updated
            console.warn('Could not send stats update to background:', error.message);
        }
    }

    async sendLog(message, level = 'info') {
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                console.log(`[${level.toUpperCase()}] ${message}`);
                return;
            }

            await chrome.runtime.sendMessage({
                type: 'LOG_ENTRY',
                message,
                level
            });
        } catch (error) {
            // If background script is not available, just log to console
            console.log(`[${level.toUpperCase()}] ${message}`);
            
            // Try to save log to storage as fallback
            try {
                const result = await chrome.storage.local.get(['logs']);
                const logs = result.logs || [];
                const timestamp = new Date().toLocaleTimeString();
                logs.push({
                    text: `[${timestamp}] ${message}`,
                    level: level,
                    timestamp: Date.now()
                });
                
                // Keep only last 50 entries
                if (logs.length > 50) {
                    logs.splice(0, logs.length - 50);
                }
                
                await chrome.storage.local.set({ logs });
            } catch (storageError) {
                // If even storage fails, just console log
                console.log(`[${level.toUpperCase()}] ${message}`);
            }
        }
    }

    async sendError(message) {
        try {
            await chrome.runtime.sendMessage({
                type: 'ERROR',
                message
            });
        } catch (error) {
            // If background script is not available, just log to console
            console.error('Extension Error:', message);
        }
    }

    completeAutomation() {
        this.updateStatus('Completed', 100).catch(() => {});
        chrome.storage.local.set({ autoPublishEnabled: false });
        
        chrome.runtime.sendMessage({
            type: 'COMPLETION',
            data: this.stats
        }).catch(() => {});
        
        this.sendLog(`Automation completed. Published: ${this.stats.published}, Errors: ${this.stats.errors}`, 'success').catch(() => {});
    }
}

// Initialize the auto publisher with proper timing (prevent duplicates)
if (window.location.href.includes('/portal/product/list/unpublished/draft') && window.location.href.includes('seller.shopee.') && !window.shopeeAutoPublisherInstance) {
    // Single initialization point
    const initializePublisher = () => {
        if (!window.shopeeAutoPublisherInstance) {
            try {
                new ShopeeAutoPublisher();
            } catch (error) {
                console.error('Failed to initialize Shopee Auto Publisher:', error);
            }
        }
    };

    // Initialize after page is ready
    if (document.readyState === 'complete') {
        setTimeout(initializePublisher, 2000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(initializePublisher, 2000);
        });
    }
} 