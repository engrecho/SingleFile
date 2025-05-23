export class DownloadManager {
    constructor() {
        this.isProcessing = false;
        this.queue = [];
    }

    async addToQueue(url, options) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                url,
                options,
                resolve,
                reject
            });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const item = this.queue[0];

        try {
            const tab = await browser.tabs.create({ url: item.url, active: false });
            
            // 等待页面加载完成
            await this.waitForPageLoad(tab.id);
            
            // 执行保存
            await browser.tabs.sendMessage(tab.id, {
                method: "content.save",
                ...item.options
            });
            
            // 等待下载开始
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 关闭标签页
            await browser.tabs.remove(tab.id);
            
            item.resolve();
        } catch (error) {
            item.reject(error);
        } finally {
            this.queue.shift();
            this.isProcessing = false;
            this.processQueue();
        }
    }

    async waitForPageLoad(tabId) {
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            try {
                const tab = await browser.tabs.get(tabId);
                if (tab.status === "complete") {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return;
                }
            } catch (error) {
                throw error;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        throw new Error("Page load timeout");
    }
}