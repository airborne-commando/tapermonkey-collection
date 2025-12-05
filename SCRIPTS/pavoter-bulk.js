// ==UserScript==
// @name         PA Voter Registration Bulk Checker
// @namespace    http://tampermonkey.net/
// @updateURL    https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/pavoter-bulk.js
// @downloadURL  https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/pavoter-bulk.js
// @version      1.8.2
// @description  Bulk check voter registration status in PA with complete ZIP code mapping, added direct input option
// @author       airborne-commando
// @match        https://www.pavoterservices.pa.gov/*/voterregistrationstatus.aspx
// @require      https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/pa-zip-mapping.js
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_cookie
// @grant        GM_xmlhttpRequest
// @license      GPL 3.0
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        delayBetweenSearches: { min: 3000, max: 7000 },
        humanTypingDelay: { min: 50, max: 200 },
        maxRetries: 3,
        cookieClearThreshold: 5
    };

    const cookieNames = [
        'ASP.NET_SessionId',
        'incap_ses_1352_3002372',
        'nlbi_3002372_2147483392',
        'nlbi_3002372',
        'reese84',
        'visid_incap_3002372'
    ];
    const cookieUrl = 'https://www.pavoterservices.pa.gov/*/voterregistrationstatus.aspx';

    class VoterChecker {
        constructor() {
            this.isRunning = false;
            this.currentIndex = 0;
            this.inputData = [];
            this.results = [];
            this.zipMapping = {};
            this.isMobile = this.detectMobile();

            // Bind methods to maintain 'this' context
            this.showTab = this.showTab.bind(this);
            this.toggleMobileUI = this.toggleMobileUI.bind(this);
            this.start = this.start.bind(this);
            this.pause = this.pause.bind(this);
            this.stop = this.stop.bind(this);
            this.downloadResults = this.downloadResults.bind(this);
            this.handleFileUpload = this.handleFileUpload.bind(this);
            this.handleDirectInput = this.handleDirectInput.bind(this);

            this.init();
        }

        detectMobile() {
            return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        async init() {
            await this.waitForPageLoad();
            this.createUI();
            this.loadZipMapping();
        }

        async waitForPageLoad() {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });
        }

        clearCookiesAfterAttempts() {
            // Check if we've reached the attempt threshold
            const attemptsMade = this.inputData.reduce((total, record) => total + record.attempts, 0);

            if (attemptsMade > 0 && attemptsMade % CONFIG.cookieClearThreshold === 0) {
                this.log(`Clearing cookies after ${attemptsMade} attempts...`);

                // Iterate over the array and delete each cookie
                cookieNames.forEach(name => {
                    GM_cookie.delete({
                        url: cookieUrl,
                        name: name
                    }, (error) => {
                        if (error) {
                            this.log(`Error deleting cookie "${name}": ${error}`);
                        } else {
                            this.log(`Cookie "${name}" deleted successfully`);
                        }
                    });
                });

                // Add a delay after clearing cookies to ensure they're cleared
                return this.delay(2000);
            }
            return Promise.resolve();
        }

        createUI() {
            // Remove existing UI if present
            const existingUI = document.getElementById('bulk-checker-ui');
            if (existingUI) {
                existingUI.remove();
            }

            // Create main container with responsive styling
            const container = document.createElement('div');
            container.id = 'bulk-checker-ui';

            if (this.isMobile) {
                container.style.cssText = `
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    right: 10px;
                    background: white;
                    border: 2px solid #333;
                    border-radius: 8px;
                    padding: 15px;
                    z-index: 10000;
                    font-family: Arial, sans-serif;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    max-height: 70vh;
                    overflow-y: auto;
                    font-size: 14px;
                `;
            } else {
                container.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 420px;
                    background: white;
                    border: 2px solid #333;
                    border-radius: 8px;
                    padding: 15px;
                    z-index: 10000;
                    font-family: Arial, sans-serif;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    max-height: 80vh;
                    overflow-y: auto;
                `;
            }

            // Header
            const header = document.createElement('h3');
            header.textContent = `PA Voter Bulk Checker v1.8.2 ${this.isMobile ? '(Mobile)' : '(Desktop)'}`;
            header.style.cssText = 'margin-top: 0; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; font-size: ' + (this.isMobile ? '16px' : '18px') + ';';

            // Input Method Tabs
            const tabs = document.createElement('div');
            tabs.style.cssText = 'margin-bottom: 15px; display: flex; border-bottom: 1px solid #ddd;';

            const fileTab = document.createElement('button');
            fileTab.textContent = 'File Upload';
            fileTab.style.cssText = 'flex: 1; padding: 8px; border: none; background: #3498db; color: white; cursor: pointer;';
            fileTab.addEventListener('click', () => this.showTab('file'));

            const directTab = document.createElement('button');
            directTab.textContent = 'Direct Input';
            directTab.style.cssText = 'flex: 1; padding: 8px; border: none; background: #95a5a6; color: white; cursor: pointer;';
            directTab.addEventListener('click', () => this.showTab('direct'));

            tabs.appendChild(fileTab);
            tabs.appendChild(directTab);

            // File Upload Section
            const fileSection = document.createElement('div');
            fileSection.id = 'file-section';
            fileSection.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: ${this.isMobile ? '14px' : '16px'};">Upload CSV/TXT File:</label>
                <input type="file" id="voterFile" accept=".csv,.txt" style="margin-bottom: 10px; width: 100%; font-size: ${this.isMobile ? '14px' : '16px'};">
                <small style="color: #666; font-size: ${this.isMobile ? '12px' : '14px'};">Format: ZIP,FirstName,LastName,DOB (MM/DD/YYYY)</small>
            `;

            // Direct Input Section (initially hidden)
            const directSection = document.createElement('div');
            directSection.id = 'direct-section';
            directSection.style.display = 'none';
            directSection.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: ${this.isMobile ? '14px' : '16px'};">Direct Input:</label>
                <textarea id="directInput" rows="5" placeholder="Enter one voter per line&#10;Format: ZIP,FirstName,LastName,DOB&#10;Example: 19001,John,Smith,01/15/1985&#10;19002,Jane,Doe,02/28/1990" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: ${this.isMobile ? '14px' : '14px'}; margin-bottom: 10px;"></textarea>
                <button id="loadDirectBtn" style="background: #9b59b6; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 10px; font-size: ${this.isMobile ? '14px' : '14px'};">Load Direct Input</button>
                <small style="color: #666; font-size: ${this.isMobile ? '12px' : '14px'};">Separate entries with new lines. DOB can be MM/DD/YYYY or month names (Jan, January, etc.)</small>
            `;

            // ZIP Mapping Status
            const zipStatus = document.createElement('div');
            zipStatus.id = 'zipMappingStatus';
            zipStatus.style.cssText = `margin-top: 10px; font-size: ${this.isMobile ? '11px' : '12px'}; color: #f39c12;`;
            zipStatus.textContent = 'Loading ZIP code mapping...';

            // Controls
            const controls = document.createElement('div');
            controls.style.cssText = this.isMobile ?
                'margin: 15px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;' :
                'margin: 15px 0; display: flex; justify-content: space-between;';

            controls.innerHTML = this.isMobile ?
                `
                    <button id="startBtn" style="background: #27ae60; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; grid-column: 1 / -1;">Start</button>
                    <button id="pauseBtn" style="background: #f39c12; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Pause</button>
                    <button id="stopBtn" style="background: #e74c3c; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Stop</button>
                ` :
                `
                    <button id="startBtn" style="background: #27ae60; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1; margin-right: 5px;">Start</button>
                    <button id="pauseBtn" style="background: #f39c12; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1; margin-right: 5px;">Pause</button>
                    <button id="stopBtn" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Stop</button>
                `;

            // Progress
            const progress = document.createElement('div');
            progress.id = 'progressInfo';
            progress.style.cssText = `margin: 10px 0; font-size: ${this.isMobile ? '13px' : '14px'};`;
            progress.innerHTML = '<div>Status: Ready</div><div>Progress: 0/0</div>';

            // Log
            const log = document.createElement('div');
            log.id = 'checkerLog';
            log.style.cssText = `border: 1px solid #ddd; padding: 10px; height: ${this.isMobile ? '120px' : '150px'}; overflow-y: auto; font-size: ${this.isMobile ? '11px' : '12px'}; background: #f9f9f9; border-radius: 4px; margin-bottom: 10px;`;
            log.innerHTML = '<div>Log will appear here...</div>';

            // Download button
            const downloadBtn = document.createElement('button');
            downloadBtn.id = 'downloadBtn';
            downloadBtn.textContent = 'Download Results';
            downloadBtn.style.cssText = `background: #3498db; color: white; border: none; padding: ${this.isMobile ? '12px 8px' : '10px 15px'}; border-radius: ${this.isMobile ? '6px' : '4px'}; cursor: pointer; width: 100%; font-size: ${this.isMobile ? '14px' : '16px'};`;

            // Mobile toggle button
            let mobileToggle = null;
            if (this.isMobile) {
                mobileToggle = document.createElement('button');
                mobileToggle.textContent = '☰';
                mobileToggle.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #2c3e50;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    font-size: 18px;
                    z-index: 10001;
                    cursor: pointer;
                `;
                mobileToggle.addEventListener('click', this.toggleMobileUI);
                document.body.appendChild(mobileToggle);
            }

            // Assemble UI
            container.appendChild(header);
            container.appendChild(tabs);
            container.appendChild(fileSection);
            container.appendChild(directSection);
            container.appendChild(zipStatus);
            container.appendChild(controls);
            container.appendChild(progress);
            container.appendChild(log);
            container.appendChild(downloadBtn);

            document.body.appendChild(container);

            // Store references for tab switching
            this.fileTab = fileTab;
            this.directTab = directTab;
            this.mobileToggle = mobileToggle;

            // Event listeners using addEventListener instead of onclick
            document.getElementById('startBtn').addEventListener('click', this.start);
            document.getElementById('pauseBtn').addEventListener('click', this.pause);
            document.getElementById('stopBtn').addEventListener('click', this.stop);
            document.getElementById('downloadBtn').addEventListener('click', this.downloadResults);
            document.getElementById('voterFile').addEventListener('change', this.handleFileUpload);
            document.getElementById('loadDirectBtn').addEventListener('click', this.handleDirectInput);

            this.log('UI initialized successfully - ' + (this.isMobile ? 'Mobile' : 'Desktop') + ' mode');
        }

        showTab(tabName) {
            const fileSection = document.getElementById('file-section');
            const directSection = document.getElementById('direct-section');

            if (tabName === 'file') {
                fileSection.style.display = 'block';
                directSection.style.display = 'none';
                this.fileTab.style.background = '#3498db';
                this.directTab.style.background = '#95a5a6';
            } else {
                fileSection.style.display = 'none';
                directSection.style.display = 'block';
                this.fileTab.style.background = '#95a5a6';
                this.directTab.style.background = '#9b59b6';
            }
        }

        toggleMobileUI() {
            const container = document.getElementById('bulk-checker-ui');
            if (container.style.display === 'none') {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }

        log(message) {
            const logElement = document.getElementById('checkerLog');
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.textContent = `[${timestamp}] ${message}`;
            logElement.appendChild(logEntry);
            logElement.scrollTop = logElement.scrollHeight;
            console.log(`[VoterChecker] ${message}`);
        }

        loadZipMapping() {
            // Check if ZIP mapping functions are available from external script
            if (typeof window.getZipMapping === 'function') {
                this.zipMapping = window.getZipMapping();
                const statusElement = document.getElementById('zipMappingStatus');
                if (statusElement) {
                    statusElement.textContent = `✓ ZIP code mapping loaded: ${Object.keys(this.zipMapping).length} counties`;
                    statusElement.style.color = '#27ae60';
                }
                this.log(`Loaded ${Object.keys(this.zipMapping).length} ZIP codes from external mapping`);
            } else {
                this.log('Warning: ZIP mapping functions not found. Using empty mapping.');
                this.zipMapping = {};
                const statusElement = document.getElementById('zipMappingStatus');
                if (statusElement) {
                    statusElement.textContent = '✗ ZIP mapping not available';
                    statusElement.style.color = '#e74c3c';
                }
            }
        }

        getCountyFromZip(zip) {
            // First try the external mapping
            if (typeof window.getCountyFromZip === 'function') {
                const county = window.getCountyFromZip(zip);
                if (county) return county;
            }

            // Fallback to internal mapping
            const county = this.zipMapping[zip];
            if (!county) {
                this.log(`Warning: No county found for ZIP code ${zip}, using ERIE as default`);
                return 'ERIE';
            }
            return county;
        }

        updateProgress() {
            const progressElement = document.getElementById('progressInfo');
            if (this.inputData.length > 0 && this.currentIndex < this.inputData.length) {
                const currentRecord = this.inputData[this.currentIndex];
                const lineInfo = currentRecord.originalLine ? ` (Line ${currentRecord.originalLine})` : '';
                const dateInfo = currentRecord.isGeneratedDate ? ` [Date variation]` : '';

                progressElement.innerHTML = `
                    <div>Status: ${this.isRunning ? 'Running' : 'Paused'}</div>
                    <div>Progress: ${this.currentIndex + 1}/${this.inputData.length}</div>
                    <div>Current: ${currentRecord.firstName} ${currentRecord.lastName}${lineInfo}${dateInfo}</div>
                `;
            } else {
                progressElement.innerHTML = `
                    <div>Status: ${this.isRunning ? 'Running' : 'Ready'}</div>
                    <div>Progress: ${this.currentIndex}/${this.inputData.length}</div>
                `;
            }
        }

        async handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.log(`Loading file: ${file.name}`);

            try {
                const text = await this.readFile(file);
                this.parseInputData(text, 'file');
            } catch (error) {
                this.log(`Error reading file: ${error}`);
            }
        }

        async handleDirectInput() {
            const inputText = document.getElementById('directInput').value.trim();
            if (!inputText) {
                this.log('Please enter voter data in the direct input field');
                return;
            }

            this.log('Processing direct input data...');
            this.parseInputData(inputText, 'direct');
        }

        readFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        }

        // Update the parseInputData method to handle month names
        parseInputData(text, source) {
            try {
                const lines = text.split('\n').filter(line => line.trim());
                this.inputData = [];
                let validCount = 0;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('zip') || line.startsWith('ZIP')) continue;

                    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
                    if (parts.length === 4) {
                        const [zip, firstName, lastName, dob] = parts.map(part => part.trim());

                        // Convert month names to numbers if needed
                        const normalizedDob = this.normalizeDate(dob);

                        if (!normalizedDob) {
                            this.log(`Skipping invalid date format on line ${i + 1}: ${dob} for ${firstName} ${lastName}`);
                            continue;
                        }

                        // Handle dates with "00" as day - generate all days for that month
                        if (normalizedDob.includes('/00/')) {
                            const [month, , year] = normalizedDob.split('/').map(Number);
                            const daysInMonth = this.getDaysInMonth(month, year);

                            for (let day = 1; day <= daysInMonth; day++) {
                                const formattedDay = day.toString().padStart(2, '0');
                                const newDob = `${month.toString().padStart(2, '0')}/${formattedDay}/${year}`;

                                const county = this.getCountyFromZip(zip);
                                this.inputData.push({
                                    zip,
                                    county,
                                    firstName,
                                    lastName,
                                    dob: newDob,
                                    attempts: 0,
                                    success: false,
                                    originalLine: i + 1,
                                    isGeneratedDate: true,
                                    source: source
                                });
                                validCount++;
                            }
                            this.log(`Generated ${daysInMonth} date variations for line ${i + 1}: ${firstName} ${lastName} (month ${month})`);
                        }
                        // Handle normal dates
                        else if (this.isValidDate(normalizedDob)) {
                            const county = this.getCountyFromZip(zip);
                            this.inputData.push({
                                zip,
                                county,
                                firstName,
                                lastName,
                                dob: normalizedDob,
                                attempts: 0,
                                success: false,
                                originalLine: i + 1,
                                isGeneratedDate: false,
                                source: source
                            });
                            validCount++;
                            this.log(`Loaded record from line ${i + 1}: ${firstName} ${lastName} (${normalizedDob})`);
                        } else {
                            this.log(`Skipping invalid date on line ${i + 1}: ${dob} for ${firstName} ${lastName}`);
                        }
                    } else {
                        this.log(`Skipping malformed line ${i + 1}: ${line}`);
                    }
                }

                this.log(`Loaded ${validCount} total records from ${lines.length} ${source} lines`);
                this.updateProgress();
            } catch (error) {
                this.log(`Error parsing ${source} data: ${error}`);
            }
        }

        // Add this method to normalize dates with month names
        normalizeDate(dateString) {
            const monthMap = {
                'january': '01', 'jan': '01',
                'february': '02', 'feb': '02',
                'march': '03', 'mar': '03',
                'april': '04', 'apr': '04',
                'may': '05',
                'june': '06', 'jun': '06',
                'july': '07', 'jul': '07',
                'august': '08', 'aug': '08',
                'september': '09', 'sep': '09',
                'october': '10', 'oct': '10',
                'november': '11', 'nov': '11',
                'december': '12', 'dec': '12'
            };

            // Check if it's already in mm/dd/yyyy format
            const numericPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
            if (numericPattern.test(dateString)) {
                return dateString;
            }

            // Try to parse month names
            const parts = dateString.split('/');
            if (parts.length === 3) {
                let [month, day, year] = parts;

                // Convert month name to number
                if (isNaN(parseInt(month))) {
                    const monthLower = month.toLowerCase().trim();
                    if (monthMap[monthLower]) {
                        month = monthMap[monthLower];
                    } else {
                        return null; // Invalid month name
                    }
                }

                // Ensure proper formatting
                month = month.padStart(2, '0');
                day = day.padStart(2, '0');

                return `${month}/${day}/${year}`;
            }

            return null; // Invalid format
        }

        // Add helper method to get days in month
        getDaysInMonth(month, year) {
            return new Date(year, month, 0).getDate();
        }

        // Update isValidDate to use normalized dates
        isValidDate(dateString) {
            const normalizedDate = this.normalizeDate(dateString);
            if (!normalizedDate) return false;

            const pattern = /^\d{2}\/\d{2}\/\d{4}$/;
            if (!pattern.test(normalizedDate)) return false;

            const [month, day, year] = normalizedDate.split('/').map(Number);

            // Allow "00" as day (will be handled in parseInputData)
            if (day === 0) return true;

            if (month < 1 || month > 12) return false;
            if (day < 1 || day > 31) return false;
            if (year < 1900 || year > new Date().getFullYear()) return false;

            const date = new Date(year, month - 1, day);
            return date.getFullYear() === year &&
                   date.getMonth() === month - 1 &&
                   date.getDate() === day;
        }

        async start() {
            if (this.isRunning) {
                this.log('Already running');
                return;
            }

            if (this.inputData.length === 0) {
                this.log('Please upload a file or enter data first');
                return;
            }

            this.isRunning = true;
            this.log(`Starting bulk search for ${this.inputData.length} records...`);

            while (this.isRunning && this.currentIndex < this.inputData.length) {
                await this.processCurrentRecord();

                if (this.isRunning && this.currentIndex < this.inputData.length - 1) {
                    const delay = this.getRandomDelay(CONFIG.delayBetweenSearches.min, CONFIG.delayBetweenSearches.max);
                    this.log(`Waiting ${Math.round(delay/1000)}s before next search...`);
                    await this.delay(delay);
                }

                this.currentIndex++;
            }

            if (this.currentIndex >= this.inputData.length) {
                this.log('All records processed!');
                this.isRunning = false;
            }
        }

        pause() {
            this.isRunning = false;
            this.log('Processing paused');
        }

        stop() {
            this.isRunning = false;
            this.currentIndex = 0;
            this.log('Processing stopped and reset');

            // If we're stopping due to active voter found, log it prominently
            const activeVoterFound = this.results.some(result => result.isActive);
            if (activeVoterFound) {
                this.log('*** SCRIPT STOPPED: ACTIVE VOTER IDENTIFIED ***');
                this.log('*** Check the results for the active voter record ***');
            }
        }


        async processCurrentRecord() {
            const record = this.inputData[this.currentIndex];
            this.updateProgress();

            // Show original line number in log for better tracking
            const lineInfo = record.originalLine ? ` (from input line ${record.originalLine})` : '';
            const dateInfo = record.isGeneratedDate ? ` [date variation: ${record.dob}]` : '';

            this.log(`Processing: ${record.firstName} ${record.lastName} (${record.dob})${lineInfo}${dateInfo}`);

            try {
                // Clear cookies every 5 attempts
                await this.clearCookiesAfterAttempts();

                // Wait for page to be ready
                await this.waitForPageReady();

                // Use mobile-optimized form filling if on mobile
                if (this.isMobile) {
                    await this.fillFormMobile(record);
                } else {
                    await this.fillFormDesktop(record);
                }

                // Submit and wait for results
                await this.submitForm();

                // Capture results
                const result = await this.captureResults(record);

                // Store result
                this.results.push(result);
                record.success = true;
                record.attempts++;

                this.log(`✓ Success: ${record.firstName} ${record.lastName}${lineInfo}${dateInfo}`);

            } catch (error) {
                this.log(`✗ Error processing ${record.firstName} ${record.lastName}${lineInfo}${dateInfo}: ${error}`);
                record.success = false;
                record.attempts++;

                // Use mobile-optimized reset if on mobile
                if (this.isMobile) {
                    await this.resetFormMobile();
                } else {
                    await this.resetFormDesktop();
                }
            }
        }

        async waitForPageReady() {
            // Simple check for body element
            let attempts = 0;
            while (attempts < 30) {
                if (document.body) {
                    return;
                }
                await this.delay(100);
                attempts++;
            }
            throw new Error('Page not ready - body element not found');
        }

        // Desktop-optimized form filling
        async fillFormDesktop(record) {
            this.log('Filling form (Desktop)...');

            // Direct element access without excessive waiting
            await this.delay(1000);

            // Select "Search by Name" radio button
            const radioButton = document.getElementById('ctl00_ContentPlaceHolder1_rdoSearchByName');
            if (radioButton) {
                radioButton.click();
                await this.delay(500);
            }

            // Fill county dropdown
            const countySelect = document.getElementById('ctl00_ContentPlaceHolder1_CountyCombo');
            if (countySelect) {
                this.selectDropdownByText(countySelect, record.county);
                await this.delay(500);
            } else {
                this.log('Warning: County dropdown not found');
            }

            // Fill other fields with error handling
            await this.fillFieldWithFallback('ctl00_ContentPlaceHolder1_txtVRSzip', record.zip);
            await this.delay(400);
            await this.fillFieldWithFallback('ctl00_ContentPlaceHolder1_txtVRSOpt2Item2', record.firstName);
            await this.delay(400);
            await this.fillFieldWithFallback('ctl00_ContentPlaceHolder1_txtVRSOpt2Item3', record.lastName);
            await this.delay(400);
            await this.fillFieldWithFallback('ctl00_ContentPlaceHolder1_txtVRSOpt2Item4', record.dob);
            await this.delay(400);
        }

        // Mobile-optimized form filling
        async fillFormMobile(record) {
            this.log('Filling form (Mobile)...');

            // Longer delays for mobile stability
            await this.delay(1500);

            // Select "Search by Name" radio button
            const radioButton = document.getElementById('ctl00_ContentPlaceHolder1_rdoSearchByName');
            if (radioButton) {
                radioButton.click();
                await this.delay(800); // Longer delay for mobile
            }

            // Fill county dropdown - scroll into view for mobile
            const countySelect = document.getElementById('ctl00_ContentPlaceHolder1_CountyCombo');
            if (countySelect) {
                countySelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.delay(500);
                this.selectDropdownByText(countySelect, record.county);
                await this.delay(800);
            } else {
                this.log('Warning: County dropdown not found');
            }

            // Fill other fields with mobile-optimized delays and error handling
            await this.fillFieldWithFallbackMobile('ctl00_ContentPlaceHolder1_txtVRSzip', record.zip);
            await this.delay(600);
            await this.fillFieldWithFallbackMobile('ctl00_ContentPlaceHolder1_txtVRSOpt2Item2', record.firstName);
            await this.delay(600);
            await this.fillFieldWithFallbackMobile('ctl00_ContentPlaceHolder1_txtVRSOpt2Item3', record.lastName);
            await this.delay(600);
            await this.fillFieldWithFallbackMobile('ctl00_ContentPlaceHolder1_txtVRSOpt2Item4', record.dob);
            await this.delay(600);
        }

        // Add these new methods for field filling with fallback
        async fillFieldWithFallback(fieldId, value) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
                field.focus();
                await this.delay(100);
                field.value = value;
                await this.delay(100);
                field.blur();
            } else {
                this.log(`Warning: Field ${fieldId} not found, attempting to continue...`);
                // Don't throw error, just log and continue
            }
        }

        async fillFieldWithFallbackMobile(fieldId, value) {
            const field = document.getElementById(fieldId);
            if (field) {
                // Scroll field into view on mobile
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.delay(300);

                field.value = '';
                field.focus();
                await this.delay(200); // Longer delay for mobile
                field.value = value;
                await this.delay(200); // Longer delay for mobile
                field.blur();
            } else {
                this.log(`Warning: Field ${fieldId} not found, attempting to continue...`);
                // Don't throw error, just log and continue
            }
        }

        selectDropdownByText(selectElement, text) {
            for (let i = 0; i < selectElement.options.length; i++) {
                if (selectElement.options[i].text.toUpperCase() === text.toUpperCase()) {
                    selectElement.selectedIndex = i;
                    return true;
                }
            }
            return false;
        }

        async submitForm() {
            this.log('Submitting form...');
            const submitButton = document.getElementById('ctl00_ContentPlaceHolder1_btnContinue');
            if (submitButton) {
                // Scroll into view on mobile
                if (this.isMobile) {
                    submitButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.delay(500);
                }
                submitButton.click();
                await this.waitForResults();
            } else {
                throw new Error('Submit button not found');
            }
        }

        async waitForResults() {
            this.log('Waiting for results...');
            let attempts = 0;
            const maxAttempts = this.isMobile ? 40 : 30; // More attempts on mobile

            while (attempts < maxAttempts) {
                await this.delay(this.isMobile ? 1500 : 1000); // Longer delays on mobile

                // Check for any changes that indicate results are loaded
                const resultsPanel = document.getElementById('ctl00_ContentPlaceHolder1_UpdatePanel1');
                const notFoundMsg = document.getElementById('ctl00_ContentPlaceHolder1_lblNotFound');
                const errorPanel = document.getElementById('ctl00_ContentPlaceHolder1_ValidationSummary1');

                if (resultsPanel && resultsPanel.textContent && resultsPanel.textContent.trim() !== '') {
                    this.log('Results loaded successfully');
                    return true;
                }

                if (notFoundMsg && notFoundMsg.textContent.includes('not return any results')) {
                    this.log('No results found for this search');
                    return true;
                }

                if (errorPanel && errorPanel.style.display !== 'none') {
                    throw new Error('Form validation error');
                }

                attempts++;
            }

            throw new Error('Timeout waiting for results');
        }

        async captureResults(record) {
            const notFoundMsg = document.getElementById('ctl00_ContentPlaceHolder1_lblNotFound');

            let status = 'No results found';
            let isActiveVoter = false;

            if (notFoundMsg && notFoundMsg.textContent.includes('not return any results')) {
                status = 'Voter registration not found';
            } else {
                // Look for the voter information section
                const voterInfo = this.extractVoterInformation();
                if (voterInfo) {
                    status = voterInfo;

                    // Check if this is an ACTIVE voter
                    if (voterInfo.includes('VOTER RECORD DETAILS') && voterInfo.includes('Status:') && voterInfo.includes('ACTIVE')) {
                        isActiveVoter = true;
                        this.log('*** ACTIVE VOTER FOUND - STOPPING SCRIPT ***');
                        this.stop(); // Stop the script
                    }
                } else {
                    status = 'Voter information not found on page';
                }
            }

            return {
                ...record,
                // result: resultText,
                status: status,
                isActive: isActiveVoter
                // timestamp: new Date().toISOString()
            };
        }

        extractVoterInformation() {
            // Try to find the main voter information container
            const containers = [
                document.getElementById('ctl00_ContentPlaceHolder1_UpdatePanel1'),
                document.querySelector('.voter-info'),
                document.querySelector('[class*="voter"]'),
                document.querySelector('main'),
                document.querySelector('#main')
            ];

            let voterContainer = null;
            for (const container of containers) {
                if (container && container.textContent && container.textContent.includes('YOUR RESIDENTIAL ADDRESS')) {
                    voterContainer = container;
                    break;
                }
            }

            if (!voterContainer) {
                // Fallback: search for voter info anywhere on page
                const allElements = document.querySelectorAll('*');
                for (const element of allElements) {
                    if (element.textContent && element.textContent.includes('YOUR RESIDENTIAL ADDRESS')) {
                        voterContainer = element;
                        break;
                    }
                }
            }

            if (!voterContainer) {
                return null;
            }

            // Extract clean voter information
            return this.cleanVoterInfo(voterContainer.textContent);
        }

        cleanVoterInfo(rawText) {
            if (!rawText) return '';

            // Split into lines and filter out empty lines and navigation/header content
            const lines = rawText.split('\n')
            .map(line => line.trim())
            .filter(line => {
                // Remove empty lines and irrelevant content
                if (!line) return false;
                if (line.includes('FIND VOTER REGISTRATION STATUS')) return false;
                if (line.includes('You may search for your voter registration status')) return false;
                if (line.includes('Find your Voter Registration Status')) return false;
                if (line.includes('Select a County')) return false;
                if (line.includes('Enter Zip Code')) return false;
                if (line.includes('Enter First Name')) return false;
                if (line.includes('Enter Last Name')) return false;
                if (line.includes('Enter Date of Birth')) return false;
                if (line.includes('County is Required')) return false;
                if (line.includes('Zip code is required')) return false;
                if (line.includes('First name is required')) return false;
                if (line.includes('Last name is required')) return false;
                if (line.includes('Date of birth is required')) return false;
                if (line.includes('Please enter a valid')) return false;
                if (line.includes('We are unable to match your information')) return false;
                if (line.includes('Directions to Your Polling Place')) return false;
                if (line.includes('Please enter the starting address')) return false;
                if (line.includes('Please input address')) return false;
                if (line.includes('Please input city')) return false;

                // Exclude polling place accessibility content
                if (line.includes('Polling Place Accessibility')) return false;
                if (line.includes('Accessible Criteria')) return false;
                if (line === 'Address:') return false;
                if (line === 'City:') return false;

                // Exclude US states and territories list
                const statesAndTerritories = [
                    'Alabama', 'Alaska', 'American Samoa', 'Arizona', 'Arkansas',
                    'Armed Forces Africa, Armed Forces Canada, Armed Fo',
                    'Armed Forces America (except Canada)', 'Armed Forces Pacific',
                    'California', 'Colorado', 'Connecticut', 'Delaware', 'District Of Columbia',
                    'Federated States of Micronesia', 'Florida', 'Georgia', 'Guam', 'Hawaii',
                    'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
                    'Maine', 'Marshall Islands', 'Maryland', 'Massachusetts', 'Michigan',
                    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
                    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina',
                    'North Dakota', 'Northern Mariana Islands', 'Ohio', 'Oklahoma', 'Oregon',
                    'Palau', 'Pennsylvania', 'Puerto Rico', 'Rhode Island', 'South Carolina',
                    'South Dakota', 'Tennessee', 'Texas', 'US Virgin Islands', 'Utah', 'Vermont',
                    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
                ];

                if (statesAndTerritories.includes(line)) return false;

                return true;
            });

            // Reconstruct the clean voter information
            let cleanInfo = '';
            let inVoterSection = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Start capturing when we find residential address
                if (line.includes('YOUR RESIDENTIAL ADDRESS')) {
                    inVoterSection = true;
                    cleanInfo += 'YOUR RESIDENTIAL ADDRESS\n';
                    continue;
                }

                if (!inVoterSection) continue;

                // Stop if we hit directions section
                if (line.includes('Directions to') || line.includes('Get Directions')) {
                    break;
                }

                // Add the line if we're in the voter section
                cleanInfo += line + '\n';

                // Add spacing between sections
                if (line.includes('YOUR MAILING ADDRESS') ||
                    line.includes('VOTER RECORD DETAILS') ||
                    line.includes('VOTING DISTRICTS') ||
                    line.includes('COUNTY BOARD OF ELECTIONS') ||
                    line.includes('YOUR ELECTION DAY POLLING PLACE')) {
                    cleanInfo += '\n';
                }
            }

            // If we didn't find the residential address but have content, try a different approach
            if (!inVoterSection && lines.length > 0) {
                cleanInfo = this.extractStructuredInfo(lines);
            }

            return cleanInfo.trim();
        }

        extractStructuredInfo(lines) {
            let structuredInfo = '';
            let currentSection = '';

            for (const line of lines) {
                // Detect section headers
                if (line.includes('YOUR RESIDENTIAL ADDRESS')) {
                    currentSection = 'residential';
                    structuredInfo += 'YOUR RESIDENTIAL ADDRESS\n';
                } else if (line.includes('YOUR MAILING ADDRESS')) {
                    currentSection = 'mailing';
                    structuredInfo += '\nYOUR MAILING ADDRESS\n';
                } else if (line.includes('VOTER RECORD DETAILS')) {
                    currentSection = 'details';
                    structuredInfo += '\nVOTER RECORD DETAILS\n\n';
                } else if (line.includes('VOTING DISTRICTS')) {
                    currentSection = 'districts';
                    structuredInfo += '\nVOTING DISTRICTS\n\n';
                } else if (line.includes('COUNTY BOARD OF ELECTIONS')) {
                    currentSection = 'elections';
                    structuredInfo += '\nCOUNTY BOARD OF ELECTIONS\n\n';
                } else if (line.includes('YOUR ELECTION DAY POLLING PLACE')) {
                    currentSection = 'polling';
                    structuredInfo += '\nYOUR ELECTION DAY POLLING PLACE\n\n';
                } else if (line.trim()) {
                    // Add content to current section
                    if (currentSection && line.length > 2) {
                        structuredInfo += line + '\n';
                    }
                }
            }

            return structuredInfo;
        }

        // Desktop form reset
        async resetFormDesktop() {
            this.log('Resetting form (Desktop)...');

            try {
                // Clear all form fields
                await this.clearField('ctl00_ContentPlaceHolder1_txtVRSzip');
                await this.clearField('ctl00_ContentPlaceHolder1_txtVRSOpt2Item2');
                await this.clearField('ctl00_ContentPlaceHolder1_txtVRSOpt2Item3');
                await this.clearField('ctl00_ContentPlaceHolder1_txtVRSOpt2Item4');

                // Reset county dropdown if possible
                const countySelect = document.getElementById('ctl00_ContentPlaceHolder1_CountyCombo');
                if (countySelect && countySelect.options.length > 0) {
                    countySelect.selectedIndex = 0;
                }

                this.log('Form reset successfully');
            } catch (error) {
                this.log('Error resetting form: ' + error);
                // If clearing fields fails, try a soft reset by navigating back to the form
                try {
                    const backButton = document.getElementById('ctl00_ContentPlaceHolder1_btnBack');
                    if (backButton) {
                        backButton.click();
                        await this.delay(2000);
                        await this.waitForPageReady();
                    }
                } catch (e) {
                    this.log('Could not reset form properly, continuing anyway...');
                }
            }
        }

        // Mobile form reset
        async resetFormMobile() {
            this.log('Resetting form (Mobile)...');

            try {
                // Clear all form fields with mobile-optimized delays
                await this.clearFieldMobile('ctl00_ContentPlaceHolder1_txtVRSzip');
                await this.clearFieldMobile('ctl00_ContentPlaceHolder1_txtVRSOpt2Item2');
                await this.clearFieldMobile('ctl00_ContentPlaceHolder1_txtVRSOpt2Item3');
                await this.clearFieldMobile('ctl00_ContentPlaceHolder1_txtVRSOpt2Item4');

                // Reset county dropdown if possible
                const countySelect = document.getElementById('ctl00_ContentPlaceHolder1_CountyCombo');
                if (countySelect && countySelect.options.length > 0) {
                    countySelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.delay(300);
                    countySelect.selectedIndex = 0;
                }

                this.log('Form reset successfully');
            } catch (error) {
                this.log('Error resetting form: ' + error);
                // On mobile, try using back button first
                try {
                    const backButton = document.getElementById('ctl00_ContentPlaceHolder1_btnBack');
                    if (backButton) {
                        backButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await this.delay(500);
                        backButton.click();
                        await this.delay(3000); // Longer delay for mobile
                        await this.waitForPageReady();
                    }
                } catch (e) {
                    this.log('Could not reset form properly, continuing anyway...');
                }
            }
        }

        // Add helper method to clear fields
        async clearField(fieldId) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
                await this.delay(100);
            }
        }

        // Mobile-optimized field clearing
        async clearFieldMobile(fieldId) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.delay(300);
                field.value = '';
                await this.delay(200);
            }
        }

        getRandomDelay(min, max) {
            return Math.random() * (max - min) + min;
        }

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        downloadResults() {
            if (this.results.length === 0) {
                this.log('No results to download');
                return;
            }

            const csv = this.convertToCSV(this.results);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const filename = `voter_results_${new Date().toISOString().slice(0, 10)}.csv`;

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.log(`Downloaded ${this.results.length} results as ${filename}`);
        }

        convertToCSV(data) {
            if (data.length === 0) return '';

            // const headers = ['firstName', 'lastName', 'dob', 'zip', 'county', 'status', 'result', 'timestamp'];
            const headers = ['firstName', 'lastName', 'dob', 'zip', 'county', 'status'];
            const csvRows = [headers.join(',')];

            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    return `"${value.toString().replace(/"/g, '""')}"`;
                });
                csvRows.push(values.join(','));
            }

            return csvRows.join('\n');
        }
    }

    // Initialize when page loads
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => new VoterChecker(), 1000);
        });
    } else {
        setTimeout(() => new VoterChecker(), 1000);
    }

    // Clear cookies
    cookieNames.forEach(name => {
        GM_cookie.delete({
            url: cookieUrl,
            name: name
        }, function(error) {
            if (error) {
                console.error(`Error deleting cookie "${name}":`, error);
            } else {
                console.log(`Cookie "${name}" deleted successfully`);
            }
        });
    });

})();