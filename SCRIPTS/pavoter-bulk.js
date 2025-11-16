// ==UserScript==
// @name         PA Voter Registration Bulk Checker
// @namespace    http://tampermonkey.net/
// @updateURL    https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/pavoter-bulk.js
// @downloadURL  https://raw.githubusercontent.com/airborne-commando/tampermonkey-collection/refs/heads/main/SCRIPTS/pavoter-bulk.js
// @version      1.7
// @description  Bulk check voter registration status in PA with complete ZIP code mapping, added in more zips
// @author       airborne-commando
// @match        https://www.pavoterservices.pa.gov/*/voterregistrationstatus.aspx
// @grant        GM_download
// @license      GPL 3.0
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        delayBetweenSearches: { min: 3000, max: 7000 },
        humanTypingDelay: { min: 50, max: 200 },
        maxRetries: 3
    };

    class VoterChecker {
        constructor() {
            this.isRunning = false;
            this.currentIndex = 0;
            this.inputData = [];
            this.results = [];
            this.zipMapping = {};
            this.isMobile = this.detectMobile();
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
                // Mobile styling
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
                // Desktop styling
                container.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 400px;
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
            header.textContent = `PA Voter Bulk Checker v1.5 ${this.isMobile ? '(Mobile)' : '(Desktop)'}`;
            header.style.cssText = 'margin-top: 0; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; font-size: ' + (this.isMobile ? '16px' : '18px') + ';';

            // File input
            const fileSection = document.createElement('div');
            fileSection.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: ${this.isMobile ? '14px' : '16px'};">Input File (CSV/TXT):</label>
                <input type="file" id="voterFile" accept=".csv,.txt" style="margin-bottom: 10px; width: 100%; font-size: ${this.isMobile ? '14px' : '16px'};">
                <small style="color: #666; font-size: ${this.isMobile ? '12px' : '14px'};">Format: ZIP,FirstName,LastName,DOB (MM/DD/YYYY)</small>
                <div style="margin-top: 5px; font-size: ${this.isMobile ? '11px' : '12px'}; color: #f39c12;" id="zipMappingStatus">Loading ZIP code mapping...</div>
            `;

            // Controls - different layout for mobile
            const controls = document.createElement('div');
            controls.style.cssText = this.isMobile ?
                'margin: 15px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;' :
                'margin: 15px 0;';

            controls.innerHTML = this.isMobile ?
                // Mobile button layout
                `
                    <button id="startBtn" style="background: #27ae60; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; grid-column: 1 / -1;">Start</button>
                    <button id="pauseBtn" style="background: #f39c12; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Pause</button>
                    <button id="stopBtn" style="background: #e74c3c; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Stop</button>
                ` :
                // Desktop button layout
                `
                    <button id="startBtn" style="background: #27ae60; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; margin-right: 10px;">Start</button>
                    <button id="pauseBtn" style="background: #f39c12; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; margin-right: 10px;">Pause</button>
                    <button id="stopBtn" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer;">Stop</button>
                `;

            // Progress
            const progress = document.createElement('div');
            progress.id = 'progressInfo';
            progress.style.cssText = `margin: 10px 0; font-size: ${this.isMobile ? '13px' : '14px'};`;
            progress.innerHTML = '<div>Status: Ready</div><div>Progress: 0/0</div>';

            // Log
            const log = document.createElement('div');
            log.id = 'checkerLog';
            log.style.cssText = `border: 1px solid #ddd; padding: 10px; height: ${this.isMobile ? '120px' : '150px'}; overflow-y: auto; font-size: ${this.isMobile ? '11px' : '12px'}; background: #f9f9f9; border-radius: 4px;`;

            log.innerHTML = '<div>Log will appear here...</div>';

            // Download button
            const downloadBtn = document.createElement('button');
            downloadBtn.id = 'downloadBtn';
            downloadBtn.textContent = 'Download Results';
            downloadBtn.style.cssText = `background: #3498db; color: white; border: none; padding: ${this.isMobile ? '12px 8px' : '10px 15px'}; border-radius: ${this.isMobile ? '6px' : '4px'}; cursor: pointer; width: 100%; margin-top: 10px; font-size: ${this.isMobile ? '14px' : '16px'};`;

            // Mobile toggle button (for hiding/showing UI on mobile)
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
                mobileToggle.onclick = () => this.toggleMobileUI();
                document.body.appendChild(mobileToggle);
            }

            // Assemble UI
            container.appendChild(header);
            container.appendChild(fileSection);
            container.appendChild(controls);
            container.appendChild(progress);
            container.appendChild(log);
            container.appendChild(downloadBtn);

            document.body.appendChild(container);

            // Event listeners
            document.getElementById('startBtn').onclick = () => this.start();
            document.getElementById('pauseBtn').onclick = () => this.pause();
            document.getElementById('stopBtn').onclick = () => this.stop();
            document.getElementById('downloadBtn').onclick = () => this.downloadResults();
            document.getElementById('voterFile').addEventListener('change', (e) => this.handleFileUpload(e));

            // Store mobile toggle reference
            this.mobileToggle = mobileToggle;

            this.log('UI initialized successfully - ' + (this.isMobile ? 'Mobile' : 'Desktop') + ' mode');
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
    const mappingUrl = 'https://gist.githubusercontent.com/airborne-commando/62461ce8f8b79f9bf4a929df8afa324a/raw/59b67756c011f74f4eb83062d68efada959d7d0c/zipdatabase.txt'; // Replace with your URL
    
    GM_xmlhttpRequest({
        method: 'GET',
        url: mappingUrl,
        onload: (response) => {
            if (response.status === 200) {
                this.zipMapping = {};
                const lines = response.responseText.split('\n');
                
                lines.forEach(line => {
                    line = line.trim();
                    if (line && line.includes(":'")) {
                        // Parse lines like: 'AL':,'35004',
                        const match = line.match(/'([A-Z]{2})':,'(\d+)'/);
                        if (match) {
                            const state = match[1];
                            const zip = match[2];
                            
                            if (!this.zipMapping[state]) {
                                this.zipMapping[state] = [];
                            }
                            this.zipMapping[state].push(zip);
                        }
                    }
                });
                console.log('ZIP mapping loaded successfully');
            } else {
                console.error('Failed to load ZIP mapping:', response.status);
                this.zipMapping = {};
            }
        },
        onerror: (error) => {
            console.error('Error loading ZIP mapping:', error);
            this.zipMapping = {};
        }
    });
}

            const statusElement = document.getElementById('zipMappingStatus');
            if (statusElement) {
                statusElement.textContent = `✓ ZIP code mapping loaded: ${Object.keys(this.zipMapping).length} counties`;
                statusElement.style.color = '#27ae60';
            }
        }

        getCountyFromZip(zip) {
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
                progressElement.innerHTML = `
                    <div>Status: ${this.isRunning ? 'Running' : 'Paused'}</div>
                    <div>Progress: ${this.currentIndex + 1}/${this.inputData.length}</div>
                    <div>Current: ${currentRecord.firstName} ${currentRecord.lastName}</div>
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
                this.parseInputData(text);
            } catch (error) {
                this.log(`Error reading file: ${error}`);
            }
        }

        readFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        }

        parseInputData(text) {
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

                        // Handle dates with "00" as day - generate all days for that month
                        if (dob.includes('/00/')) {
                            const [month, , year] = dob.split('/').map(Number);
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
                                    success: false
                                });
                                validCount++;
                            }
                            this.log(`Generated ${daysInMonth} dates for ${firstName} ${lastName} (month ${month})`);
                        }
                        // Handle normal dates
                        else if (this.isValidDate(dob)) {
                            const county = this.getCountyFromZip(zip);
                            this.inputData.push({
                                zip,
                                county,
                                firstName,
                                lastName,
                                dob,
                                attempts: 0,
                                success: false
                            });
                            validCount++;
                        } else {
                            this.log(`Skipping invalid date: ${dob} for ${firstName} ${lastName}`);
                        }
                    }
                }

                this.log(`Loaded ${validCount} valid records from ${lines.length} lines`);
                this.updateProgress();
            } catch (error) {
                this.log(`Error parsing file: ${error}`);
            }
        }

        // Add helper method to get days in month
        getDaysInMonth(month, year) {
            return new Date(year, month, 0).getDate();
        }

        // Update isValidDate to handle "00" as day
        isValidDate(dateString) {
            const pattern = /^\d{2}\/\d{2}\/\d{4}$/;
            if (!pattern.test(dateString)) return false;

            const [month, day, year] = dateString.split('/').map(Number);

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
                this.log('Please upload a file first');
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

            this.log(`Processing: ${record.firstName} ${record.lastName} (${record.dob})`);

            try {
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

                this.log(`✓ Success: ${record.firstName} ${record.lastName}`);

            } catch (error) {
                this.log(`✗ Error processing ${record.firstName} ${record.lastName}: ${error}`);
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

            let resultText = 'No results found';
            let status = 'not_found';
            let isActiveVoter = false;

            if (notFoundMsg && notFoundMsg.textContent.includes('not return any results')) {
                resultText = 'Voter registration not found';
                status = 'not_found';
            } else {
                // Look for the voter information section
                const voterInfo = this.extractVoterInformation();
                if (voterInfo) {
                    resultText = voterInfo;
                    status = 'found';

                    // Check if this is an ACTIVE voter
                    if (voterInfo.includes('VOTER RECORD DETAILS') && voterInfo.includes('Status:') && voterInfo.includes('ACTIVE')) {
                        isActiveVoter = true;
                        this.log('*** ACTIVE VOTER FOUND - STOPPING SCRIPT ***');
                        this.stop(); // Stop the script
                    }
                } else {
                    resultText = 'Voter information not found on page';
                    status = 'not_found';
                }
            }

            return {
                ...record,
                result: resultText,
                status: status,
                isActive: isActiveVoter,
                timestamp: new Date().toISOString()
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

            const headers = ['firstName', 'lastName', 'dob', 'zip', 'county', 'status', 'result', 'timestamp'];
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
})();