class PopupController {
    constructor() {
        this.initializeElements();
        this.loadState();
        this.setupEventListeners();
        this.startStateMonitoring();
    }

    initializeElements() {
        this.toggle = document.getElementById('autoPublishToggle');
        this.statusElement = document.getElementById('status');
        this.processedElement = document.getElementById('processed');
        this.publishedElement = document.getElementById('published');
        this.errorsElement = document.getElementById('errors');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.logsElement = document.getElementById('logs');
        this.clearLogsBtn = document.getElementById('clearLogs');
        this.resetCountersBtn = document.getElementById('resetCounters');
        this.modal = document.getElementById('completionModal');
        this.closeModalBtn = document.getElementById('closeModal');
        this.completionMessage = document.getElementById('completionMessage');
    }

    async loadState() {
        try {
            const result = await chrome.storage.local.get([
                'autoPublishEnabled',
                'stats',
                'logs',
                'currentStatus'
            ]);

            this.toggle.checked = result.autoPublishEnabled || false;
            this.updateStatus(result.autoPublishEnabled ? 'on' : 'off');
            
            const stats = result.stats || { processed: 0, published: 0, errors: 0 };
            this.updateStats(stats);
            
            const logs = result.logs || [];
            this.updateLogs(logs);
            
            if (result.currentStatus) {
                this.updateProgress(result.currentStatus);
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }

    setupEventListeners() {
        this.toggle.addEventListener('change', () => this.handleToggleChange());
        this.clearLogsBtn.addEventListener('click', () => this.clearLogs());
        this.resetCountersBtn.addEventListener('click', () => this.resetCounters());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
    }

    async handleToggleChange() {
        const enabled = this.toggle.checked;
        
        try {
            await chrome.storage.local.set({ autoPublishEnabled: enabled });
            this.updateStatus(enabled ? 'on' : 'off');
            
            // Send message to content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url.includes('seller.shopee.ph')) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'TOGGLE_AUTO_PUBLISH',
                    enabled: enabled
                });
            }
            
            if (enabled) {
                this.addLog('Auto publishing enabled', 'info');
                this.updateProgress({ text: 'Starting automation...', progress: 0 });
            } else {
                this.addLog('Auto publishing disabled', 'info');
                this.updateProgress({ text: 'Stopped', progress: 0 });
            }
        } catch (error) {
            console.error('Error toggling auto publish:', error);
            this.addLog('Error: Failed to toggle auto publish', 'error');
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'STATUS_UPDATE':
                this.updateProgress(message.data);
                break;
            case 'STATS_UPDATE':
                this.updateStats(message.data);
                break;
            case 'LOG_ENTRY':
                this.addLog(message.message, message.level);
                break;
            case 'COMPLETION':
                this.handleCompletion(message.data);
                break;
            case 'ERROR':
                this.addLog(`Error: ${message.message}`, 'error');
                this.updateStatus('off');
                this.toggle.checked = false;
                break;
        }
    }

    updateStatus(status) {
        this.statusElement.textContent = status.toUpperCase();
        this.statusElement.className = `status-value ${status}`;
    }

    updateStats(stats) {
        this.processedElement.textContent = stats.processed || 0;
        this.publishedElement.textContent = stats.published || 0;
        this.errorsElement.textContent = stats.errors || 0;
    }

    updateProgress(status) {
        if (status.progress !== undefined) {
            this.progressBar.style.width = `${status.progress}%`;
        }
        if (status.text) {
            this.progressText.textContent = status.text;
        }
    }

    addLog(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.logsElement.appendChild(logEntry);
        this.logsElement.scrollTop = this.logsElement.scrollHeight;
        
        // Keep only last 50 log entries
        while (this.logsElement.children.length > 50) {
            this.logsElement.removeChild(this.logsElement.firstChild);
        }
        
        // Save to storage
        this.saveLogs();
    }

    async saveLogs() {
        try {
            const logs = Array.from(this.logsElement.children).map(entry => ({
                text: entry.textContent,
                level: entry.className.split(' ')[1]
            }));
            await chrome.storage.local.set({ logs });
        } catch (error) {
            console.error('Error saving logs:', error);
        }
    }

    updateLogs(logs) {
        this.logsElement.innerHTML = '';
        logs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${log.level}`;
            logEntry.textContent = log.text;
            this.logsElement.appendChild(logEntry);
        });
        this.logsElement.scrollTop = this.logsElement.scrollHeight;
    }

    async clearLogs() {
        this.logsElement.innerHTML = '';
        await chrome.storage.local.set({ logs: [] });
        this.addLog('Logs cleared', 'info');
    }

    async resetCounters() {
        const stats = { processed: 0, published: 0, errors: 0 };
        this.updateStats(stats);
        await chrome.storage.local.set({ stats });
        this.addLog('Counters reset', 'info');
    }

    handleCompletion(data) {
        this.updateStatus('completed');
        this.toggle.checked = false;
        
        const message = `Processing completed!\n\nProcessed: ${data.processed}\nPublished: ${data.published}\nErrors: ${data.errors}`;
        this.completionMessage.textContent = message;
        this.modal.style.display = 'block';
        
        // Auto-close modal after 5 seconds
        setTimeout(() => {
            this.closeModal();
        }, 5000);
    }

    closeModal() {
        this.modal.style.display = 'none';
    }

    startStateMonitoring() {
        // Monitor storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                if (changes.stats && changes.stats.newValue) {
                    this.updateStats(changes.stats.newValue);
                }
                if (changes.currentStatus && changes.currentStatus.newValue) {
                    this.updateProgress(changes.currentStatus.newValue);
                    
                    // Check for completion
                    if (changes.currentStatus.newValue.text === 'Completed') {
                        // Small delay to ensure stats are updated
                        setTimeout(async () => {
                            try {
                                const result = await chrome.storage.local.get(['stats']);
                                if (result.stats) {
                                    this.handleCompletion(result.stats);
                                }
                            } catch (error) {
                                console.error('Error getting completion stats:', error);
                            }
                        }, 100);
                    }
                }
                if (changes.logs && changes.logs.newValue) {
                    this.updateLogs(changes.logs.newValue);
                }
                if (changes.autoPublishEnabled !== undefined) {
                    const enabled = changes.autoPublishEnabled.newValue;
                    if (this.toggle.checked !== enabled) {
                        this.toggle.checked = enabled;
                        this.updateStatus(enabled ? 'on' : 'off');
                    }
                }
            }
        });
        
        // Check if we're on the right page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.url.includes('seller.shopee.ph/portal/product/list/unpublished/draft')) {
                this.addLog('Please navigate to Shopee draft products page', 'info');
                this.updateProgress({ text: 'Navigate to draft products page', progress: 0 });
            }
        });
    }
}

// Initialize popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
}); 