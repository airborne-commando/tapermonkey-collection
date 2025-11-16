// ==UserScript==
// @name         Link Extractor with Load/Save
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Extract links from pages and save/load them along with excluded words in the browser storage
// @author       airborne-commando
// @match        *://*/*
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'LinkExtractorData';

    // Link extraction utility
    function extractLinks(excludeWords = []) {
        const links = [...document.querySelectorAll("a[href]")].map(a => a.href);
        return links.filter(link => {
            try {
                new URL(link);
                return !excludeWords.some(word => link.toLowerCase().includes(word.toLowerCase()));
            } catch {
                return false; // Skip invalid URLs
            }
        });
    }

    // Save text content as file
    function saveToFile(filename, text) {
        const blob = new Blob([text], {type: "text/plain;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Save data (URLs + exclude words) to localStorage
    function saveData(urls, excludes) {
        const data = { urls, excludes };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // Load data from localStorage
    function loadData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { urls: '', excludes: '' };
        try {
            const parsed = JSON.parse(raw);
            return {
                urls: parsed.urls || '',
                excludes: parsed.excludes || ''
            };
        } catch {
            return { urls: '', excludes: '' };
        }
    }

    // GUI creation
    function createUI() {
        // Remove existing panel if present
        const existingPanel = document.getElementById('archiveToolPanel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement("div");
        panel.id = "archiveToolPanel";
        panel.style.cssText = `
            position: fixed;
            top: 20px; right: 20px;
            background: #1e1e1e; color: #f0f0f0;
            padding: 15px; border-radius: 8px;
            z-index: 10000; width: 370px;
            font-family: sans-serif; font-size: 13px;
            border: 1px solid #444;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin:0;">Link Extractor v1.3</h3>
                <button id="closeBtn" style="background: #555; border: none; color: white; border-radius: 3px; padding: 2px 8px;">X</button>
            </div>
            <textarea id="urlsInput" placeholder="Enter URLs, one per line..." style="width:100%; height:130px; background: #2d2d2d; color: white; border: 1px solid #555; padding: 5px; box-sizing: border-box;"></textarea>
            <textarea id="excludeInput" placeholder="Words to exclude (optional)..." style="width:100%; height:50px; margin-top:8px; background: #2d2d2d; color: white; border: 1px solid #555; padding: 5px; box-sizing: border-box;"></textarea>
            <div style="margin-top: 10px; display: flex; gap: 5px; flex-wrap: wrap;">
                <button id="extractBtn" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">Extract Links</button>
                <button id="saveBtn" style="flex: 1; background: #2196F3; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">Save to File</button>
                <button id="loadBtn" style="flex: 1; background: #FFC107; color: black; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">Load Saved</button>
                <button id="clearBtn" style="flex: 1; background: #f44336; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">Clear</button>
            </div>
            <pre id="statusLog" style="max-height:150px; overflow:auto; background:#121212; padding:8px; color:#0f0; margin-top: 10px; border: 1px solid #333; font-size: 11px; white-space: pre-wrap;"></pre>
        `;
        document.body.appendChild(panel);

        const log = msg => {
            const logBox = document.getElementById("statusLog");
            const timestamp = new Date().toLocaleTimeString();
            logBox.textContent += `[${timestamp}] ${msg}\n`;
            logBox.scrollTop = logBox.scrollHeight;
        };

        // Wait for DOM to be ready before accessing elements
        const initializeUI = () => {
            const urlsInput = document.getElementById("urlsInput");
            const excludeInput = document.getElementById("excludeInput");

            if (!urlsInput || !excludeInput) {
                setTimeout(initializeUI, 10);
                return;
            }

            // Load saved data into textareas
            const savedData = loadData();
            urlsInput.value = savedData.urls;
            excludeInput.value = savedData.excludes;
            log('✓ Loaded saved data on panel open');

            document.getElementById("extractBtn").onclick = () => {
                try {
                    const excludes = excludeInput.value.split("\n").map(s => s.trim()).filter(Boolean);
                    const links = extractLinks(excludes);
                    urlsInput.value = links.join("\n");
                    log(`✓ Extracted ${links.length} links`);
                } catch (error) {
                    log(`✗ Error extracting links: ${error.message}`);
                }
            };

            document.getElementById("saveBtn").onclick = () => {
                try {
                    const urls = urlsInput.value.trim();
                    const excludes = excludeInput.value.trim();
                    if (!urls) {
                        log("✗ No URLs to save");
                        return;
                    }
                    saveToFile('extracted-links.txt', urls);
                    saveData(urls, excludes);
                    log("✓ Saved links to extracted-links.txt and saved data to storage");
                    if (typeof GM_notification !== "undefined") {
                        GM_notification({text: "Links saved successfully.", title: "Link Extractor", timeout: 3000});
                    }
                } catch (error) {
                    log(`✗ Error saving file: ${error.message}`);
                }
            };

            document.getElementById("loadBtn").onclick = () => {
                try {
                    const data = loadData();
                    urlsInput.value = data.urls;
                    excludeInput.value = data.excludes;
                    log("✓ Loaded saved data from storage");
                } catch (error) {
                    log(`✗ Error loading saved data: ${error.message}`);
                }
            };

            document.getElementById("clearBtn").onclick = () => {
                urlsInput.value = "";
                excludeInput.value = "";
                document.getElementById("statusLog").textContent = "";
                // Also clear saved data
                localStorage.removeItem(STORAGE_KEY);
                log("✓ Cleared all data and storage");
            };

            document.getElementById("closeBtn").onclick = () => {
                panel.remove();
            };
        };

        // Initialize the UI after a short delay to ensure DOM is ready
        setTimeout(initializeUI, 0);

        // Make panel draggable
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        panel.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                isDragging = true;
                dragOffset.x = e.clientX - panel.getBoundingClientRect().left;
                dragOffset.y = e.clientY - panel.getBoundingClientRect().top;
                panel.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                panel.style.left = (e.clientX - dragOffset.x) + 'px';
                panel.style.right = 'auto';
                panel.style.top = (e.clientY - dragOffset.y) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            panel.style.cursor = 'default';
        });
    }

    // Add a button to show the panel if it's not already visible
    function addToggleButton() {
        if (document.getElementById('archiveToolToggle')) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'archiveToolToggle';
        toggleBtn.innerHTML = '🔗';
        toggleBtn.title = 'Show Link Extractor';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;

        toggleBtn.onclick = createUI;
        document.body.appendChild(toggleBtn);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addToggleButton);
    } else {
        addToggleButton();
    }

})();