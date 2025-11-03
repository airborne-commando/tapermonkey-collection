// ==UserScript==
// @name         Google Dorking Assistant
// @updateURL    https://raw.githubusercontent.com/airborne-commando/tapermonkey-collection/refs/heads/main/SCRIPTS/gdork.sh
// @downloadURL  https://raw.githubusercontent.com/airborne-commando/tapermonkey-collection/refs/heads/main/SCRIPTS/gdork.sh
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Interactive Google Dorking tool with updated operators based on Google Advanced Search
// @author       airborne-commando
// @match        https://www.google.com/search?q*
// @match        https://www.google.com/
// @match        https://www.google.com/?*
// @match        https://www.google.com/webhp?*
// @match        https://www.google.com/search?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_download
// @license      GPL 3.0
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const STORAGE_KEY = 'google_dork_profiles';

    // Color scheme
    const COLORS = {
        red: '#ff4444',
        green: '#44ff44',
        yellow: '#ffff44',
        blue: '#4444ff',
        cyan: '#44ffff',
        normal: '#ffffff'
    };

    // Profile database
    const PROFILES = {
        // Generic searches
        "General Person Search": "\"First Last\"",
        "General US Search": "\"First Last\" USA",

        // Common site searches
        "Facebook Search": "site:facebook.com \"First Last\"",
        "LinkedIn Search": "site:linkedin.com \"First Last\"",
        "Instagram Search": "site:instagram.com \"First Last\"",
        "Twitter Search": "site:twitter.com \"First Last\"",
        "YouTube Search": "site:youtube.com \"First Last\"",
        "Reddit Search": "site:reddit.com \"First Last\"",
        "Pinterest Search": "site:pinterest.com \"First Last\"",

        // Specialized sites
        "News Search": "site:news.google.com \"First Last\"",
        "Blog Search": "site:blogspot.com OR site:wordpress.com \"First Last\"",
        "Government Search": "site:.gov \"First Last\"",
        "Education Search": "site:.edu \"First Last\""
    };

    // UPDATED: Dork operators database based on PDF
    const DORK_DB = {
        // Basic operators (currently supported)
        "site:": "Search within specific site (site:example.com)",
        "intitle:": "Words in page title (intitle:\"login page\")",
        "inurl:": "Words in URL (inurl:admin)",
        "intext:": "Words in page body (intext:\"confidential\")",

        // Advanced operators (currently supported)
        "allintitle:": "ALL words in title (allintitle:admin login)",
        "allinurl:": "ALL words in URL (allinurl:dashboard admin)",
        "allintext:": "ALL words in body (allintext:password username)",
        "allinanchor:": "ALL words in anchor text (allinanchor:best restaurant)",
        "inanchor:": "Single word in anchor text (inanchor:sales)",

        // Boolean and proximity
        "OR": "Either term can appear (must be uppercase)",
        "-": "Exclude term (login -facebook)",
        "\"\"": "Exact phrase (\"confidential file\")",
        "*": "Wildcard for any word (admin * login)",
        "AROUND(n)": "Words within n distance (search AROUND(3) engine)",

        // Filetype (updated based on PDF)
        "filetype:pdf": "Search PDF files",
        "filetype:pptx": "Search PowerPoint files",
        "filetype:doc": "Search Word documents",
        "filetype:xls": "Search Excel files",

        // Date filters
        "before:": "Results before date (before:2023-01-01)",
        "after:": "Results after date (after:2023-01-01)",

        // Definition
        "define": "Word definition (define peruse) - no colon",

        // Number range
        "..": "Number range (Willie Mays 1950..1960)"
    };

    // UPDATED: Dork categories based on current operators
    const DORK_CATEGORIES = {
        "Basic": "Common operators for general searches",
        "Advanced": "More specialized search operators",
        "Boolean": "Logical operators and proximity search",
        "Filetype": "Search for specific file formats",
        "Date": "Filter results by date",
        "Technical": "Special search functions"
    };

    class GoogleDorkingTool {
        constructor() {
            this.currentQuery = '';
            this.customProfiles = this.loadCustomProfiles();
            this.isMobile = this.detectMobile();
            this.isCollapsed = false;
            this.init();
        }

        detectMobile() {
            return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        init() {
            this.injectToolbar();
            this.registerMenuCommands();
            this.addResponsiveStyles();
            this.addViewportListener();
        }

        addViewportListener() {
            // Update mobile detection on resize
            window.addEventListener('resize', () => {
                const wasMobile = this.isMobile;
                this.isMobile = this.detectMobile();

                if (wasMobile !== this.isMobile) {
                    // Re-inject toolbar if mobile state changed
                    this.injectToolbar();
                }
            });
        }

        addResponsiveStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .dork-btn {
                    font-size: ${this.isMobile ? '10px' : '12px'};
                    padding: ${this.isMobile ? '4px 2px' : '6px 4px'};
                    min-height: ${this.isMobile ? '30px' : 'auto'};
                    word-break: break-word;
                    line-height: 1.2;
                    border: none;
                    border-radius: 4px;
                    background: #444;
                    color: white;
                    cursor: pointer;
                }

                .dork-btn:hover {
                    background: #555;
                }

                .mobile-collapsed .dork-btn {
                    font-size: 9px;
                    padding: 2px 1px;
                    min-height: 25px;
                }

                #dork-toolbar {
                    font-family: Arial, sans-serif;
                    color: white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    max-height: 80vh;
                    overflow-y: auto;
                    transition: all 0.3s ease;
                    z-index: 10000;
                }

                /* Desktop positioning */
                #dork-toolbar:not(.mobile) {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #2d2d2d;
                    border: 2px solid #444;
                    border-radius: 8px;
                    padding: 10px;
                    min-width: 300px;
                    max-width: 500px;
                    font-size: 12px;
                }

                /* Mobile positioning */
				#dork-toolbar.mobile {
					position: fixed;
					bottom: 0;
					left: 0;
					right: 0;
					background: #2d2d2d;
					border-top: 2px solid #444;
					border-radius: 12px 12px 0 0;
					padding: 10px;
					min-width: 100vw;
					max-width: 100vw;
					font-size: 11px;
					max-height: 70vh;
					touch-action: pan-y; /* Enable vertical scrolling */
				}

				#dork-toolbar.mobile #dork-content {
					overflow-y: auto;
					max-height: calc(70vh - 60px); /* Account for header height */
					-webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
					touch-action: pan-y; /* Enable vertical scrolling */
				}

				/* Scrollable areas within specific menus */
				.profile-menu-content,
				.operators-menu-content,
				.manage-profiles-content {
					overflow-y: auto;
					max-height: 50vh;
					-webkit-overflow-scrolling: touch;
					touch-action: pan-y;
				}

                #dork-toolbar.mobile.collapsed {
                    height: 50px;
                    max-height: 50px;
                    padding: 5px;
                }

                #dork-toolbar.mobile.collapsed #dork-content {
                    display: none;
                }

                #dork-toolbar.mobile.collapsed .toolbar-header {
                    margin-bottom: 0;
                    justify-content: center;
                }

                #dork-toolbar.mobile.collapsed .toolbar-title {
                    display: none;
                }

                .mobile-toggle {
                    display: ${this.isMobile ? 'inline-block' : 'none'};
                    background: ${COLORS.blue};
                    border: none;
                    color: white;
                    border-radius: 3px;
                    padding: 2px 6px;
                    margin-left: 5px;
                    font-size: 10px;
                    cursor: pointer;
                }

                .toolbar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .toolbar-title {
                    color: ${COLORS.green};
                    font-weight: bold;
                }

                /* Mobile-specific styles */
                @media (max-width: 480px) {
                    #dork-toolbar.mobile {
                        font-size: 10px;
                        padding: 8px;
                    }

                    .dork-btn {
                        font-size: 9px;
                        padding: 3px 1px;
                    }
                }

                @media (max-width: 360px) {
                    #dork-toolbar.mobile {
                        font-size: 9px;
                        padding: 6px;
                    }

                    .dork-btn {
                        font-size: 8px;
                        padding: 2px 1px;
                    }
                }

                /* Prevent body scroll when toolbar is expanded on mobile */
                body.toolbar-expanded {
                    overflow: hidden;
                }
            `;
            document.head.appendChild(style);
        }

        loadCustomProfiles() {
            const saved = GM_getValue(STORAGE_KEY, '{}');
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error loading profiles:', e);
                return {};
            }
        }

        saveCustomProfiles() {
            GM_setValue(STORAGE_KEY, JSON.stringify(this.customProfiles));
        }

        registerMenuCommands() {
            GM_registerMenuCommand('Google Dorking Assistant', () => this.showMainMenu(), 'd');
            GM_registerMenuCommand('Quick Profile Search', () => this.showProfileMenu(), 'p');
            GM_registerMenuCommand('Custom Dork Builder', () => this.showCustomBuilder(), 'c');
            GM_registerMenuCommand('Manage Profiles', () => this.showManageProfiles(), 'm');
            GM_registerMenuCommand('Export Profiles to JSON', () => this.exportProfilesToJSON(), 'e');
            GM_registerMenuCommand('Import Profiles from JSON', () => this.importProfilesFromJSON(), 'i');
        }

        injectToolbar() {
            // Remove existing toolbar if present
            const existingToolbar = document.getElementById('dork-toolbar');
            if (existingToolbar) {
                existingToolbar.remove();
            }

            // Create floating toolbar
            const toolbar = document.createElement('div');
            toolbar.id = 'dork-toolbar';

            // Apply mobile or desktop styling
            if (this.isMobile) {
                toolbar.classList.add('mobile');
                if (this.isCollapsed) {
                    toolbar.classList.add('collapsed');
                }
            }

            toolbar.innerHTML = `
                <div class="toolbar-header">
                    <div class="toolbar-title">Dorking Assistant</div>
                    <div>
                        <button class="mobile-toggle" id="mobile-toggle">${this.isCollapsed ? '↑' : '↓'}</button>
                        <button id="close-toolbar" style="background: ${COLORS.red}; border: none; color: white; border-radius: 3px; padding: 2px 6px; cursor: pointer;">×</button>
                    </div>
                </div>
                <div id="dork-content"></div>
            `;

            document.body.appendChild(toolbar);

            // Add event listeners
            document.getElementById('close-toolbar').addEventListener('click', () => {
                toolbar.style.display = 'none';
            });

            document.getElementById('mobile-toggle').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMobileMenu();
            });

            // Add swipe support for mobile
            if (this.isMobile) {
                this.addSwipeSupport(toolbar);
            }

            // Initial content
            this.showMainMenu();
        }

		addSwipeSupport(toolbar) {
			let startY = 0;
			let currentY = 0;
			let isSwiping = false;

			// Only add swipe to header, not the entire toolbar
			const toolbarHeader = toolbar.querySelector('.toolbar-header');

			toolbarHeader.addEventListener('touchstart', (e) => {
				startY = e.touches[0].clientY;
				currentY = startY;
				isSwiping = true;
			}, { passive: true });

			toolbarHeader.addEventListener('touchmove', (e) => {
				if (!isSwiping) return;
				currentY = e.touches[0].clientY;

				// Prevent swipe if user is scrolling content
				const diff = Math.abs(startY - currentY);
				if (diff > 10) {
					e.preventDefault();
				}
			}, { passive: false });

			toolbarHeader.addEventListener('touchend', () => {
				if (!isSwiping) return;

				const diff = startY - currentY;
				const threshold = 30; // Increased threshold to prevent accidental triggers

				if (diff > threshold && !this.isCollapsed) {
					// Swipe up - collapse
					this.toggleMobileMenu();
				} else if (diff < -threshold && this.isCollapsed) {
					// Swipe down - expand
					this.toggleMobileMenu();
				}

				isSwiping = false;
			}, { passive: true });

			// Prevent swipe events from propagating to content areas
			const contentArea = toolbar.querySelector('#dork-content');
			if (contentArea) {
				contentArea.addEventListener('touchstart', (e) => {
					e.stopPropagation();
				}, { passive: true });

				contentArea.addEventListener('touchmove', (e) => {
					e.stopPropagation();
				}, { passive: true });

				contentArea.addEventListener('touchend', (e) => {
					e.stopPropagation();
				}, { passive: true });
			}
		}

        toggleMobileMenu() {
            const toolbar = document.getElementById('dork-toolbar');
            const toggleBtn = document.getElementById('mobile-toggle');

            if (this.isCollapsed) {
                // Expand
                toolbar.classList.remove('collapsed');
                toggleBtn.textContent = '↓';
                this.isCollapsed = false;
                document.body.classList.remove('toolbar-expanded');
                // Refresh content to show full menu
                this.showMainMenu();
            } else {
                // Collapse
                toolbar.classList.add('collapsed');
                toggleBtn.textContent = '↑';
                this.isCollapsed = true;
                document.body.classList.add('toolbar-expanded');
                // Clear content when collapsed
                this.setContent('');
            }
        }

        showMainMenu() {
            // Don't show content if collapsed
            if (this.isCollapsed) {
                return;
            }

            const isCompact = this.isMobile;

            const content = `
                <div>
                    <div style="margin-bottom: 10px; color: ${COLORS.cyan}; font-size: ${isCompact ? '10px' : '12px'};">Current: ${this.currentQuery || '(empty)'}</div>
                    <div style="display: grid; grid-template-columns: ${isCompact ? '1fr 1fr 1fr' : '1fr 1fr'}; gap: 3px;">
                        <button class="dork-btn" data-action="basic">${isCompact ? 'Basic' : 'Basic Operators'}</button>
                        <button class="dork-btn" data-action="advanced">${isCompact ? 'Advanced' : 'Advanced Operators'}</button>
                        <button class="dork-btn" data-action="boolean">${isCompact ? 'Boolean' : 'Boolean & Proximity'}</button>
                        <button class="dork-btn" data-action="filetype">${isCompact ? 'Filetype' : 'Filetype Operators'}</button>
                        <button class="dork-btn" data-action="date">${isCompact ? 'Date' : 'Date Filters'}</button>
                        <button class="dork-btn" data-action="custom">${isCompact ? 'Custom' : 'Custom Builder'}</button>
                        <button class="dork-btn" data-action="profiles">${isCompact ? 'Profiles' : 'Profile Search'}</button>
                        <button class="dork-btn" data-action="manage">${isCompact ? 'Manage' : 'Manage Profiles'}</button>
                        <button class="dork-btn" data-action="save">${isCompact ? 'Save' : 'Save Query'}</button>
                        <button class="dork-btn" data-action="load">${isCompact ? 'Load' : 'Load Profiles'}</button>
                        <button class="dork-btn" data-action="export" style="background: ${COLORS.blue}">${isCompact ? 'Export' : 'Export Profiles'}</button>
                        <button class="dork-btn" data-action="import" style="background: ${COLORS.blue}">${isCompact ? 'Import' : 'Import Profiles'}</button>
                        <button class="dork-btn" data-action="execute" style="grid-column: ${isCompact ? '1 / -1' : '1 / -1'}; background: ${COLORS.red}">Execute Search</button>
                        <button class="dork-btn" data-action="clear" style="background: ${COLORS.red}">Clear</button>
                    </div>
                </div>
            `;

            this.setContent(content);
            this.bindMenuEvents();
        }

        setContent(html) {
            const contentEl = document.getElementById('dork-content');
            if (contentEl) {
                contentEl.innerHTML = html;
            }
        }

        bindMenuEvents() {
            const buttons = document.querySelectorAll('.dork-btn');
            buttons.forEach(button => {
                button.replaceWith(button.cloneNode(true));
            });

            const newButtons = document.querySelectorAll('.dork-btn');
            newButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.target.getAttribute('data-action');
                    this.handleMenuAction(action);
                });
            });
        }

        handleMenuAction(action) {
            switch(action) {
                case 'basic':
                    this.showOperatorsMenu('Basic');
                    break;
                case 'advanced':
                    this.showOperatorsMenu('Advanced');
                    break;
                case 'boolean':
                    this.showOperatorsMenu('Boolean');
                    break;
                case 'filetype':
                    this.showOperatorsMenu('Filetype');
                    break;
                case 'date':
                    this.showOperatorsMenu('Date');
                    break;
                case 'custom':
                    this.showCustomBuilder();
                    break;
                case 'profiles':
                    this.showProfileMenu();
                    break;
                case 'manage':
                    this.showManageProfiles();
                    break;
                case 'save':
                    this.saveCurrentQuery();
                    break;
                case 'load':
                    this.loadProfile();
                    break;
                case 'export':
                    this.exportProfilesToJSON();
                    break;
                case 'import':
                    this.importProfilesFromJSON();
                    break;
                case 'execute':
                    this.executeSearch();
                    break;
                case 'clear':
                    this.currentQuery = '';
                    this.showMainMenu();
                    break;
            }
        }

		showOperatorsMenu(category) {
			if (this.isCollapsed) return;

			const operators = this.getOperatorsByCategory(category);
			let content = `
				<div>
					<div style="margin-bottom: 10px;">
						<button class="back-btn" data-action="main" style="background: ${COLORS.blue}; border: none; color: white; padding: 2px 8px; border-radius: 3px; font-size: ${this.isMobile ? '10px' : '12px'};">← Back</button>
						<strong style="color: ${COLORS.green}; font-size: ${this.isMobile ? '12px' : '14px'};">${category} Operators</strong>
					</div>
					<div style="color: ${COLORS.cyan}; margin-bottom: 10px; font-size: ${this.isMobile ? '10px' : '12px'};">${DORK_CATEGORIES[category]}</div>
					<div class="operators-menu-content" style="display: flex; flex-direction: column; gap: 4px; max-height: ${this.isMobile ? '40vh' : 'none'}; overflow-y: ${this.isMobile ? 'auto' : 'visible'};">
			`;

            operators.forEach((op, index) => {
                content += `
                    <button class="operator-btn" data-operator="${op}" style="text-align: left; padding: 6px; background: #444; border: 1px solid #666; color: white; border-radius: 3px; font-size: ${this.isMobile ? '10px' : '12px'};">
                        <strong style="color: ${COLORS.blue}">${op}</strong><br>
                        <small style="color: ${COLORS.yellow}">${DORK_DB[op]}</small>
                    </button>
                `;
            });

            content += `</div></div>`;
            this.setContent(content);

            this.bindSingleEvent('.back-btn', 'click', () => this.showMainMenu());

            const operatorButtons = document.querySelectorAll('.operator-btn');
            operatorButtons.forEach(button => {
                this.bindSingleEvent(button, 'click', (e) => {
                    const operator = e.target.closest('.operator-btn').getAttribute('data-operator');
                    this.processOperator(operator);
                });
            });
        }

        getOperatorsByCategory(category) {
            switch(category) {
                case "Basic": return ["site:", "intitle:", "inurl:", "intext:"];
                case "Advanced": return ["allintitle:", "allinurl:", "allintext:", "allinanchor:", "inanchor:"];
                case "Boolean": return ["OR", "-", "\"\"", "*", "AROUND(n)"];
                case "Filetype": return ["filetype:pdf", "filetype:pptx", "filetype:doc", "filetype:xls"];
                case "Date": return ["before:", "after:"];
                case "Technical": return ["define", ".."];
                default: return [];
            }
        }


        processOperator(operator) {
            let promptText = '';
            let defaultValue = '';

            switch(operator) {
                case '\"\"':
                    promptText = 'Enter exact phrase:';
                    break;
                case '-':
                    promptText = 'Enter term to exclude:';
                    break;
                case 'AROUND(n)': {
                    const term1 = prompt('Enter first term:');
                    if (term1 === null) return;
                    const distance = prompt('Enter word distance (n):', '3');
                    if (distance === null) return;
                    const term2 = prompt('Enter second term:');
                    if (term2 === null) return;

                    this.currentQuery = this.currentQuery ?
                        `${this.currentQuery} ${term1} AROUND(${distance}) ${term2}` :
                    `${term1} AROUND(${distance}) ${term2}`;
                    this.showMainMenu();
                    return;
                }
                case '..': {
                    const rangeStart = prompt('Enter start of number range:');
                    if (rangeStart === null) return;
                    const rangeEnd = prompt('Enter end of number range:');
                    if (rangeEnd === null) return;

                    this.currentQuery = this.currentQuery ?
                        `${this.currentQuery} ${rangeStart}..${rangeEnd}` :
                    `${rangeStart}..${rangeEnd}`;
                    this.showMainMenu();
                    return;
                }
                case 'define':
                    promptText = 'Enter term to define:';
                    break;
                default:
                    if (operator.includes(':')) {
                        const operatorName = operator.replace(':', '');
                        promptText = `Enter value for ${operatorName}:`;
                        if (operator === 'site:') defaultValue = 'example.com';
                        else if (operator === 'before:' || operator === 'after:') defaultValue = 'YYYY-MM-DD';
                    } else {
                        promptText = `Enter term to combine with ${operator}:`;
                    }
            }

            const value = prompt(promptText, defaultValue);
            if (value === null) return;

            this.addToQuery(operator, value);
            this.showMainMenu();
        }


        addToQuery(operator, value) {
            if (operator === '\"\"') {
                this.currentQuery = this.currentQuery ? `${this.currentQuery} "${value}"` : `"${value}"`;
            } else if (operator === '-') {
                this.currentQuery = `${this.currentQuery} -${value}`;
            } else if (operator === 'define') {
                this.currentQuery = this.currentQuery ? `${this.currentQuery} define ${value}` : `define ${value}`;
            } else if (operator.includes(':')) {
                if (operator.startsWith('filetype:')) {
                    const queryPart = `${operator} ${value}`;
                    this.currentQuery = this.currentQuery ? `${this.currentQuery} ${queryPart}` : queryPart;
                } else {
                    const queryPart = `${operator}${value}`;
                    this.currentQuery = this.currentQuery ? `${this.currentQuery} ${queryPart}` : queryPart;
                }
            } else {
                this.currentQuery = this.currentQuery ? `${this.currentQuery} ${operator} ${value}` : value;
            }
        }

		showProfileMenu() {
			if (this.isCollapsed) return;

			this.customProfiles = this.loadCustomProfiles();
			const allProfiles = {...PROFILES, ...this.customProfiles};
			const profileKeys = Object.keys(allProfiles);

			let content = `
				<div>
					<div style="margin-bottom: 10px;">
						<button class="back-btn" data-action="main" style="background: ${COLORS.blue}; border: none; color: white; padding: 2px 8px; border-radius: 3px; font-size: ${this.isMobile ? '10px' : '12px'};">← Back</button>
						<strong style="color: ${COLORS.green}; font-size: ${this.isMobile ? '12px' : '14px'};">Profile Search</strong>
					</div>
					<div style="margin-bottom: 10px; color: ${COLORS.yellow}; font-size: ${this.isMobile ? '10px' : '12px'};">Total profiles: ${profileKeys.length} (${Object.keys(this.customProfiles).length} custom)</div>
					<div class="profile-menu-content" style="max-height: ${this.isMobile ? '40vh' : '300px'}; overflow-y: auto;">
			`;

            if (profileKeys.length === 0) {
                content += `<div style="padding: 20px; text-align: center; color: ${COLORS.yellow}">No profiles found.</div>`;
            } else {
                profileKeys.forEach((profileName, index) => {
                    const isCustom = this.customProfiles.hasOwnProperty(profileName);
                    const badge = isCustom ? `<small style="color: ${COLORS.yellow}"> (custom)</small>` : '';

                    content += `
                        <div class="profile-item" style="padding: 6px; border-bottom: 1px solid #444; cursor: pointer; font-size: ${this.isMobile ? '10px' : '12px'};" data-profile="${profileName}">
                            <strong style="color: ${COLORS.blue}">${profileName}</strong>${badge}<br>
                            <small style="color: ${COLORS.cyan}">${allProfiles[profileName]}</small>
                        </div>
                    `;
                });
            }

            content += `</div></div>`;
            this.setContent(content);

            this.bindSingleEvent('.back-btn', 'click', () => this.showMainMenu());

            const profileItems = document.querySelectorAll('.profile-item');
            profileItems.forEach(item => {
                this.bindSingleEvent(item, 'click', (e) => {
                    const profileName = e.target.closest('.profile-item').getAttribute('data-profile');
                    this.loadProfileTemplate(profileName);
                });
            });
        }

        loadProfileTemplate(profileName) {
            const allProfiles = {...PROFILES, ...this.customProfiles};
            let query = allProfiles[profileName];

            if (query.includes('First Last')) {
                const name = prompt('Enter name (replace "First Last"):', 'John Doe');
                if (name) {
                    query = query.replace(/First Last/g, name);
                }
            }

            const location = prompt('Add location (city/state):', '');
            if (location) {
                query += ` ${location}`;
            }

            this.currentQuery = query;

            const execute = confirm(`Final query: ${query}\n\nExecute search now?`);
            if (execute) {
                this.executeSearch();
            } else {
                this.showMainMenu();
            }
        }

        showCustomBuilder() {
            if (this.isCollapsed) return;

            const content = `
                <div>
                    <div style="margin-bottom: 10px;">
                        <button class="back-btn" data-action="main" style="background: ${COLORS.blue}; border: none; color: white; padding: 2px 8px; border-radius: 3px; font-size: ${this.isMobile ? '10px' : '12px'};">← Back</button>
                        <strong style="color: ${COLORS.green}; font-size: ${this.isMobile ? '12px' : '14px'};">Custom Dork Builder</strong>
                    </div>
                    <div style="margin-bottom: 10px; color: ${COLORS.cyan}; font-size: ${this.isMobile ? '10px' : '12px'};">Current: ${this.currentQuery || '(empty)'}</div>
                    <textarea id="custom-query" style="width: 100%; height: ${this.isMobile ? '60px' : '60px'}; margin-bottom: 10px; background: #333; color: white; border: 1px solid #555; font-size: ${this.isMobile ? '11px' : '12px'};" placeholder="Build your custom dork query here...">${this.currentQuery}</textarea>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                        <button class="builder-btn" data-action="update" style="font-size: ${this.isMobile ? '10px' : '12px'};">Update</button>
                        <button class="builder-btn" data-action="execute" style="background: ${COLORS.red}; font-size: ${this.isMobile ? '10px' : '12px'};">Execute</button>
                        <button class="builder-btn" data-action="clear" style="background: ${COLORS.red}; font-size: ${this.isMobile ? '10px' : '12px'};">Clear</button>
                    </div>
                </div>
            `;

            this.setContent(content);

            this.bindSingleEvent('.back-btn', 'click', () => this.showMainMenu());

            const builderButtons = document.querySelectorAll('.builder-btn');
            builderButtons.forEach(button => {
                this.bindSingleEvent(button, 'click', (e) => {
                    const action = e.target.getAttribute('data-action');
                    const textarea = document.getElementById('custom-query');

                    if (action === 'update') {
                        this.currentQuery = textarea.value;
                        this.showMainMenu();
                    } else if (action === 'execute') {
                        this.currentQuery = textarea.value;
                        this.executeSearch();
                    } else if (action === 'clear') {
                        this.currentQuery = '';
                        textarea.value = '';
                    }
                });
            });
        }

		showManageProfiles() {
			if (this.isCollapsed) return;

			this.customProfiles = this.loadCustomProfiles();
			const customProfileKeys = Object.keys(this.customProfiles);

			let content = `
				<div>
					<div style="margin-bottom: 10px;">
						<button class="back-btn" data-action="main" style="background: ${COLORS.blue}; border: none; color: white; padding: 2px 8px; border-radius: 3px; font-size: ${this.isMobile ? '10px' : '12px'};">← Back</button>
						<strong style="color: ${COLORS.green}; font-size: ${this.isMobile ? '12px' : '14px'};">Manage Profiles</strong>
					</div>
					<div style="margin-bottom: 10px; color: ${COLORS.yellow}; font-size: ${this.isMobile ? '10px' : '12px'};">Custom profiles: ${customProfileKeys.length}</div>
					<div class="manage-profiles-content" style="max-height: ${this.isMobile ? '40vh' : '300px'}; overflow-y: auto;">
			`;

            if (customProfileKeys.length === 0) {
                content += `<div style="padding: 20px; text-align: center; color: ${COLORS.yellow}">No custom profiles found.</div>`;
            } else {
                customProfileKeys.forEach((profileName, index) => {
                    content += `
                        <div class="manage-profile-item" style="padding: 6px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; font-size: ${this.isMobile ? '10px' : '12px'};">
                            <div style="flex: 1;">
                                <strong style="color: ${COLORS.blue}">${profileName}</strong><br>
                                <small style="color: ${COLORS.cyan}">${this.customProfiles[profileName]}</small>
                            </div>
                            <button class="delete-profile-btn" data-profile="${profileName}" style="background: ${COLORS.red}; border: none; color: white; border-radius: 3px; padding: 2px 6px; margin-left: 5px; font-size: ${this.isMobile ? '9px' : '11px'};">Delete</button>
                        </div>
                    `;
                });

                content += `
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 5px;">
                        <button class="dork-btn" data-action="deleteAll" style="background: ${COLORS.red}; flex: 1; font-size: ${this.isMobile ? '10px' : '12px'};">Delete All</button>
                    </div>
                `;
            }

            content += `</div>`;
            this.setContent(content);

            this.bindSingleEvent('.back-btn', 'click', () => this.showMainMenu());

            const deleteButtons = document.querySelectorAll('.delete-profile-btn');
            deleteButtons.forEach(button => {
                this.bindSingleEvent(button, 'click', (e) => {
                    const profileName = e.target.getAttribute('data-profile');
                    this.deleteProfile(profileName);
                });
            });

            this.bindSingleEvent('[data-action="deleteAll"]', 'click', () => {
                this.deleteAllProfiles();
            });
        }

        deleteProfile(profileName) {
            const confirmDelete = confirm(`Delete profile "${profileName}"?\n\nQuery: ${this.customProfiles[profileName]}`);
            if (confirmDelete) {
                delete this.customProfiles[profileName];
                this.saveCustomProfiles();
                alert(`Profile "${profileName}" deleted.`);
                this.showManageProfiles();
            }
        }

        deleteAllProfiles() {
            const customCount = Object.keys(this.customProfiles).length;
            if (customCount === 0) {
                alert('No custom profiles to delete.');
                return;
            }

            const confirmDelete = confirm(`Delete ALL ${customCount} custom profiles?`);
            if (confirmDelete) {
                this.customProfiles = {};
                this.saveCustomProfiles();
                alert(`All ${customCount} custom profiles deleted.`);
                this.showManageProfiles();
            }
        }

        bindSingleEvent(selectorOrElement, event, handler) {
            const element = typeof selectorOrElement === 'string'
                ? document.querySelector(selectorOrElement)
                : selectorOrElement;

            if (element) {
                element.removeEventListener(event, handler);
                element.addEventListener(event, handler);
            }
        }

        saveCurrentQuery() {
            if (!this.currentQuery) {
                alert('No current query to save!');
                return;
            }

            const profileName = prompt('Enter profile name:');
            if (!profileName) return;

            this.customProfiles[profileName] = this.currentQuery;
            this.saveCustomProfiles();

            const exportNow = confirm(`Profile "${profileName}" saved!\n\nExport all profiles to JSON?`);
            if (exportNow) {
                this.exportProfilesToJSON();
            }

            this.showMainMenu();
        }

        loadProfile() {
            this.customProfiles = this.loadCustomProfiles();
            const customCount = Object.keys(this.customProfiles).length;
            alert(`Profiles reloaded! Found ${customCount} custom profiles.`);
            this.showMainMenu();
        }

        exportProfilesToJSON() {
            const allProfiles = {
                builtIn: PROFILES,
                custom: this.customProfiles,
                exportDate: new Date().toISOString(),
                version: '1.8'
            };

            const jsonData = JSON.stringify(allProfiles, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `google_dork_profiles_${timestamp}.json`;

            if (typeof GM_download !== 'undefined') {
                GM_download({
                    url: url,
                    name: filename,
                    saveAs: true
                });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            alert(`Profiles exported to ${filename}`);
        }

        importProfilesFromJSON() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const importedData = JSON.parse(event.target.result);

                        if (importedData.custom) {
                            this.customProfiles = importedData.custom;
                            this.saveCustomProfiles();

                            const count = Object.keys(importedData.custom).length;
                            alert(`Imported ${count} custom profiles!`);

                            this.showProfileMenu();
                        } else {
                            alert('No custom profiles found in the file.');
                        }
                    } catch (error) {
                        alert('Error: Invalid JSON file format.');
                    }
                };
                reader.readAsText(file);
            };

            input.click();
        }

		executeSearch() {
			if (!this.currentQuery) {
				alert('No query to execute!');
				return;
			}

			// Normalize query: wrap contiguous non-operator multi-word chunks in quotes
			function normalizeQueryBeforeExecute(q) {
				const tokens = q.match(/\S+/g) || [];
				const out = [];

				// helper to detect operator-like tokens that should NOT be auto-quoted
				function isOperatorToken(tok) {
					if (!tok) return false;
					// Already quoted or contains a quote -> treat as literal (don't process)
					if (/^["'].*["']$/.test(tok) || /^["']/.test(tok) || /["']$/.test(tok)) return true;
					// tokens that start with - (exclusion), tokens with colon (site:, filetype: etc),
					// boolean operators, AROUND(...), numeric ranges, or pure punctuation
					if (/^[-]/.test(tok)) return true;
					if (/:/.test(tok)) return true;
					if (/^(OR|AND)$/i.test(tok)) return true;
					if (/^AROUND\(/i.test(tok)) return true;
					if (/^\.\./.test(tok)) return true;
					// file extensions like filetype:pdf are covered by colon test
					return false;
				}

				for (let i = 0; i < tokens.length; i++) {
					const tok = tokens[i];

					// If token already contains quotes anywhere, append as-is
					if (tok.indexOf('"') !== -1 || tok.indexOf("'") !== -1) {
						out.push(tok);
						continue;
					}

					if (isOperatorToken(tok)) {
						out.push(tok);
						continue;
					}

					// Collect a run of non-operator tokens
					let j = i;
					const run = [];
					while (j < tokens.length && !isOperatorToken(tokens[j])) {
						run.push(tokens[j]);
						j++;
					}

					if (run.length > 1) {
						// wrap multi-word run in quotes
						out.push(`"${run.join(' ')}"`);
					} else {
						out.push(run[0]);
					}

					i = j - 1; // advance outer loop
				}

				return out.join(' ');
			}

			const finalQuery = normalizeQueryBeforeExecute(this.currentQuery);

			// Try to put the (normalized) query into the page's search box if present
			const searchInput = document.querySelector('input[name="q"], textarea[name="q"]');
			if (searchInput) {
				// set visible input to normalized query (so user sees quotes)
				searchInput.value = finalQuery;

				// attempt to trigger the site's submit button if present
				const searchBtn = document.querySelector('input[type="submit"], button[type="submit"]');
				if (searchBtn) {
					// encode and set location as fallback, but clicking the button will submit the form naturally
					try {
						searchBtn.click();
					} catch (e) {
						// fallback to submitting the form if click fails
						const form = searchInput.closest('form');
						if (form) form.submit();
						else {
							const encodedQuery = encodeURIComponent(finalQuery);
							window.location.href = `https://www.google.com/search?q=${encodedQuery}`;
						}
					}
				} else {
					const form = searchInput.closest('form');
					if (form) form.submit();
					else {
						const encodedQuery = encodeURIComponent(finalQuery);
						window.location.href = `https://www.google.com/search?q=${encodedQuery}`;
					}
				}
			} else {
				// No search input found — go directly to Google with properly encoded query
				const encodedQuery = encodeURIComponent(finalQuery);
				window.location.href = `https://www.google.com/search?q=${encodedQuery}`;
			}

			const toolbar = document.getElementById('dork-toolbar');
			if (toolbar) toolbar.style.display = 'none';
		}
    }

    // Initialize the tool when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new GoogleDorkingTool();
        });
    } else {
        new GoogleDorkingTool();
    }

})();
