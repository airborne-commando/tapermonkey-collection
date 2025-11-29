// ==UserScript==
// @name         Breach VIP & Reddit Analyzer with Privacy Enhancements & Filtering
// @namespace    http://tampermonkey.net/
// @updateURL    https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/Breachvip-reddit.js
// @downloadURL  https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/Breachvip-reddit.js
// @version      1.9.1
// @description  Search breach data and analyze Reddit users with privacy controls, modular config, and advanced filtering
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
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_deleteValue
// @grant        GM_listValues
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
                top: 5vh;
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
                min-width: 300px;
                max-width: 40vw;
                width: 35vw;
                max-height: 85vh;
                overflow-y: auto;
                overflow-x: hidden;
                resize: both;
            }
            .breach-container::-webkit-scrollbar {
                width: 8px;
            }
            .breach-container::-webkit-scrollbar-track {
                background: #1a202c;
                border-radius: 4px;
            }
            .breach-container::-webkit-scrollbar-thumb {
                background: #4a5568;
                border-radius: 4px;
            }
            .breach-container::-webkit-scrollbar-thumb:hover {
                background: #718096;
            }
            .breach-container h3 {
                margin: 0 0 10px 0;
                color: #63b3ed;
                font-size: 14px;
                position: sticky;
                top: 0;
                background: #2d3748;
                padding: 5px 0;
                z-index: 1;
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
                max-height: 300px;
                min-height: 100px;
                overflow-y: auto;
                white-space: pre-wrap;
                font-family: monospace;
                font-size: 11px;
            }
            .breach-results::-webkit-scrollbar {
                width: 6px;
            }
            .breach-results::-webkit-scrollbar-track {
                background: #2d3748;
                border-radius: 3px;
            }
            .breach-results::-webkit-scrollbar-thumb {
                background: #4a5568;
                border-radius: 3px;
            }
            .breach-min {
                position: sticky;
                top: 0;
                right: 0;
                background: none;
                border: none;
                color: #a0aec0;
                cursor: pointer;
                font-size: 16px;
                float: right;
                z-index: 2;
                margin-left: 10px;
            }
            .breach-min:hover {
                color: #fff;
            }
            .results-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                position: sticky;
                top: 30px;
                background: #2d3748;
                padding: 5px 0;
                z-index: 1;
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
            /* Filter Styles */
            .breach-filter-section {
                border-top: 1px solid #4a5568;
                margin-top: 10px;
                padding-top: 10px;
            }
            .breach-filter-section h4 {
                margin: 0 0 10px 0;
                color: #63b3ed;
                font-size: 12px;
                position: sticky;
                top: 60px;
                background: #2d3748;
                padding: 5px 0;
                z-index: 1;
            }
            .filter-group {
                margin-bottom: 8px;
            }
            .filter-group label {
                display: block;
                margin-bottom: 4px;
                font-size: 11px;
            }
            .filter-inputs {
                margin-left: 15px;
            }
            .field-filters {
                max-height: 150px;
                overflow-y: auto;
                margin-left: 10px;
                border: 1px solid #4a5568;
                padding: 5px;
                border-radius: 4px;
                background: #1a202c;
            }
            .field-filters::-webkit-scrollbar {
                width: 4px;
            }
            .field-filters::-webkit-scrollbar-thumb {
                background: #4a5568;
                border-radius: 2px;
            }
            .field-filter {
                margin-bottom: 4px;
                display: flex;
                align-items: center;
            }
            .field-filter label {
                display: inline-block;
                width: 80px;
                font-size: 10px;
                margin-bottom: 0;
            }
            .field-filter input[type="text"] {
                width: calc(100% - 90px);
                font-size: 10px;
                margin-bottom: 0;
            }
            .filter-buttons {
                display: flex;
                gap: 5px;
                margin-top: 8px;
                position: sticky;
                bottom: 0;
                background: #2d3748;
                padding: 5px 0;
                z-index: 1;
            }
            .filter-buttons .breach-button {
                flex: 1;
                font-size: 10px;
                padding: 4px 8px;
            }
            .filter-stats {
                font-size: 10px;
                color: #a0aec0;
                margin-top: 5px;
                position: sticky;
                bottom: 40px;
                background: #2d3748;
                padding: 2px 0;
            }
            .container-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                position: sticky;
                top: 0;
                background: #2d3748;
                padding: 5px 0;
                z-index: 2;
            }
            .resize-handle {
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 12px;
                height: 12px;
                cursor: nw-resize;
                opacity: 0.5;
                color: #a0aec0;
                font-size: 12px;
            }
            .resize-handle:hover {
                opacity: 1;
                color: #fff;
            }
        `
    };

    // BreachVIP Filter Function
    function createBreachFilter() {
        const filterConfig = {
            sources: {
                included: [],
                excluded: [],
                enabled: false
            },
            categories: {
                included: [],
                excluded: [],
                enabled: false
            },
            limits: {
                maxResults: 1000,
                enabled: false
            },
            fields: {
                email: { enabled: false, patterns: [] },
                password: { enabled: false, patterns: [] },
                domain: { enabled: false, patterns: [] },
                username: { enabled: false, patterns: [] },
                ip: { enabled: false, patterns: [] },
                name: { enabled: false, patterns: [] },
                uuid: { enabled: false, patterns: [] },
                steamid: { enabled: false, patterns: [] },
                phone: { enabled: false, patterns: [] },
                discordid: { enabled: false, patterns: [] }
            }
        };

        function loadFilterConfig() {
            const saved = GM_getValue('breachFilterConfig', null);
            if (saved) {
                Object.assign(filterConfig, saved);
            }
            return filterConfig;
        }

        function saveFilterConfig() {
            GM_setValue('breachFilterConfig', filterConfig);
        }

        function applyFilters(results, searchType) {
            if (!Array.isArray(results)) return [];
            
            let filteredResults = [...results];
            const originalCount = filteredResults.length;
            
            // Apply source filters
            if (filterConfig.sources.enabled) {
                filteredResults = filteredResults.filter(result => {
                    const source = result.source?.toLowerCase();
                    
                    if (filterConfig.sources.excluded.some(excluded => 
                        source.includes(excluded.toLowerCase()))) {
                        return false;
                    }
                    
                    if (filterConfig.sources.included.length > 0) {
                        return filterConfig.sources.included.some(included => 
                            source.includes(included.toLowerCase()));
                    }
                    
                    return true;
                });
            }
            
            // Apply category filters
            if (filterConfig.categories.enabled) {
                filteredResults = filteredResults.filter(result => {
                    const categories = Array.isArray(result.categories) ? 
                        result.categories : [result.categories];
                    
                    if (filterConfig.categories.excluded.some(excluded => 
                        categories.some(cat => 
                            cat?.toString().toLowerCase().includes(excluded.toLowerCase())))) {
                        return false;
                    }
                    
                    if (filterConfig.categories.included.length > 0) {
                        return filterConfig.categories.included.some(included => 
                            categories.some(cat => 
                                cat?.toString().toLowerCase().includes(included.toLowerCase())));
                    }
                    
                    return true;
                });
            }
            
            // Apply field-specific pattern matching
            Object.keys(filterConfig.fields).forEach(field => {
                const fieldConfig = filterConfig.fields[field];
                if (fieldConfig.enabled && fieldConfig.patterns.length > 0) {
                    filteredResults = filteredResults.filter(result => {
                        const fieldValue = result[field];
                        if (!fieldValue) return true;
                        
                        return fieldConfig.patterns.some(pattern => {
                            try {
                                const regex = new RegExp(pattern, 'i');
                                return regex.test(fieldValue.toString());
                            } catch (e) {
                                return fieldValue.toString().toLowerCase().includes(pattern.toLowerCase());
                            }
                        });
                    });
                }
            });
            
            // Apply result limits
            if (filterConfig.limits.enabled && filterConfig.limits.maxResults > 0) {
                filteredResults = filteredResults.slice(0, filterConfig.limits.maxResults);
            }
            
            return {
                results: filteredResults,
                originalCount: originalCount,
                filteredCount: filteredResults.length,
                removedCount: originalCount - filteredResults.length
            };
        }

        function createFilterUI() {
            const filterHTML = `
                <div class="breach-filter-section">
                    <h4>Search Filters</h4>
                    
                    <div class="filter-group">
                        <label>
                            <input type="checkbox" id="filter-sources-enabled"> Filter by Source
                        </label>
                        <div class="filter-inputs">
                            <input type="text" id="filter-sources-include" placeholder="Include sources (comma-separated)" class="breach-input">
                            <input type="text" id="filter-sources-exclude" placeholder="Exclude sources (comma-separated)" class="breach-input">
                        </div>
                    </div>
                    
                    <div class="filter-group">
                        <label>
                            <input type="checkbox" id="filter-categories-enabled"> Filter by Category
                        </label>
                        <div class="filter-inputs">
                            <input type="text" id="filter-categories-include" placeholder="Include categories (comma-separated)" class="breach-input">
                            <input type="text" id="filter-categories-exclude" placeholder="Exclude categories (comma-separated)" class="breach-input">
                        </div>
                    </div>
                    
                    <div class="filter-group">
                        <label>
                            <input type="checkbox" id="filter-limits-enabled"> Limit Results
                        </label>
                        <div class="filter-inputs">
                            <input type="number" id="filter-max-results" placeholder="Max results" class="breach-input" min="1" max="10000" value="1000">
                        </div>
                    </div>
                    
                    <div class="filter-group">
                        <label>Field Pattern Matching:</label>
                        <div class="field-filters" id="field-filters-container">
                        </div>
                    </div>
                    
                    <div class="filter-buttons">
                        <button class="breach-button" id="apply-filters">Apply Filters</button>
                        <button class="breach-button" id="reset-filters">Reset</button>
                        <button class="breach-button" id="save-filters">Save</button>
                    </div>
                    <div class="filter-stats" id="filter-stats"></div>
                </div>
            `;

            return filterHTML;
        }

        function initializeFieldFilters() {
            const container = document.getElementById('field-filters-container');
            if (!container) return;

            const fields = ['email', 'password', 'domain', 'username', 'ip', 'name', 'uuid', 'steamid', 'phone', 'discordid'];
            
            container.innerHTML = fields.map(field => `
                <div class="field-filter">
                    <label>
                        <input type="checkbox" id="filter-field-${field}-enabled"> ${field}
                    </label>
                    <input type="text" id="filter-field-${field}-patterns" placeholder="Patterns (comma-separated)" class="breach-input">
                </div>
            `).join('');
        }

        function loadFilterUI() {
            const elements = {
                'filter-sources-enabled': filterConfig.sources.enabled,
                'filter-sources-include': filterConfig.sources.included.join(', '),
                'filter-sources-exclude': filterConfig.sources.excluded.join(', '),
                'filter-categories-enabled': filterConfig.categories.enabled,
                'filter-categories-include': filterConfig.categories.included.join(', '),
                'filter-categories-exclude': filterConfig.categories.excluded.join(', '),
                'filter-limits-enabled': filterConfig.limits.enabled,
                'filter-max-results': filterConfig.limits.maxResults
            };

            Object.keys(elements).forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = elements[id];
                    } else {
                        element.value = elements[id];
                    }
                }
            });

            Object.keys(filterConfig.fields).forEach(field => {
                const enabledCheckbox = document.getElementById(`filter-field-${field}-enabled`);
                const patternsInput = document.getElementById(`filter-field-${field}-patterns`);
                
                if (enabledCheckbox && patternsInput) {
                    enabledCheckbox.checked = filterConfig.fields[field].enabled;
                    patternsInput.value = filterConfig.fields[field].patterns.join(', ');
                }
            });
        }

        function saveFilterUI() {
            filterConfig.sources.enabled = document.getElementById('filter-sources-enabled').checked;
            filterConfig.sources.included = document.getElementById('filter-sources-include').value
                .split(',')
                .map(s => s.trim())
                .filter(s => s);
            filterConfig.sources.excluded = document.getElementById('filter-sources-exclude').value
                .split(',')
                .map(s => s.trim())
                .filter(s => s);
            
            filterConfig.categories.enabled = document.getElementById('filter-categories-enabled').checked;
            filterConfig.categories.included = document.getElementById('filter-categories-include').value
                .split(',')
                .map(s => s.trim())
                .filter(s => s);
            filterConfig.categories.excluded = document.getElementById('filter-categories-exclude').value
                .split(',')
                .map(s => s.trim())
                .filter(s => s);
            
            filterConfig.limits.enabled = document.getElementById('filter-limits-enabled').checked;
            const maxResults = parseInt(document.getElementById('filter-max-results').value);
            if (!isNaN(maxResults)) {
                filterConfig.limits.maxResults = Math.min(Math.max(1, maxResults), 10000);
            }
            
            Object.keys(filterConfig.fields).forEach(field => {
                const enabledCheckbox = document.getElementById(`filter-field-${field}-enabled`);
                const patternsInput = document.getElementById(`filter-field-${field}-patterns`);
                
                if (enabledCheckbox && patternsInput) {
                    filterConfig.fields[field].enabled = enabledCheckbox.checked;
                    filterConfig.fields[field].patterns = patternsInput.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s);
                }
            });
            
            saveFilterConfig();
            updateFilterStats();
        }

        function resetFilters() {
            Object.assign(filterConfig, {
                sources: { included: [], excluded: [], enabled: false },
                categories: { included: [], excluded: [], enabled: false },
                limits: { maxResults: 1000, enabled: false },
                fields: Object.fromEntries(
                    Object.keys(filterConfig.fields).map(field => [
                        field, 
                        { enabled: false, patterns: [] }
                    ])
                )
            });
            
            saveFilterConfig();
            if (document.getElementById('filter-sources-enabled')) {
                loadFilterUI();
            }
            updateFilterStats();
        }

        function updateFilterStats() {
            const statsElement = document.getElementById('filter-stats');
            if (statsElement) {
                const activeFilters = [
                    filterConfig.sources.enabled && 'Sources',
                    filterConfig.categories.enabled && 'Categories',
                    filterConfig.limits.enabled && 'Limits',
                    ...Object.keys(filterConfig.fields).filter(field => filterConfig.fields[field].enabled)
                ].filter(Boolean);
                
                statsElement.textContent = activeFilters.length > 0 
                    ? `Active: ${activeFilters.join(', ')}` 
                    : 'No active filters';
            }
        }

        return {
            loadFilterConfig,
            saveFilterConfig,
            applyFilters,
            createFilterUI,
            initializeFieldFilters,
            loadFilterUI,
            saveFilterUI,
            resetFilters,
            updateFilterStats,
            getConfig: () => filterConfig
        };
    }

    // Initialize the filter system
    const breachFilter = createBreachFilter();
    breachFilter.loadFilterConfig();

    // Confirm user consent once per browser/session using GM storage
    const userConsent = async () => {
        const consentGiven = await GM_getValue('breachAnalyzerConsent', false);

        if (consentGiven) {
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
        const fastBackgroundSites = ['fastbackgroundcheck.com', 'www.fastbackgroundcheck.com', 'fastpeoplesearch.com', 'www.fastpeoplesearch.com', 'www.zabasearch.com'];

        const isGoogle = hostname.includes('google.com');
        const isFastBackground = fastBackgroundSites.includes(hostname);

        if (isFastBackground) {
            container.style.right = '10px';
            container.style.top = '10px';
            container.style.left = 'auto';
        } else if (isGoogle) {
            container.style.right = '10px';
            container.style.left = 'auto';
        } else {
            container.style.left = '10px';
            container.style.right = 'auto';
        }
    }

    // Create UI container and elements
    function createUI() {
        injectStyles();

        const container = document.createElement('div');
        container.className = 'breach-container';
        container.innerHTML = `
            <div class="container-header">
                <h3>Breach Analyzer</h3>
                <button class="breach-min" title="Minimize">_</button>
            </div>

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
            
            <!-- Add the filter section -->
            ${breachFilter.createFilterUI()}
            
            <div class="resize-handle" title="Resize">⤢</div>
        `;

        document.body.appendChild(container);

        // Initialize filters
        breachFilter.initializeFieldFilters();
        breachFilter.loadFilterUI();
        breachFilter.updateFilterStats();

        // Minimize toggle
        const minimizeButton = container.querySelector('.breach-min');
        const contentElements = Array.from(container.children).filter(el =>
            !el.classList.contains('container-header') && 
            !el.classList.contains('resize-handle')
        );
        let minimized = false;
        minimizeButton.addEventListener('click', () => {
            minimized = !minimized;
            contentElements.forEach(el => { 
                if (el.classList.contains('container-header')) {
                    el.style.display = minimized ? 'flex' : 'flex';
                } else {
                    el.style.display = minimized ? 'none' : ''; 
                }
            });
            minimizeButton.textContent = minimized ? '▢' : '_';
            minimizeButton.title = minimized ? 'Restore' : 'Minimize';
            container.style.minWidth = minimized ? '150px' : '300px';
            container.style.minHeight = minimized ? 'auto' : '400px';
            if (minimized) {
                container.style.height = 'auto';
            }
        });

        // Event bindings for buttons with consent check and input sanitization
        document.getElementById('search-email').addEventListener('click', () => processBreachSearch('email'));
        document.getElementById('search-user').addEventListener('click', () => processBreachSearch('username'));
        document.getElementById('search-phone').addEventListener('click', () => processBreachSearch('phone'));
        document.getElementById('search-name').addEventListener('click', () => processBreachSearch('name'));
        document.getElementById('analyze-reddit').addEventListener('click', () => processRedditAnalysis());
        document.getElementById('fetch-twitter').addEventListener('click', () => fetchArchivedTweetsFromWayback());
        document.getElementById('download-results').addEventListener('click', () => downloadResults());

        // Filter event listeners
        document.getElementById('apply-filters').addEventListener('click', () => {
            breachFilter.saveFilterUI();
            GM_notification({ text: 'Filters applied and saved', title: 'Breach Filter', timeout: 2000 });
        });
        
        document.getElementById('reset-filters').addEventListener('click', () => {
            breachFilter.resetFilters();
            GM_notification({ text: 'Filters reset to default', title: 'Breach Filter', timeout: 2000 });
        });
        
        document.getElementById('save-filters').addEventListener('click', () => {
            breachFilter.saveFilterUI();
            GM_notification({ text: 'Filters saved', title: 'Breach Filter', timeout: 2000 });
        });

        // Enter key triggers search
        const inputs = container.querySelectorAll('.breach-input');
        inputs.forEach(input => {
            input.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    input.parentElement.querySelector('.breach-button').click();
                }
            });
        });
        
        // Simple resize functionality
        const resizeHandle = container.querySelector('.resize-handle');
        let isResizing = false;
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const newWidth = Math.max(300, e.clientX - container.getBoundingClientRect().left);
            const newHeight = Math.max(400, e.clientY - container.getBoundingClientRect().top);
            
            container.style.width = newWidth + 'px';
            container.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
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

        const consent = await userConsent(field, inputValue);
        if (!consent) {
            updateResults('User declined to send data.');
            return;
        }

        const searchOptions = {
            term: inputValue,
            fields: [field],
            wildcard: field === 'phone',
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
            
            // Apply filters to the results
            const parsedResult = JSON.parse(result);
            if (parsedResult.results) {
                const filtered = breachFilter.applyFilters(parsedResult.results, field);
                parsedResult.results = filtered.results;
                parsedResult.filteredCount = filtered.filteredCount;
                parsedResult.originalCount = filtered.originalCount;
                parsedResult.removedCount = filtered.removedCount;
                
                // Add filter stats to results display
                if (filtered.removedCount > 0) {
                    parsedResult.filterStats = {
                        original: filtered.originalCount,
                        filtered: filtered.filteredCount,
                        removed: filtered.removedCount
                    };
                }
            }
            
            updateResults(JSON.stringify(parsedResult, null, 2));
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

    // Fetch archived tweets from the Wayback Machine
    async function fetchArchivedTweetsFromWayback() {
        const inputElement = document.getElementById('twitter-user');
        let username = sanitizeInput(inputElement.value);
        if (!username) {
            updateResults('Please enter a Twitter username');
            return;
        }

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

            const tweetUrls = data.slice(1).map(([timestamp, originalUrl]) =>
                `https://web.archive.org/web/${timestamp}/${originalUrl}`
            );
            const resultText = `Found ${tweetUrls.length} archived tweets:\n\n${tweetUrls.join('\n')}`;

            await GM_setValue(cacheKey, { timestamp: now, data: resultText });
            updateResults(resultText);
        } catch (error) {
            updateResults(`Error fetching archived tweets: ${error.message}`);
        }
    }

    // Menu commands
    GM_registerMenuCommand("Clear Twitter Archive Cache", async () => {
        const keys = await GM_listValues();
        const twitterKeys = keys.filter(k => k.startsWith("twitterArchives_"));
        for (const key of twitterKeys) await GM_deleteValue(key);
        GM_notification({ text: `Cleared ${twitterKeys.length} cached entries.`, title: "Cache Cleared", timeout: 3000 });
    });

    GM_registerMenuCommand("Reset All Filters", () => {
        breachFilter.resetFilters();
        GM_notification({ text: "All filters reset to default", title: "Filters Reset", timeout: 3000 });
    });

    GM_registerMenuCommand("View Filter Settings", () => {
        const config = breachFilter.getConfig();
        alert(`Current Filter Settings:\n\nSources: ${config.sources.enabled ? 'ON' : 'OFF'}\nCategories: ${config.categories.enabled ? 'ON' : 'OFF'}\nLimits: ${config.limits.enabled ? 'ON' : 'OFF'}\nMax Results: ${config.limits.maxResults}\n\nActive Field Filters: ${Object.keys(config.fields).filter(f => config.fields[f].enabled).join(', ') || 'None'}`);
    });

    // Initialize UI on window load
    window.addEventListener('load', () => {
        setTimeout(createUI, 1000);
    });
})();