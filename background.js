class BackgroundService {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.initializeExtension();
            }
        });

        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open
        });

        // Handle tab updates to check if we're on the right page
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tabId, tab);
            }
        });
    }

    async initializeExtension() {
        try {
            // Set default values
            await chrome.storage.local.set({
                autoPublishEnabled: false,
                stats: { processed: 0, published: 0, errors: 0 },
                logs: [],
                currentStatus: { text: 'Ready', progress: 0 }
            });
            
            console.log('Shopee Auto Publisher extension initialized');
        } catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'STATUS_UPDATE':
                    await chrome.storage.local.set({ currentStatus: message.data });
                    break;
                    
                case 'STATS_UPDATE':
                    await chrome.storage.local.set({ stats: message.data });
                    break;
                    
                case 'LOG_ENTRY':
                    await this.addLogEntry(message.message, message.level);
                    break;
                    
                case 'COMPLETION':
                    await chrome.storage.local.set({ 
                        autoPublishEnabled: false,
                        currentStatus: { text: 'Completed', progress: 100 }
                    });
                    break;
                    
                case 'ERROR':
                    await chrome.storage.local.set({ 
                        autoPublishEnabled: false,
                        currentStatus: { text: 'Error', progress: 0 }
                    });
                    await this.addLogEntry(`Error: ${message.message}`, 'error');
                    break;
                
                case 'GET_TAB_INFO':
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        sendResponse({ tab: tabs[0] });
                    });
                    return true; // Keep response channel open
                    
                case 'SESSION_INITIALIZED':
                    await this.addLogEntry('Session initialized successfully', 'info');
                    await chrome.storage.local.set({ 
                        currentStatus: { text: 'Session ready - Starting automation...', progress: 20 }
                    });
                    break;
                    
                case 'SESSION_ERROR':
                    await chrome.storage.local.set({ 
                        autoPublishEnabled: false,
                        currentStatus: { text: 'Session error', progress: 0 }
                    });
                    await this.addLogEntry(`Session error: ${message.message}`, 'error');
                    break;
            }
            
            // Send response to indicate success
            if (sendResponse) {
                sendResponse({ success: true });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            if (sendResponse) {
                sendResponse({ success: false, error: error.message });
            }
        }
    }

    async addLogEntry(message, level = 'info') {
        try {
            const result = await chrome.storage.local.get(['logs']);
            const logs = result.logs || [];
            
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = {
                text: `[${timestamp}] ${message}`,
                level: level,
                timestamp: Date.now()
            };
            
            logs.push(logEntry);
            
            // Keep only last 50 log entries
            if (logs.length > 50) {
                logs.splice(0, logs.length - 50);
            }
            
            await chrome.storage.local.set({ logs });
        } catch (error) {
            console.error('Error adding log entry:', error);
        }
    }

    handleTabUpdate(tabId, tab) {
        // Check if we're on the Shopee draft products page
        if (tab.url.includes('seller.shopee.ph/portal/product/list/unpublished/draft')) {
            // Set badge to indicate the extension is ready
            chrome.action.setBadgeText({
                text: '●',
                tabId: tabId
            });
            chrome.action.setBadgeBackgroundColor({
                color: '#4CAF50',
                tabId: tabId
            });
        } else if (tab.url.includes('seller.shopee.ph')) {
            // On Shopee but wrong page
            chrome.action.setBadgeText({
                text: '!',
                tabId: tabId
            });
            chrome.action.setBadgeBackgroundColor({
                color: '#FF9800',
                tabId: tabId
            });
        } else {
            // Not on Shopee
            chrome.action.setBadgeText({
                text: '',
                tabId: tabId
            });
        }
    }
}

// Initialize background service
new BackgroundService(); 