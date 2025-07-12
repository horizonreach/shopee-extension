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
        this.domainSelect = document.getElementById('domainSelect');
        this.customDomainInput = document.getElementById('customDomain');
    }

    async loadState() {
        try {
            const result = await chrome.storage.local.get([
                'autoPublishEnabled',
                'stats',
                'logs',
                'currentStatus',
                'selectedDomain',
                'customDomain'
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
            
            // Load domain settings
            const selectedDomain = result.selectedDomain || 'seller.shopee.ph';
            this.domainSelect.value = selectedDomain;
            
            if (result.customDomain) {
                this.customDomainInput.value = result.customDomain;
            }
            
            this.handleDomainSelectChange();
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }

    setupEventListeners() {
        this.toggle.addEventListener('change', () => this.handleToggleChange());
        this.clearLogsBtn.addEventListener('click', () => this.clearLogs());
        this.resetCountersBtn.addEventListener('click', () => this.resetCounters());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.domainSelect.addEventListener('change', () => this.handleDomainSelectChange());
        this.customDomainInput.addEventListener('input', () => this.handleCustomDomainChange());
        
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
            
            if (enabled) {
                const selectedDomain = await this.getSelectedDomain();
                this.addLog(`${selectedDomain} で自動出品を開始しました`, 'info');
                this.updateProgress({ text: 'Shopeeドラフトページを開いています...', progress: 5 });
                
                // Open new tab with selected Shopee domain
                const newTab = await chrome.tabs.create({
                    url: `https://${selectedDomain}/portal/product/list/unpublished/draft`,
                    active: true
                });
                
                this.addLog('セッション初期化のため新しいタブを開いています...', 'info');
                
                // Wait for tab to load and then send message to content script
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(newTab.id, {
                            type: 'TOGGLE_AUTO_PUBLISH',
                            enabled: enabled,
                            domain: selectedDomain
                        });
                        this.addLog('セッション初期化を開始しました', 'info');
                        this.updateProgress({ text: 'セッションを初期化しています...', progress: 10 });
                    } catch (error) {
                        console.error('Error sending message to content script:', error);
                        this.addLog('エラー: セッション初期化に失敗しました', 'error');
                    }
                }, 3000); // Wait 3 seconds for page to fully load
                
            } else {
                this.addLog('🛑 自動出品を停止しています...', 'warning');
                this.updateProgress({ text: '停止中...', progress: 0 });
                
                // Send message to any Shopee tabs to stop automation
                let messagesSent = 0;
                
                try {
                    // Get all tabs and filter manually for better control
                    const allTabs = await chrome.tabs.query({});
                    const shopeePatterns = [
                        /https:\/\/seller\.shopee\.(ph|com\.my|sg|co\.th|tw|com\.br|com)/,
                        /https:\/\/banhang\.shopee\.vn/
                    ];
                    
                    const shopeeTabs = allTabs.filter(tab => {
                        if (!tab.url) return false;
                        return shopeePatterns.some(pattern => pattern.test(tab.url));
                    });
                    
                    console.log('Found Shopee tabs:', shopeeTabs.map(tab => ({ id: tab.id, url: tab.url })));
                    this.addLog(`検出されたShopeeタブ: ${shopeeTabs.length}個`, 'info');
                    
                    for (const tab of shopeeTabs) {
                        try {
                            const response = await chrome.tabs.sendMessage(tab.id, {
                                type: 'TOGGLE_AUTO_PUBLISH',
                                enabled: false
                            });
                            
                            console.log(`Stop message sent to tab ${tab.id}:`, response);
                            this.addLog(`停止メッセージを送信しました: ${tab.url}`, 'info');
                            messagesSent++;
                        } catch (error) {
                            console.warn(`Could not send stop message to tab ${tab.id}:`, error);
                            this.addLog(`タブ ${tab.id} への送信に失敗: ${error.message}`, 'warning');
                        }
                    }
                } catch (error) {
                    console.error('Error querying tabs:', error);
                    this.addLog(`タブ検索エラー: ${error.message}`, 'error');
                }
                
                if (messagesSent === 0) {
                    this.addLog('⚠️ 実行中のタブが見つかりませんでした', 'warning');
                    this.updateProgress({ text: '停止済み', progress: 0 });
                } else {
                    this.addLog(`${messagesSent}個のタブに停止メッセージを送信しました`, 'info');
                    // Wait a bit for the stop message to be processed
                    setTimeout(() => {
                        this.updateProgress({ text: '停止済み', progress: 0 });
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error toggling auto publish:', error);
            this.addLog('エラー: 自動出品の切り替えに失敗しました', 'error');
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
                this.addLog(`エラー: ${message.message}`, 'error');
                this.updateStatus('off');
                this.toggle.checked = false;
                break;
        }
    }

    updateStatus(status) {
        let statusText = '';
        switch(status) {
            case 'on':
                statusText = '実行中';
                break;
            case 'off':
                statusText = '停止中';
                break;
            case 'completed':
                statusText = '完了';
                break;
            default:
                statusText = status;
        }
        this.statusElement.textContent = statusText;
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
        this.addLog('ログをクリアしました', 'info');
    }

    async resetCounters() {
        const stats = { processed: 0, published: 0, errors: 0 };
        this.updateStats(stats);
        await chrome.storage.local.set({ stats });
        this.addLog('カウンターをリセットしました', 'info');
    }

    handleCompletion(data) {
        this.updateStatus('completed');
        this.toggle.checked = false;
        
        let message;
        if (data.message && data.message.includes('stopped by user')) {
            message = `自動出品を停止しました\n\n処理済み: ${data.processed}\n出品済み: ${data.published}\nエラー: ${data.errors}`;
        } else {
            message = `処理が完了しました！\n\n処理済み: ${data.processed}\n出品済み: ${data.published}\nエラー: ${data.errors}`;
        }
        
        this.completionMessage.textContent = message;
        this.modal.style.display = 'block';
        
        // Auto-close modal after 5 seconds (only if not stopped by user)
        if (!data.message || !data.message.includes('stopped by user')) {
            setTimeout(() => {
                this.closeModal();
            }, 5000);
        }
    }

    closeModal() {
        this.modal.style.display = 'none';
    }

    async handleDomainSelectChange() {
        const selectedValue = this.domainSelect.value;
        
        if (selectedValue === 'custom') {
            this.customDomainInput.style.display = 'block';
        } else {
            this.customDomainInput.style.display = 'none';
            // Save the selected domain
            await chrome.storage.local.set({ 
                selectedDomain: selectedValue,
                customDomain: ''
            });
            this.addLog(`ドメインを ${selectedValue} に変更しました`, 'info');
        }
    }

    async handleCustomDomainChange() {
        const customDomain = this.customDomainInput.value.trim();
        if (customDomain) {
            // Validate domain format
            const domainRegex = /^seller\.shopee\.[a-z.]+$/;
            if (domainRegex.test(customDomain)) {
                await chrome.storage.local.set({ 
                    selectedDomain: 'custom',
                    customDomain: customDomain
                });
                this.addLog(`カスタムドメインを ${customDomain} に設定しました`, 'info');
            } else {
                this.addLog('無効なドメイン形式です。形式: seller.shopee.xxx', 'error');
            }
        }
    }

    async getSelectedDomain() {
        try {
            const result = await chrome.storage.local.get(['selectedDomain', 'customDomain']);
            if (result.selectedDomain === 'custom' && result.customDomain) {
                return result.customDomain;
            }
            return result.selectedDomain || 'seller.shopee.ph';
        } catch (error) {
            console.error('Error getting selected domain:', error);
            return 'seller.shopee.ph';
        }
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
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            const selectedDomain = await this.getSelectedDomain();
            if (!tab || !tab.url.includes(`${selectedDomain}/portal/product/list/unpublished/draft`)) {
                this.addLog('開始準備完了 - トグルを有効にするとShopeeドラフトページが自動で開きます', 'info');
                this.updateProgress({ text: '自動化開始準備完了', progress: 0 });
            }
        });
    }
}

// Initialize popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
}); 