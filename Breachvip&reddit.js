// ==UserScript==
// @name         Breach VIP & Reddit Analyzer with Privacy Enhancements
// @namespace    http://tampermonkey.net/
// @updateURL    https://raw.githubusercontent.com/airborne-commando/tapermonkey-collection/refs/heads/main/Breachvip%26reddit.js
// @downloadURL  https://raw.githubusercontent.com/airborne-commando/tapermonkey-collection/refs/heads/main/Breachvip%26reddit.js
// @version      1.6
// @description  Search breach data and analyze Reddit users with privacy controls and modular config
// @author       airborne-commando
// @match        https://www.google.com/search?q*
// @match        https://www.google.com/
// @match        https://www.google.com/?*
// @match        https://www.google.com/webhp?*
// @match        https://www.google.com/search?*
// @match        https://www.fastbackgroundcheck.com/*
// @match        https://fastbackgroundcheck.com/*
// @match        https://www.fastpeoplesearch.com/*
// @match        https://www.zabasearch.com/*
// @match        https://verify.vote.org/your-status
// @match        https://verify.vote.org/
// @match        *://*/*
// @exclude      *://*.google.com/recaptcha/*
// @exclude      *://*.hcaptcha.com/*
// @exclude      *://*captcha*
// @exclude      *://*recaptcha*
// @exclude      https://www.google.com/maps*
// @exclude      https://www.bing.com/maps*
// @exclude      cf.clym-widget.net
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant		 GM_setValue
// @grant		 GM_getValue
// @grant        GM_registerMenuCommand
// @connect      breach.vip
// @connect      api.r00m101.com
// @connect      web.archive.org
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration: Modular API URL constants ---
    const CONFIG = {
        BREACH_API_URL: 'https://breach.vip/api/search',
        REDDIT_ANALYSIS_API_URL_BASE: 'https://api.r00m101.com/analyze',
        UI_STYLES: `
			.breach-container {
				position: fixed;
				top: 10vh;
				right: 2vw;
				background: #2d3748;
				border: 1px solid #4a5568;
				border-radius: 8px;
				padding: 15px;
				color: white;
				font-family: Arial, sans-serif;
				font-size: 12px;
				z-index: 10000;
				box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
				min-width: 280px;
				max-width: 40vw;         /* Responsive width */
				width: 30vw;
			}
            .breach-container h3 {
                margin: 0 0 10px 0;
                color: #63b3ed;
                font-size: 14px;
            }
            .breach-input-group {
                margin-bottom: 10px;
            }
            .breach-input {
                width: 100%;
                padding: 6px;
                margin-bottom: 5px;
                border: 1px solid #4a5568;
                border-radius: 4px;
                background: #1a202c;
                color: white;
                box-sizing: border-box;
            }
            .breach-button {
                background: #3182ce;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 5px;
                margin-bottom: 5px;
                font-size: 11px;
            }
            .breach-button:hover {
                background: #2c5aa0;
            }
			.breach-results {
				background: #1a202c;
				border: 1px solid #4a5568;
				border-radius: 4px;
				padding: 10px;
				margin-top: 10px;
				max-height: 100px;        /* Responsive height */
				overflow-y: auto;
				white-space: pre-wrap;
				font-family: monospace;
				font-size: 11px;
			}
            .breach-min {
                position: absolute;
                top: 0px;
                right: 24px;
                background: none;
                border: none;
                color: #a0aec0;
                cursor: pointer;
                font-size: 16px;
            }
            .results-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .results-title {
                font-weight: bold;
                color: #63b3ed;
            }
            .download-btn {
                background: #38a169;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
            }
            .download-btn:hover {
                background: #2f855a;
            }
            .download-btn:disabled {
                background: #4a5568;
                cursor: not-allowed;
            }
        `
    };

		// Confirm user consent once per browser/session using GM storage
		const userConsent = async () => {
			const consentGiven = await GM_getValue('breachAnalyzerConsent', false);

			if (consentGiven) {
				// Consent was already given, no need to prompt
				return true;
			}

			return new Promise((resolve) => {
				const consent = confirm(
					`You are about to send sensitive data to an external service.\n\n` +
					`Do you consent to proceed?`
				);
				if (consent) {
					GM_setValue('breachAnalyzerConsent', true);
				}
				resolve(consent);
			});
		};

    // Sanitize input (basic trimming + simple validation, can be enhanced)
    const sanitizeInput = (value) => {
        return value.trim();
    };

    // Add style to document
    function injectStyles() {
        const styleTag = document.createElement('style');
        styleTag.textContent = CONFIG.UI_STYLES;
        document.head.appendChild(styleTag);
    }

	function setContainerPosition(container) {
		const hostname = window.location.hostname;

		// Define which hostnames represent fastbackgroundcheck and related
		const fastBackgroundSites = ['fastbackgroundcheck.com', 'www.fastbackgroundcheck.com', 'fastpeoplesearch.com', 'www.fastpeoplesearch.com', 'www.zabasearch.com'];

		const isGoogle = hostname.includes('google.com');
		const isFastBackground = fastBackgroundSites.includes(hostname);

		// On fastbackground sites, force right side
		// On google keep default (right)
		// On others default right side anyway

		if (isFastBackground) {
			container.style.right = '10px';
			container.style.top = '10px';
			container.style.right = 'auto';
		} else if (isGoogle) {
			// Preserve or could explicitly place on left or right depending on original style, assuming right is fine
			container.style.right = '10px';
			container.style.right = 'auto';
		} else {
			// Default to right side for other sites
			container.style.left = '10px';
			container.style.left = 'auto';
		}
	}

    // Create UI container and elements
    function createUI() {
        injectStyles();

        const container = document.createElement('div');
        container.className = 'breach-container';
        container.innerHTML = `
            <button class="breach-min" title="Minimize">_</button>
            <h3>Breach Analyzer</h3>
            <div class="breach-input-group">
                <input type="text" class="breach-input" id="breach-email" placeholder="Email address">
                <button class="breach-button" id="search-email">Search Email</button>
            </div>

            <div class="breach-input-group">
                <input type="text" class="breach-input" id="breach-user" placeholder="Username">
                <button class="breach-button" id="search-user">Search Username</button>
            </div>

            <div class="breach-input-group">
                <input type="text" class="breach-input" id="breach-phone" placeholder="Phone number">
                <button class="breach-button" id="search-phone">Search Phone</button>
            </div>

            <div class="breach-input-group">
                <input type="text" class="breach-input" id="breach-name" placeholder="Full name">
                <button class="breach-button" id="search-name">Search Name</button>
            </div>

            <div class="breach-input-group">
                <input type="text" class="breach-input" id="reddit-user" placeholder="Reddit username">
                <button class="breach-button" id="analyze-reddit">Analyze Reddit</button>
            </div>

			<div class="breach-input-group">
				<input type="text" class="breach-input" id="twitter-user" placeholder="Twitter username">
				<button class="breach-button" id="fetch-twitter">Get Archived Tweets</button>
			</div>

            <div class="results-header">
                <span class="results-title">Results:</span>
                <button class="download-btn" id="download-results" disabled>Download</button>
            </div>
            <div class="breach-results" id="breach-results">Results will appear here...</div>
        `;




        document.body.appendChild(container);

        // Minimize toggle
        const minimizeButton = container.querySelector('.breach-min');
        const contentElements = Array.from(container.children).filter(el =>
            !el.classList.contains('breach-min') && el.tagName !== 'H3'
        );
        let minimized = false;
        minimizeButton.addEventListener('click', () => {
            minimized = !minimized;
            contentElements.forEach(el => { el.style.display = minimized ? 'none' : ''; });
            minimizeButton.textContent = minimized ? '▢' : '_';
            minimizeButton.title = minimized ? 'Restore' : 'Minimize';
            container.style.minWidth = minimized ? '120px' : '300px';
        });

        // Event bindings for buttons with consent check and input sanitization
        document.getElementById('search-email').addEventListener('click', () => processBreachSearch('email'));
        document.getElementById('search-user').addEventListener('click', () => processBreachSearch('username'));
        document.getElementById('search-phone').addEventListener('click', () => processBreachSearch('phone'));
        document.getElementById('search-name').addEventListener('click', () => processBreachSearch('name'));
        document.getElementById('analyze-reddit').addEventListener('click', () => processRedditAnalysis());
        document.getElementById('fetch-twitter').addEventListener('click', () => fetchArchivedTweetsFromWayback());


        document.getElementById('download-results').addEventListener('click', () => downloadResults());

        // Enter key triggers search
        const inputs = container.querySelectorAll('.breach-input');
        inputs.forEach(input => {
            input.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    input.parentElement.querySelector('.breach-button').click();
                }
            });
        });
		setContainerPosition(container);
        return container;
    }

    // Show responses and enable download if valid result
    function updateResults(content) {
        const resultsDiv = document.getElementById('breach-results');
        const downloadBtn = document.getElementById('download-results');

        try {
            const parsed = JSON.parse(content);
            resultsDiv.textContent = JSON.stringify(parsed, null, 2);
        } catch {
            resultsDiv.textContent = content;
        }

        const invalidMessages = [
            'Results will appear here',
            'Please enter',
            'Searching for',
            'Error:'
        ];
        downloadBtn.disabled = invalidMessages.some(msg => content.includes(msg));
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }

    // Generic HTTP request wrapper using GM_xmlhttpRequest
    function makeRequest({ method, url, headers = {}, data = null }) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method,
                url,
                headers,
                data,
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`Request failed with status ${response.status}`));
                    }
                },
                onerror: error => reject(error)
            });
        });
    }

    // Download results as text file fallback handling included
    function downloadResults() {
        const resultsDiv = document.getElementById('breach-results');
        const content = resultsDiv.textContent;

        const invalidMessages = [
            'Results will appear here',
            'Please enter',
            'Searching for',
            'Error:'
        ];
        if (!content || invalidMessages.some(msg => content.includes(msg))) {
            GM_notification({
                text: 'No valid results to download',
                title: 'Download Error',
                timeout: 3000
            });
            return;
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `breach-results-${timestamp}.txt`;

        try {
            GM_download({
                url: blobUrl,
                name: filename,
                saveAs: true
            });
        } catch (error) {
            // Fallback download
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            GM_notification({
                text: `Download failed: ${error.message}`,
                title: 'Download Error',
                timeout: 3000
            });
        }
    }

    // Core function to perform breach.vip searches (type: email, username, phone, name)
    async function processBreachSearch(field) {
        const inputElement = document.getElementById(`breach-${field === 'username' ? 'user' : field}`);
        let inputValue = sanitizeInput(inputElement.value);
        if (!inputValue) {
            updateResults(`Please enter a valid ${field}`);
            return;
        }

        // Ask user consent before sending
        const consent = await userConsent(field, inputValue);
        if (!consent) {
            updateResults('User declined to send data.');
            return;
        }

        // Prepare search options based on field type
        const searchOptions = {
            term: inputValue,
            fields: [field],
            wildcard: field === 'phone', // Only phone uses wildcard search
            case_sensitive: field !== 'email' && field !== 'phone'
        };

        try {
            updateResults(`Searching for ${field}...`);
            const result = await makeRequest({
                method: 'POST',
                url: CONFIG.BREACH_API_URL,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(searchOptions)
            });
            updateResults(result);
        } catch (error) {
            updateResults(`Error: ${error.message}`);
        }
    }

    // Reddit user analysis with user consent
    async function processRedditAnalysis() {
        const inputElement = document.getElementById('reddit-user');
        let username = sanitizeInput(inputElement.value);
        if (!username) {
            updateResults('Please enter a Reddit username');
            return;
        }

        const consent = await userConsent('Reddit username', username);
        if (!consent) {
            updateResults('User declined to send data.');
            return;
        }

        try {
            updateResults('Analyzing Reddit user...');
            const result = await makeRequest({
                method: 'GET',
                url: `${CONFIG.REDDIT_ANALYSIS_API_URL_BASE}/${encodeURIComponent(username)}`,
                headers: { 'accept': 'application/json' }
            });
            updateResults(result);
        } catch (error) {
            updateResults(`Error: ${error.message}`);
        }
    }

// === Add this inside your existing IIFE after processRedditAnalysis ===

// Fetch archived tweets from the Wayback Machine
// Enhanced version of fetchArchivedTweetsFromWayback with caching support
async function fetchArchivedTweetsFromWayback() {
    const inputElement = document.getElementById('twitter-user');
    let username = sanitizeInput(inputElement.value);
    if (!username) {
        updateResults('Please enter a Twitter username');
        return;
    }

    // Check cache (valid for 12 hours)
    const cacheKey = `twitterArchives_${username}`;
    const cachedData = await GM_getValue(cacheKey, null);
    const now = Date.now();

    if (cachedData && (now - cachedData.timestamp < 12 * 60 * 60 * 1000)) {
        updateResults(`Cached results found for @${username} (from cache)\n\n` + cachedData.data);
        return;
    }

    updateResults(`Fetching archived tweets for @${username} from Wayback Machine...`);

    const apiUrl = `https://web.archive.org/cdx/search/cdx?url=twitter.com/${encodeURIComponent(username)}/*&output=json&fl=timestamp,original&filter=statuscode:200`;

    try {
        const responseText = await makeRequest({ method: 'GET', url: apiUrl });
        const data = JSON.parse(responseText);

        if (!Array.isArray(data) || data.length <= 1) {
            updateResults(`No archived tweets found for twitter.com/${username}`);
            return;
        }

        // Format URLs
        const tweetUrls = data.slice(1).map(([timestamp, originalUrl]) =>
            `https://web.archive.org/web/${timestamp}/${originalUrl}`
        );
        const resultText = `Found ${tweetUrls.length} archived tweets:\n\n${tweetUrls.join('\n')}`;

        // Save to cache
        await GM_setValue(cacheKey, { timestamp: now, data: resultText });
        updateResults(resultText);
    } catch (error) {
        updateResults(`Error fetching archived tweets: ${error.message}`);
    }
}

// Optional: Add a menu command to clear cache manually
GM_registerMenuCommand("Clear Twitter Archive Cache", async () => {
    const keys = await GM_listValues();
    const twitterKeys = keys.filter(k => k.startsWith("twitterArchives_"));
    for (const key of twitterKeys) await GM_deleteValue(key);
    GM_notification({ text: `Cleared ${twitterKeys.length} cached entries.`, title: "Cache Cleared", timeout: 3000 });
});

// function resizeResultsBox() {
//    const resultsBox = document.querySelector('.breach-results');
//    if (resultsBox) {
//        const viewportHeight = window.innerHeight;
//        resultsBox.style.maxHeight = `${Math.max(150, viewportHeight * 0.4)}px`;
//    }
// }
// window.addEventListener('resize', resizeResultsBox);

    // Initialize UI on window load
    window.addEventListener('load', () => {
        setTimeout(createUI, 1000);
    });

    // Register Tampermonkey menu command for manual triggering
    GM_registerMenuCommand("Open Breach Analyzer", () => {
        createUI();
    });
})();
