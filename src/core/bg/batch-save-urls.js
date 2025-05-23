import { downloadSemaphore } from "./config.js";
import { DownloadManager } from "./download-manager.js";

const downloadManager = new DownloadManager();

export async function processURLs(urls, options = { openEditor: false }) {
    let currentTab = null;
    
    for (const url of urls) {
        try {
            // 1. 等待前一个下载完成
            await downloadSemaphore.acquire();
            
            // 2. 如果有前一个标签页，确保它被关闭
            if (currentTab) {
                try {
                    await browser.tabs.remove(currentTab.id);
                } catch (error) {
                    console.error("Error closing previous tab:", error);
                }
            }
            
            // 3. 创建新标签页并等待加载
            currentTab = await browser.tabs.create({ url, active: false });
            
            // 4. 等待页面完全加载
            await waitForPageLoad(currentTab.id);
            
            // 5. 保存页面
            await savePage(url, options);
            
            // 6. 等待下载完成
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.error("Error processing URL:", url, error);
        } finally {
            await downloadSemaphore.release();
        }
    }
    
    // 处理最后一个标签
    if (currentTab) {
        try {
            await browser.tabs.remove(currentTab.id);
        } catch (error) {
            console.error("Error closing final tab:", error);
        }
    }
}

async function waitForPageLoad(tabId) {
    let attempts = 0;
    const maxAttempts = 30; // 最多等待30秒
    
    while (attempts < maxAttempts) {
        try {
            const tab = await browser.tabs.get(tabId);
            if (tab.status === "complete") {
                // 额外等待2秒确保页面完全渲染
                await new Promise(resolve => setTimeout(resolve, 2000));
                return;
            }
        } catch (error) {
            break; // 如果标签不存在则退出
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
}

async function savePage(url, options) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Page save timeout"));
        }, 60000);
        
        browser.runtime.sendMessage({
            method: "content.save",
            url: url,
            ...options
        }).then(() => {
            clearTimeout(timeoutId);
            resolve();
        }).catch(error => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}