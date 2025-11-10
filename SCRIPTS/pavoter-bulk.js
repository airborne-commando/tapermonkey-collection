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
            // Simple ZIP to county mapping for common PA counties
            this.zipMapping = {
            '15001': 'BEAVER',
            '15003': 'BEAVER',
            '15004': 'WASHINGTON',
            '15005': 'BEAVER',
            '15006': 'ALLEGHENY',
            '15007': 'ALLEGHENY',
            '15009': 'BEAVER',
            '15010': 'BEAVER',
            '15012': 'FAYETTE',
            '15014': 'ALLEGHENY',
            '15015': 'ALLEGHENY',
            '15017': 'ALLEGHENY',
            '15018': 'ALLEGHENY',
            '15019': 'WASHINGTON',
            '15020': 'ALLEGHENY',
            '15021': 'WASHINGTON',
            '15022': 'WASHINGTON',
            '15024': 'ALLEGHENY',
            '15025': 'ALLEGHENY',
            '15026': 'BEAVER',
            '15027': 'BEAVER',
            '15028': 'ALLEGHENY',
            '15030': 'ALLEGHENY',
            '15031': 'ALLEGHENY',
            '15032': 'ALLEGHENY',
            '15033': 'WASHINGTON',
            '15034': 'ALLEGHENY',
            '15035': 'ALLEGHENY',
            '15037': 'ALLEGHENY',
            '15038': 'WASHINGTON',
            '15042': 'BEAVER',
            '15043': 'BEAVER',
            '15044': 'ALLEGHENY',
            '15045': 'ALLEGHENY',
            '15046': 'ALLEGHENY',
            '15047': 'ALLEGHENY',
            '15049': 'ALLEGHENY',
            '15050': 'BEAVER',
            '15051': 'ALLEGHENY',
            '15052': 'BEAVER',
            '15053': 'WASHINGTON',
            '15054': 'WASHINGTON',
            '15055': 'WASHINGTON',
            '15056': 'ALLEGHENY',
            '15057': 'WASHINGTON',
            '15059': 'BEAVER',
            '15060': 'WASHINGTON',
            '15061': 'BEAVER',
            '15062': 'WESTMORELAND',
            '15063': 'WASHINGTON',
            '15064': 'ALLEGHENY',
            '15065': 'ALLEGHENY',
            '15066': 'BEAVER',
            '15067': 'WASHINGTON',
            '15068': 'WESTMORELAND',
            '15069': 'WESTMORELAND',
            '15071': 'ALLEGHENY',
            '15072': 'WESTMORELAND',
            '15074': 'BEAVER',
            '15075': 'ALLEGHENY',
            '15076': 'ALLEGHENY',
            '15077': 'BEAVER',
            '15078': 'WASHINGTON',
            '15081': 'BEAVER',
            '15082': 'ALLEGHENY',
            '15083': 'WESTMORELAND',
            '15084': 'ALLEGHENY',
            '15085': 'WESTMORELAND',
            '15086': 'ALLEGHENY',
            '15087': 'WESTMORELAND',
            '15088': 'ALLEGHENY',
            '15089': 'WESTMORELAND',
            '15090': 'ALLEGHENY',
            '15091': 'ALLEGHENY',
            '15095': 'ALLEGHENY',
            '15096': 'ALLEGHENY',
            '15101': 'ALLEGHENY',
            '15102': 'ALLEGHENY',
            '15104': 'ALLEGHENY',
            '15106': 'ALLEGHENY',
            '15108': 'ALLEGHENY',
            '15110': 'ALLEGHENY',
            '15112': 'ALLEGHENY',
            '15116': 'ALLEGHENY',
            '15120': 'ALLEGHENY',
            '15122': 'ALLEGHENY',
            '15126': 'ALLEGHENY',
            '15127': 'ALLEGHENY',
            '15129': 'ALLEGHENY',
            '15131': 'ALLEGHENY',
            '15132': 'ALLEGHENY',
            '15133': 'ALLEGHENY',
            '15134': 'ALLEGHENY',
            '15135': 'ALLEGHENY',
            '15136': 'ALLEGHENY',
            '15137': 'ALLEGHENY',
            '15139': 'ALLEGHENY',
            '15140': 'ALLEGHENY',
            '15142': 'ALLEGHENY',
            '15143': 'ALLEGHENY',
            '15144': 'ALLEGHENY',
            '15145': 'ALLEGHENY',
            '15146': 'ALLEGHENY',
            '15147': 'ALLEGHENY',
            '15148': 'ALLEGHENY',
            '15201': 'ALLEGHENY',
            '15202': 'ALLEGHENY',
            '15203': 'ALLEGHENY',
            '15204': 'ALLEGHENY',
            '15205': 'ALLEGHENY',
            '15206': 'ALLEGHENY',
            '15207': 'ALLEGHENY',
            '15208': 'ALLEGHENY',
            '15209': 'ALLEGHENY',
            '15210': 'ALLEGHENY',
            '15211': 'ALLEGHENY',
            '15212': 'ALLEGHENY',
            '15213': 'ALLEGHENY',
            '15214': 'ALLEGHENY',
            '15215': 'ALLEGHENY',
            '15216': 'ALLEGHENY',
            '15217': 'ALLEGHENY',
            '15218': 'ALLEGHENY',
            '15219': 'ALLEGHENY',
            '15220': 'ALLEGHENY',
            '15221': 'ALLEGHENY',
            '15222': 'ALLEGHENY',
            '15223': 'ALLEGHENY',
            '15224': 'ALLEGHENY',
            '15225': 'ALLEGHENY',
            '15226': 'ALLEGHENY',
            '15227': 'ALLEGHENY',
            '15228': 'ALLEGHENY',
            '15229': 'ALLEGHENY',
            '15230': 'ALLEGHENY',
            '15231': 'ALLEGHENY',
            '15232': 'ALLEGHENY',
            '15233': 'ALLEGHENY',
            '15234': 'ALLEGHENY',
            '15235': 'ALLEGHENY',
            '15236': 'ALLEGHENY',
            '15237': 'ALLEGHENY',
            '15238': 'ALLEGHENY',
            '15239': 'ALLEGHENY',
            '15240': 'ALLEGHENY',
            '15241': 'ALLEGHENY',
            '15242': 'ALLEGHENY',
            '15243': 'ALLEGHENY',
            '15244': 'ALLEGHENY',
            '15250': 'ALLEGHENY',
            '15251': 'ALLEGHENY',
            '15252': 'ALLEGHENY',
            '15253': 'ALLEGHENY',
            '15254': 'ALLEGHENY',
            '15255': 'ALLEGHENY',
            '15257': 'ALLEGHENY',
            '15258': 'ALLEGHENY',
            '15259': 'ALLEGHENY',
            '15260': 'ALLEGHENY',
            '15261': 'ALLEGHENY',
            '15262': 'ALLEGHENY',
            '15264': 'ALLEGHENY',
            '15265': 'ALLEGHENY',
            '15267': 'ALLEGHENY',
            '15268': 'ALLEGHENY',
            '15270': 'ALLEGHENY',
            '15272': 'ALLEGHENY',
            '15274': 'ALLEGHENY',
            '15275': 'ALLEGHENY',
            '15276': 'ALLEGHENY',
            '15277': 'ALLEGHENY',
            '15278': 'ALLEGHENY',
            '15279': 'ALLEGHENY',
            '15281': 'ALLEGHENY',
            '15282': 'ALLEGHENY',
            '15283': 'ALLEGHENY',
            '15286': 'ALLEGHENY',
            '15289': 'ALLEGHENY',
            '15290': 'ALLEGHENY',
            '15295': 'ALLEGHENY',
            '15301': 'WASHINGTON',
            '15310': 'GREENE',
            '15311': 'WASHINGTON',
            '15312': 'WASHINGTON',
            '15313': 'WASHINGTON',
            '15314': 'WASHINGTON',
            '15315': 'GREENE',
            '15316': 'GREENE',
            '15317': 'WASHINGTON',
            '15320': 'GREENE',
            '15321': 'WASHINGTON',
            '15322': 'GREENE',
            '15323': 'WASHINGTON',
            '15324': 'WASHINGTON',
            '15325': 'GREENE',
            '15327': 'GREENE',
            '15329': 'WASHINGTON',
            '15330': 'WASHINGTON',
            '15331': 'WASHINGTON',
            '15332': 'WASHINGTON',
            '15333': 'WASHINGTON',
            '15334': 'GREENE',
            '15336': 'WASHINGTON',
            '15337': 'GREENE',
            '15338': 'GREENE',
            '15339': 'WASHINGTON',
            '15340': 'WASHINGTON',
            '15341': 'GREENE',
            '15342': 'WASHINGTON',
            '15344': 'GREENE',
            '15345': 'WASHINGTON',
            '15346': 'GREENE',
            '15347': 'WASHINGTON',
            '15348': 'WASHINGTON',
            '15349': 'GREENE',
            '15350': 'WASHINGTON',
            '15351': 'GREENE',
            '15352': 'GREENE',
            '15353': 'GREENE',
            '15357': 'GREENE',
            '15358': 'WASHINGTON',
            '15359': 'GREENE',
            '15360': 'WASHINGTON',
            '15361': 'WASHINGTON',
            '15362': 'GREENE',
            '15363': 'WASHINGTON',
            '15364': 'GREENE',
            '15365': 'WASHINGTON',
            '15366': 'WASHINGTON',
            '15367': 'WASHINGTON',
            '15368': 'WASHINGTON',
            '15370': 'GREENE',
            '15376': 'WASHINGTON',
            '15377': 'WASHINGTON',
            '15378': 'WASHINGTON',
            '15379': 'WASHINGTON',
            '15380': 'GREENE',
            '15401': 'FAYETTE',
            '15410': 'FAYETTE',
            '15411': 'SOMERSET',
            '15412': 'WASHINGTON',
            '15413': 'FAYETTE',
            '15415': 'FAYETTE',
            '15416': 'FAYETTE',
            '15417': 'FAYETTE',
            '15419': 'WASHINGTON',
            '15420': 'FAYETTE',
            '15421': 'FAYETTE',
            '15422': 'FAYETTE',
            '15423': 'WASHINGTON',
            '15424': 'SOMERSET',
            '15425': 'FAYETTE',
            '15427': 'WASHINGTON',
            '15428': 'FAYETTE',
            '15429': 'WASHINGTON',
            '15430': 'FAYETTE',
            '15431': 'FAYETTE',
            '15432': 'WASHINGTON',
            '15433': 'FAYETTE',
            '15434': 'WASHINGTON',
            '15435': 'FAYETTE',
            '15436': 'FAYETTE',
            '15437': 'FAYETTE',
            '15438': 'FAYETTE',
            '15439': 'FAYETTE',
            '15440': 'FAYETTE',
            '15442': 'FAYETTE',
            '15443': 'FAYETTE',
            '15444': 'FAYETTE',
            '15445': 'FAYETTE',
            '15446': 'FAYETTE',
            '15447': 'FAYETTE',
            '15448': 'WESTMORELAND',
            '15449': 'FAYETTE',
            '15450': 'FAYETTE',
            '15451': 'FAYETTE',
            '15454': 'FAYETTE',
            '15455': 'FAYETTE',
            '15456': 'FAYETTE',
            '15458': 'FAYETTE',
            '15459': 'FAYETTE',
            '15460': 'FAYETTE',
            '15461': 'FAYETTE',
            '15462': 'FAYETTE',
            '15463': 'FAYETTE',
            '15464': 'FAYETTE',
            '15465': 'FAYETTE',
            '15466': 'FAYETTE',
            '15467': 'FAYETTE',
            '15468': 'FAYETTE',
            '15469': 'FAYETTE',
            '15470': 'FAYETTE',
            '15472': 'FAYETTE',
            '15473': 'FAYETTE',
            '15474': 'FAYETTE',
            '15475': 'FAYETTE',
            '15476': 'FAYETTE',
            '15477': 'WASHINGTON',
            '15478': 'FAYETTE',
            '15479': 'WESTMORELAND',
            '15480': 'FAYETTE',
            '15482': 'FAYETTE',
            '15483': 'WASHINGTON',
            '15484': 'FAYETTE',
            '15485': 'SOMERSET',
            '15486': 'FAYETTE',
            '15488': 'FAYETTE',
            '15489': 'FAYETTE',
            '15490': 'FAYETTE',
            '15492': 'FAYETTE',
            '15501': 'SOMERSET',
            '15502': 'SOMERSET',
            '15510': 'SOMERSET',
            '15520': 'SOMERSET',
            '15521': 'BEDFORD',
            '15522': 'BEDFORD',
            '15530': 'SOMERSET',
            '15531': 'SOMERSET',
            '15532': 'SOMERSET',
            '15533': 'BEDFORD',
            '15534': 'BEDFORD',
            '15535': 'BEDFORD',
            '15536': 'FULTON',
            '15537': 'BEDFORD',
            '15538': 'SOMERSET',
            '15539': 'BEDFORD',
            '15540': 'SOMERSET',
            '15541': 'SOMERSET',
            '15542': 'SOMERSET',
            '15544': 'SOMERSET',
            '15545': 'BEDFORD',
            '15546': 'SOMERSET',
            '15547': 'SOMERSET',
            '15548': 'SOMERSET',
            '15549': 'SOMERSET',
            '15550': 'BEDFORD',
            '15551': 'SOMERSET',
            '15552': 'SOMERSET',
            '15553': 'SOMERSET',
            '15554': 'BEDFORD',
            '15555': 'SOMERSET',
            '15557': 'SOMERSET',
            '15558': 'SOMERSET',
            '15559': 'BEDFORD',
            '15560': 'SOMERSET',
            '15561': 'SOMERSET',
            '15562': 'SOMERSET',
            '15563': 'SOMERSET',
            '15564': 'SOMERSET',
            '15565': 'SOMERSET',
            '15601': 'WESTMORELAND',
            '15605': 'WESTMORELAND',
            '15606': 'WESTMORELAND',
            '15610': 'WESTMORELAND',
            '15611': 'WESTMORELAND',
            '15612': 'WESTMORELAND',
            '15613': 'WESTMORELAND',
            '15615': 'WESTMORELAND',
            '15616': 'WESTMORELAND',
            '15617': 'WESTMORELAND',
            '15618': 'WESTMORELAND',
            '15619': 'WESTMORELAND',
            '15620': 'WESTMORELAND',
            '15621': 'WESTMORELAND',
            '15622': 'WESTMORELAND',
            '15623': 'WESTMORELAND',
            '15624': 'WESTMORELAND',
            '15625': 'WESTMORELAND',
            '15626': 'WESTMORELAND',
            '15627': 'WESTMORELAND',
            '15628': 'WESTMORELAND',
            '15629': 'WESTMORELAND',
            '15631': 'FAYETTE',
            '15632': 'WESTMORELAND',
            '15633': 'WESTMORELAND',
            '15634': 'WESTMORELAND',
            '15635': 'WESTMORELAND',
            '15636': 'WESTMORELAND',
            '15637': 'WESTMORELAND',
            '15638': 'WESTMORELAND',
            '15639': 'WESTMORELAND',
            '15640': 'WESTMORELAND',
            '15641': 'WESTMORELAND',
            '15642': 'WESTMORELAND',
            '15644': 'WESTMORELAND',
            '15646': 'WESTMORELAND',
            '15647': 'WESTMORELAND',
            '15650': 'WESTMORELAND',
            '15655': 'WESTMORELAND',
            '15656': 'ARMSTRONG',
            '15658': 'WESTMORELAND',
            '15660': 'WESTMORELAND',
            '15661': 'WESTMORELAND',
            '15662': 'WESTMORELAND',
            '15663': 'WESTMORELAND',
            '15664': 'WESTMORELAND',
            '15665': 'WESTMORELAND',
            '15666': 'WESTMORELAND',
            '15668': 'WESTMORELAND',
            '15670': 'WESTMORELAND',
            '15671': 'WESTMORELAND',
            '15672': 'WESTMORELAND',
            '15673': 'ARMSTRONG',
            '15674': 'WESTMORELAND',
            '15675': 'WESTMORELAND',
            '15676': 'WESTMORELAND',
            '15677': 'WESTMORELAND',
            '15678': 'WESTMORELAND',
            '15679': 'WESTMORELAND',
            '15680': 'WESTMORELAND',
            '15681': 'INDIANA',
            '15682': 'ARMSTRONG',
            '15683': 'WESTMORELAND',
            '15684': 'WESTMORELAND',
            '15685': 'WESTMORELAND',
            '15686': 'ARMSTRONG',
            '15687': 'WESTMORELAND',
            '15688': 'WESTMORELAND',
            '15689': 'WESTMORELAND',
            '15690': 'WESTMORELAND',
            '15691': 'WESTMORELAND',
            '15692': 'WESTMORELAND',
            '15693': 'WESTMORELAND',
            '15695': 'WESTMORELAND',
            '15696': 'WESTMORELAND',
            '15697': 'WESTMORELAND',
            '15698': 'WESTMORELAND',
            '15701': 'INDIANA',
            '15705': 'INDIANA',
            '15710': 'INDIANA',
            '15711': 'JEFFERSON',
            '15712': 'INDIANA',
            '15713': 'INDIANA',
            '15714': 'CAMBRIA',
            '15715': 'JEFFERSON',
            '15716': 'INDIANA',
            '15717': 'INDIANA',
            '15720': 'INDIANA',
            '15721': 'CLEARFIELD',
            '15722': 'CAMBRIA',
            '15723': 'INDIANA',
            '15724': 'INDIANA',
            '15725': 'INDIANA',
            '15727': 'INDIANA',
            '15728': 'INDIANA',
            '15729': 'INDIANA',
            '15730': 'JEFFERSON',
            '15731': 'INDIANA',
            '15732': 'INDIANA',
            '15733': 'JEFFERSON',
            '15734': 'INDIANA',
            '15736': 'ARMSTRONG',
            '15737': 'CAMBRIA',
            '15738': 'CAMBRIA',
            '15739': 'INDIANA',
            '15741': 'INDIANA',
            '15742': 'INDIANA',
            '15744': 'JEFFERSON',
            '15745': 'INDIANA',
            '15746': 'INDIANA',
            '15747': 'INDIANA',
            '15748': 'INDIANA',
            '15750': 'INDIANA',
            '15752': 'INDIANA',
            '15753': 'CLEARFIELD',
            '15754': 'INDIANA',
            '15756': 'INDIANA',
            '15757': 'CLEARFIELD',
            '15758': 'INDIANA',
            '15759': 'INDIANA',
            '15760': 'CAMBRIA',
            '15761': 'INDIANA',
            '15762': 'CAMBRIA',
            '15763': 'INDIANA',
            '15764': 'JEFFERSON',
            '15765': 'INDIANA',
            '15767': 'JEFFERSON',
            '15770': 'JEFFERSON',
            '15771': 'INDIANA',
            '15772': 'INDIANA',
            '15773': 'CAMBRIA',
            '15774': 'INDIANA',
            '15775': 'CAMBRIA',
            '15776': 'JEFFERSON',
            '15777': 'INDIANA',
            '15778': 'JEFFERSON',
            '15779': 'WESTMORELAND',
            '15780': 'JEFFERSON',
            '15781': 'JEFFERSON',
            '15783': 'INDIANA',
            '15784': 'JEFFERSON',
            '15801': 'CLEARFIELD',
            '15821': 'ELK',
            '15822': 'ELK',
            '15823': 'ELK',
            '15824': 'JEFFERSON',
            '15825': 'JEFFERSON',
            '15827': 'ELK',
            '15828': 'FOREST',
            '15829': 'JEFFERSON',
            '15831': 'ELK',
            '15832': 'CAMERON',
            '15834': 'CAMERON',
            '15840': 'JEFFERSON',
            '15841': 'ELK',
            '15845': 'ELK',
            '15846': 'ELK',
            '15847': 'JEFFERSON',
            '15848': 'CLEARFIELD',
            '15849': 'CLEARFIELD',
            '15851': 'JEFFERSON',
            '15853': 'ELK',
            '15856': 'CLEARFIELD',
            '15857': 'ELK',
            '15860': 'JEFFERSON',
            '15861': 'CAMERON',
            '15863': 'JEFFERSON',
            '15864': 'JEFFERSON',
            '15865': 'JEFFERSON',
            '15866': 'CLEARFIELD',
            '15868': 'ELK',
            '15870': 'ELK',
            '15901': 'CAMBRIA',
            '15902': 'CAMBRIA',
            '15904': 'CAMBRIA',
            '15905': 'CAMBRIA',
            '15906': 'CAMBRIA',
            '15907': 'CAMBRIA',
            '15909': 'CAMBRIA',
            '15915': 'CAMBRIA',
            '15920': 'INDIANA',
            '15921': 'CAMBRIA',
            '15922': 'CAMBRIA',
            '15923': 'WESTMORELAND',
            '15924': 'SOMERSET',
            '15925': 'CAMBRIA',
            '15926': 'SOMERSET',
            '15927': 'CAMBRIA',
            '15928': 'SOMERSET',
            '15929': 'INDIANA',
            '15930': 'CAMBRIA',
            '15931': 'CAMBRIA',
            '15934': 'CAMBRIA',
            '15935': 'SOMERSET',
            '15936': 'SOMERSET',
            '15937': 'SOMERSET',
            '15938': 'CAMBRIA',
            '15940': 'CAMBRIA',
            '15942': 'CAMBRIA',
            '15943': 'CAMBRIA',
            '15944': 'WESTMORELAND',
            '15945': 'CAMBRIA',
            '15946': 'CAMBRIA',
            '15948': 'CAMBRIA',
            '15949': 'INDIANA',
            '15951': 'CAMBRIA',
            '15952': 'CAMBRIA',
            '15953': 'SOMERSET',
            '15954': 'WESTMORELAND',
            '15955': 'CAMBRIA',
            '15956': 'CAMBRIA',
            '15957': 'INDIANA',
            '15958': 'CAMBRIA',
            '15959': 'SOMERSET',
            '15960': 'CAMBRIA',
            '15961': 'CAMBRIA',
            '15962': 'CAMBRIA',
            '15963': 'SOMERSET',
            '16001': 'BUTLER',
            '16002': 'BUTLER',
            '16003': 'BUTLER',
            '16016': 'BUTLER',
            '16017': 'BUTLER',
            '16018': 'BUTLER',
            '16020': 'BUTLER',
            '16022': 'BUTLER',
            '16023': 'BUTLER',
            '16024': 'BUTLER',
            '16025': 'BUTLER',
            '16027': 'BUTLER',
            '16028': 'CLARION',
            '16029': 'BUTLER',
            '16030': 'BUTLER',
            '16033': 'BUTLER',
            '16034': 'BUTLER',
            '16035': 'BUTLER',
            '16036': 'CLARION',
            '16037': 'BUTLER',
            '16038': 'BUTLER',
            '16039': 'BUTLER',
            '16040': 'BUTLER',
            '16041': 'BUTLER',
            '16045': 'BUTLER',
            '16046': 'BUTLER',
            '16048': 'BUTLER',
            '16049': 'ARMSTRONG',
            '16050': 'BUTLER',
            '16051': 'BUTLER',
            '16052': 'BUTLER',
            '16053': 'BUTLER',
            '16054': 'CLARION',
            '16055': 'BUTLER',
            '16056': 'BUTLER',
            '16057': 'BUTLER',
            '16058': 'CLARION',
            '16059': 'BUTLER',
            '16061': 'BUTLER',
            '16063': 'BUTLER',
            '16066': 'BUTLER',
            '16101': 'LAWRENCE',
            '16102': 'LAWRENCE',
            '16103': 'LAWRENCE',
            '16105': 'LAWRENCE',
            '16107': 'LAWRENCE',
            '16108': 'LAWRENCE',
            '16110': 'CRAWFORD',
            '16111': 'CRAWFORD',
            '16112': 'LAWRENCE',
            '16113': 'MERCER',
            '16114': 'MERCER',
            '16115': 'BEAVER',
            '16116': 'LAWRENCE',
            '16117': 'LAWRENCE',
            '16120': 'LAWRENCE',
            '16121': 'MERCER',
            '16123': 'BEAVER',
            '16124': 'MERCER',
            '16125': 'MERCER',
            '16127': 'MERCER',
            '16130': 'MERCER',
            '16131': 'CRAWFORD',
            '16132': 'LAWRENCE',
            '16133': 'MERCER',
            '16134': 'MERCER',
            '16136': 'BEAVER',
            '16137': 'MERCER',
            '16140': 'LAWRENCE',
            '16141': 'BEAVER',
            '16142': 'LAWRENCE',
            '16143': 'LAWRENCE',
            '16145': 'MERCER',
            '16146': 'MERCER',
            '16148': 'MERCER',
            '16150': 'MERCER',
            '16151': 'MERCER',
            '16153': 'MERCER',
            '16154': 'MERCER',
            '16155': 'LAWRENCE',
            '16156': 'LAWRENCE',
            '16157': 'LAWRENCE',
            '16159': 'MERCER',
            '16160': 'LAWRENCE',
            '16161': 'MERCER',
            '16172': 'LAWRENCE',
            '16201': 'ARMSTRONG',
            '16210': 'ARMSTRONG',
            '16211': 'INDIANA',
            '16212': 'ARMSTRONG',
            '16213': 'CLARION',
            '16214': 'CLARION',
            '16217': 'FOREST',
            '16218': 'ARMSTRONG',
            '16220': 'CLARION',
            '16221': 'CLARION',
            '16222': 'ARMSTRONG',
            '16223': 'ARMSTRONG',
            '16224': 'CLARION',
            '16225': 'CLARION',
            '16226': 'ARMSTRONG',
            '16228': 'ARMSTRONG',
            '16229': 'ARMSTRONG',
            '16230': 'CLARION',
            '16232': 'CLARION',
            '16233': 'CLARION',
            '16234': 'CLARION',
            '16235': 'CLARION',
            '16236': 'ARMSTRONG',
            '16238': 'ARMSTRONG',
            '16239': 'FOREST',
            '16240': 'CLARION',
            '16242': 'CLARION',
            '16244': 'ARMSTRONG',
            '16245': 'ARMSTRONG',
            '16246': 'INDIANA',
            '16248': 'CLARION',
            '16249': 'ARMSTRONG',
            '16250': 'ARMSTRONG',
            '16253': 'ARMSTRONG',
            '16254': 'CLARION',
            '16255': 'CLARION',
            '16256': 'INDIANA',
            '16257': 'CLARION',
            '16258': 'CLARION',
            '16259': 'ARMSTRONG',
            '16260': 'CLARION',
            '16261': 'ARMSTRONG',
            '16262': 'ARMSTRONG',
            '16263': 'ARMSTRONG',
            '16301': 'VENANGO',
            '16311': 'MERCER',
            '16312': 'WARREN',
            '16313': 'WARREN',
            '16314': 'CRAWFORD',
            '16316': 'CRAWFORD',
            '16317': 'VENANGO',
            '16319': 'VENANGO',
            '16321': 'FOREST',
            '16322': 'FOREST',
            '16323': 'VENANGO',
            '16326': 'CLARION',
            '16327': 'CRAWFORD',
            '16328': 'CRAWFORD',
            '16329': 'WARREN',
            '16331': 'CLARION',
            '16332': 'CLARION',
            '16333': 'MCKEAN',
            '16334': 'CLARION',
            '16335': 'CRAWFORD',
            '16340': 'WARREN',
            '16341': 'VENANGO',
            '16342': 'VENANGO',
            '16343': 'VENANGO',
            '16344': 'VENANGO',
            '16345': 'WARREN',
            '16346': 'VENANGO',
            '16347': 'WARREN',
            '16350': 'WARREN',
            '16351': 'WARREN',
            '16352': 'WARREN',
            '16353': 'FOREST',
            '16354': 'CRAWFORD',
            '16360': 'CRAWFORD',
            '16361': 'CLARION',
            '16362': 'VENANGO',
            '16364': 'VENANGO',
            '16365': 'WARREN',
            '16366': 'WARREN',
            '16367': 'WARREN',
            '16368': 'WARREN',
            '16369': 'WARREN',
            '16370': 'FOREST',
            '16371': 'WARREN',
            '16372': 'VENANGO',
            '16373': 'VENANGO',
            '16374': 'VENANGO',
            '16375': 'CLARION',
            '16388': 'CRAWFORD',
            '16401': 'ERIE',
            '16402': 'WARREN',
            '16403': 'CRAWFORD',
            '16404': 'CRAWFORD',
            '16405': 'WARREN',
            '16406': 'CRAWFORD',
            '16407': 'ERIE',
            '16410': 'ERIE',
            '16411': 'ERIE',
            '16412': 'ERIE',
            '16413': 'ERIE',
            '16415': 'ERIE',
            '16416': 'WARREN',
            '16417': 'ERIE',
            '16420': 'WARREN',
            '16421': 'ERIE',
            '16422': 'CRAWFORD',
            '16423': 'ERIE',
            '16424': 'CRAWFORD',
            '16426': 'ERIE',
            '16427': 'ERIE',
            '16428': 'ERIE',
            '16430': 'ERIE',
            '16432': 'CRAWFORD',
            '16433': 'CRAWFORD',
            '16434': 'CRAWFORD',
            '16435': 'CRAWFORD',
            '16436': 'WARREN',
            '16438': 'ERIE',
            '16440': 'CRAWFORD',
            '16441': 'ERIE',
            '16442': 'ERIE',
            '16443': 'ERIE',
            '16444': 'ERIE',
            '16475': 'ERIE',
            '16501': 'ERIE',
            '16502': 'ERIE',
            '16503': 'ERIE',
            '16504': 'ERIE',
            '16505': 'ERIE',
            '16506': 'ERIE',
            '16507': 'ERIE',
            '16508': 'ERIE',
            '16509': 'ERIE',
            '16510': 'ERIE',
            '16511': 'ERIE',
            '16512': 'ERIE',
            '16514': 'ERIE',
            '16515': 'ERIE',
            '16522': 'ERIE',
            '16530': 'ERIE',
            '16531': 'ERIE',
            '16534': 'ERIE',
            '16538': 'ERIE',
            '16541': 'ERIE',
            '16544': 'ERIE',
            '16546': 'ERIE',
            '16550': 'ERIE',
            '16553': 'ERIE',
            '16563': 'ERIE',
            '16565': 'ERIE',
            '16601': 'BLAIR',
            '16602': 'BLAIR',
            '16603': 'BLAIR',
            '16611': 'HUNTINGDON',
            '16613': 'CAMBRIA',
            '16616': 'CLEARFIELD',
            '16617': 'BLAIR',
            '16619': 'CAMBRIA',
            '16620': 'CLEARFIELD',
            '16621': 'HUNTINGDON',
            '16622': 'HUNTINGDON',
            '16623': 'HUNTINGDON',
            '16624': 'CAMBRIA',
            '16625': 'BLAIR',
            '16627': 'CLEARFIELD',
            '16629': 'CAMBRIA',
            '16630': 'CAMBRIA',
            '16631': 'BLAIR',
            '16633': 'BEDFORD',
            '16634': 'HUNTINGDON',
            '16635': 'BLAIR',
            '16636': 'CAMBRIA',
            '16637': 'BLAIR',
            '16638': 'HUNTINGDON',
            '16639': 'CAMBRIA',
            '16640': 'CAMBRIA',
            '16641': 'CAMBRIA',
            '16644': 'CAMBRIA',
            '16645': 'CLEARFIELD',
            '16646': 'CAMBRIA',
            '16647': 'HUNTINGDON',
            '16648': 'BLAIR',
            '16650': 'BEDFORD',
            '16651': 'CLEARFIELD',
            '16652': 'HUNTINGDON',
            '16654': 'HUNTINGDON',
            '16655': 'BEDFORD',
            '16656': 'CLEARFIELD',
            '16657': 'HUNTINGDON',
            '16659': 'BEDFORD',
            '16660': 'HUNTINGDON',
            '16661': 'CLEARFIELD',
            '16662': 'BLAIR',
            '16663': 'CLEARFIELD',
            '16664': 'BEDFORD',
            '16665': 'BLAIR',
            '16666': 'CLEARFIELD',
            '16667': 'BEDFORD',
            '16668': 'CAMBRIA',
            '16669': 'HUNTINGDON',
            '16670': 'BEDFORD',
            '16671': 'CLEARFIELD',
            '16672': 'BEDFORD',
            '16673': 'BLAIR',
            '16674': 'HUNTINGDON',
            '16675': 'CAMBRIA',
            '16677': 'CENTRE',
            '16678': 'BEDFORD',
            '16679': 'BEDFORD',
            '16680': 'CLEARFIELD',
            '16681': 'CLEARFIELD',
            '16682': 'BLAIR',
            '16683': 'HUNTINGDON',
            '16684': 'BLAIR',
            '16685': 'HUNTINGDON',
            '16686': 'BLAIR',
            '16689': 'FULTON',
            '16691': 'FULTON',
            '16692': 'CLEARFIELD',
            '16693': 'BLAIR',
            '16694': 'BEDFORD',
            '16695': 'BEDFORD',
            '16698': 'CLEARFIELD',
            '16699': 'CAMBRIA',
            '16701': 'MCKEAN',
            '16720': 'POTTER',
            '16724': 'MCKEAN',
            '16725': 'MCKEAN',
            '16726': 'MCKEAN',
            '16727': 'MCKEAN',
            '16728': 'ELK',
            '16729': 'MCKEAN',
            '16730': 'MCKEAN',
            '16731': 'MCKEAN',
            '16732': 'MCKEAN',
            '16733': 'MCKEAN',
            '16734': 'ELK',
            '16735': 'MCKEAN',
            '16738': 'MCKEAN',
            '16740': 'MCKEAN',
            '16743': 'MCKEAN',
            '16744': 'MCKEAN',
            '16745': 'MCKEAN',
            '16746': 'POTTER',
            '16748': 'POTTER',
            '16749': 'MCKEAN',
            '16750': 'MCKEAN',
            '16801': 'CENTRE',
            '16802': 'CENTRE',
            '16803': 'CENTRE',
            '16804': 'CENTRE',
            '16805': 'CENTRE',
            '16820': 'CENTRE',
            '16821': 'CLEARFIELD',
            '16822': 'CLINTON',
            '16823': 'CENTRE',
            '16825': 'CLEARFIELD',
            '16826': 'CENTRE',
            '16827': 'CENTRE',
            '16828': 'CENTRE',
            '16829': 'CENTRE',
            '16830': 'CLEARFIELD',
            '16832': 'CENTRE',
            '16833': 'CLEARFIELD',
            '16834': 'CLEARFIELD',
            '16835': 'CENTRE',
            '16836': 'CLEARFIELD',
            '16837': 'CLEARFIELD',
            '16838': 'CLEARFIELD',
            '16839': 'CLEARFIELD',
            '16840': 'CLEARFIELD',
            '16841': 'CENTRE',
            '16843': 'CLEARFIELD',
            '16844': 'CENTRE',
            '16845': 'CLEARFIELD',
            '16847': 'CLEARFIELD',
            '16848': 'CLINTON',
            '16849': 'CLEARFIELD',
            '16850': 'CLEARFIELD',
            '16851': 'CENTRE',
            '16852': 'CENTRE',
            '16853': 'CENTRE',
            '16854': 'CENTRE',
            '16855': 'CLEARFIELD',
            '16856': 'CENTRE',
            '16858': 'CLEARFIELD',
            '16859': 'CENTRE',
            '16860': 'CLEARFIELD',
            '16861': 'CLEARFIELD',
            '16863': 'CLEARFIELD',
            '16864': 'CENTRE',
            '16865': 'CENTRE',
            '16866': 'CENTRE',
            '16868': 'CENTRE',
            '16870': 'CENTRE',
            '16871': 'CLEARFIELD',
            '16872': 'CENTRE',
            '16873': 'CLEARFIELD',
            '16874': 'CENTRE',
            '16875': 'CENTRE',
            '16876': 'CLEARFIELD',
            '16877': 'HUNTINGDON',
            '16878': 'CLEARFIELD',
            '16879': 'CLEARFIELD',
            '16881': 'CLEARFIELD',
            '16882': 'CENTRE',
            '16901': 'TIOGA',
            '16910': 'BRADFORD',
            '16911': 'TIOGA',
            '16912': 'TIOGA',
            '16914': 'BRADFORD',
            '16915': 'POTTER',
            '16917': 'TIOGA',
            '16920': 'TIOGA',
            '16921': 'TIOGA',
            '16922': 'POTTER',
            '16923': 'POTTER',
            '16925': 'BRADFORD',
            '16926': 'BRADFORD',
            '16927': 'POTTER',
            '16928': 'TIOGA',
            '16929': 'TIOGA',
            '16930': 'TIOGA',
            '16932': 'TIOGA',
            '16933': 'TIOGA',
            '16935': 'TIOGA',
            '16936': 'TIOGA',
            '16937': 'POTTER',
            '16938': 'TIOGA',
            '16939': 'TIOGA',
            '16940': 'TIOGA',
            '16941': 'POTTER',
            '16942': 'TIOGA',
            '16943': 'TIOGA',
            '16945': 'BRADFORD',
            '16946': 'TIOGA',
            '16947': 'BRADFORD',
            '16948': 'POTTER',
            '16950': 'TIOGA',
            '17001': 'CUMBERLAND',
            '17002': 'MIFFLIN',
            '17003': 'LEBANON',
            '17004': 'MIFFLIN',
            '17005': 'DAUPHIN',
            '17006': 'PERRY',
            '17007': 'CUMBERLAND',
            '17009': 'MIFFLIN',
            '17010': 'LEBANON',
            '17011': 'CUMBERLAND',
            '17013': 'CUMBERLAND',
            '17014': 'JUNIATA',
            '17015': 'CUMBERLAND',
            '17016': 'LEBANON',
            '17017': 'NORTHUMBERLAND',
            '17018': 'DAUPHIN',
            '17019': 'YORK',
            '17020': 'PERRY',
            '17021': 'JUNIATA',
            '17022': 'LANCASTER',
            '17023': 'DAUPHIN',
            '17024': 'PERRY',
            '17025': 'CUMBERLAND',
            '17026': 'LEBANON',
            '17027': 'CUMBERLAND',
            '17028': 'DAUPHIN',
            '17029': 'MIFFLIN',
            '17030': 'DAUPHIN',
            '17032': 'DAUPHIN',
            '17033': 'DAUPHIN',
            '17034': 'DAUPHIN',
            '17035': 'JUNIATA',
            '17036': 'DAUPHIN',
            '17037': 'PERRY',
            '17038': 'LEBANON',
            '17039': 'LEBANON',
            '17040': 'PERRY',
            '17041': 'LEBANON',
            '17042': 'LEBANON',
            '17043': 'CUMBERLAND',
            '17044': 'MIFFLIN',
            '17045': 'PERRY',
            '17046': 'LEBANON',
            '17047': 'PERRY',
            '17048': 'DAUPHIN',
            '17049': 'JUNIATA',
            '17050': 'CUMBERLAND',
            '17051': 'MIFFLIN',
            '17052': 'HUNTINGDON',
            '17053': 'PERRY',
            '17054': 'MIFFLIN',
            '17055': 'CUMBERLAND',
            '17056': 'JUNIATA',
            '17057': 'DAUPHIN',
            '17058': 'JUNIATA',
            '17059': 'JUNIATA',
            '17060': 'HUNTINGDON',
            '17061': 'DAUPHIN',
            '17062': 'PERRY',
            '17063': 'MIFFLIN',
            '17064': 'LEBANON',
            '17065': 'CUMBERLAND',
            '17066': 'HUNTINGDON',
            '17067': 'LEBANON',
            '17068': 'PERRY',
            '17069': 'PERRY',
            '17070': 'YORK',
            '17071': 'PERRY',
            '17072': 'CUMBERLAND',
            '17073': 'LEBANON',
            '17074': 'PERRY',
            '17075': 'MIFFLIN',
            '17076': 'JUNIATA',
            '17077': 'LEBANON',
            '17078': 'LEBANON',
            '17080': 'DAUPHIN',
            '17081': 'CUMBERLAND',
            '17082': 'JUNIATA',
            '17083': 'LEBANON',
            '17084': 'MIFFLIN',
            '17085': 'LEBANON',
            '17086': 'JUNIATA',
            '17087': 'LEBANON',
            '17088': 'LEBANON',
            '17089': 'CUMBERLAND',
            '17090': 'PERRY',
            '17093': 'CUMBERLAND',
            '17094': 'JUNIATA',
            '17097': 'DAUPHIN',
            '17098': 'DAUPHIN',
            '17099': 'MIFFLIN',
            '17101': 'DAUPHIN',
            '17102': 'DAUPHIN',
            '17103': 'DAUPHIN',
            '17104': 'DAUPHIN',
            '17105': 'DAUPHIN',
            '17106': 'DAUPHIN',
            '17107': 'DAUPHIN',
            '17108': 'DAUPHIN',
            '17109': 'DAUPHIN',
            '17110': 'DAUPHIN',
            '17111': 'DAUPHIN',
            '17112': 'DAUPHIN',
            '17113': 'DAUPHIN',
            '17120': 'DAUPHIN',
            '17121': 'DAUPHIN',
            '17122': 'DAUPHIN',
            '17123': 'DAUPHIN',
            '17124': 'DAUPHIN',
            '17125': 'DAUPHIN',
            '17126': 'DAUPHIN',
            '17127': 'DAUPHIN',
            '17128': 'DAUPHIN',
            '17129': 'DAUPHIN',
            '17130': 'DAUPHIN',
            '17140': 'DAUPHIN',
            '17177': 'DAUPHIN',
            '17201': 'FRANKLIN',
            '17202': 'FRANKLIN',
            '17210': 'FRANKLIN',
            '17211': 'BEDFORD',
            '17212': 'FULTON',
            '17213': 'HUNTINGDON',
            '17214': 'FRANKLIN',
            '17215': 'FULTON',
            '17217': 'FRANKLIN',
            '17219': 'FRANKLIN',
            '17220': 'FRANKLIN',
            '17221': 'FRANKLIN',
            '17222': 'FRANKLIN',
            '17223': 'FULTON',
            '17224': 'FRANKLIN',
            '17225': 'FRANKLIN',
            '17228': 'FULTON',
            '17229': 'FULTON',
            '17231': 'FRANKLIN',
            '17232': 'FRANKLIN',
            '17233': 'FULTON',
            '17235': 'FRANKLIN',
            '17236': 'FRANKLIN',
            '17237': 'FRANKLIN',
            '17238': 'FULTON',
            '17239': 'HUNTINGDON',
            '17240': 'CUMBERLAND',
            '17241': 'CUMBERLAND',
            '17243': 'HUNTINGDON',
            '17244': 'FRANKLIN',
            '17246': 'FRANKLIN',
            '17247': 'FRANKLIN',
            '17249': 'HUNTINGDON',
            '17250': 'FRANKLIN',
            '17251': 'FRANKLIN',
            '17252': 'FRANKLIN',
            '17253': 'HUNTINGDON',
            '17254': 'FRANKLIN',
            '17255': 'HUNTINGDON',
            '17256': 'FRANKLIN',
            '17257': 'CUMBERLAND',
            '17260': 'HUNTINGDON',
            '17261': 'FRANKLIN',
            '17262': 'FRANKLIN',
            '17263': 'FRANKLIN',
            '17264': 'HUNTINGDON',
            '17265': 'FRANKLIN',
            '17266': 'CUMBERLAND',
            '17267': 'FULTON',
            '17268': 'FRANKLIN',
            '17271': 'FRANKLIN',
            '17272': 'FRANKLIN',
            '17301': 'ADAMS',
            '17302': 'YORK',
            '17303': 'ADAMS',
            '17304': 'ADAMS',
            '17306': 'ADAMS',
            '17307': 'ADAMS',
            '17309': 'YORK',
            '17310': 'ADAMS',
            '17311': 'YORK',
            '17312': 'YORK',
            '17313': 'YORK',
            '17314': 'YORK',
            '17315': 'YORK',
            '17316': 'ADAMS',
            '17317': 'YORK',
            '17318': 'YORK',
            '17319': 'YORK',
            '17320': 'ADAMS',
            '17321': 'YORK',
            '17322': 'YORK',
            '17323': 'YORK',
            '17324': 'ADAMS',
            '17325': 'ADAMS',
            '17327': 'YORK',
            '17329': 'YORK',
            '17331': 'YORK',
            '17332': 'YORK',
            '17333': 'YORK',
            '17334': 'YORK',
            '17335': 'YORK',
            '17337': 'ADAMS',
            '17339': 'YORK',
            '17340': 'ADAMS',
            '17342': 'YORK',
            '17343': 'ADAMS',
            '17344': 'ADAMS',
            '17345': 'YORK',
            '17347': 'YORK',
            '17349': 'YORK',
            '17350': 'ADAMS',
            '17352': 'YORK',
            '17353': 'ADAMS',
            '17355': 'YORK',
            '17356': 'YORK',
            '17358': 'YORK',
            '17360': 'YORK',
            '17361': 'YORK',
            '17362': 'YORK',
            '17363': 'YORK',
            '17364': 'YORK',
            '17365': 'YORK',
            '17366': 'YORK',
            '17368': 'YORK',
            '17370': 'YORK',
            '17371': 'YORK',
            '17372': 'ADAMS',
            '17375': 'ADAMS',
            '17401': 'YORK',
            '17402': 'YORK',
            '17403': 'YORK',
            '17404': 'YORK',
            '17405': 'YORK',
            '17406': 'YORK',
            '17407': 'YORK',
            '17408': 'YORK',
            '17501': 'LANCASTER',
            '17502': 'LANCASTER',
            '17503': 'LANCASTER',
            '17504': 'LANCASTER',
            '17505': 'LANCASTER',
            '17506': 'LANCASTER',
            '17507': 'LANCASTER',
            '17508': 'LANCASTER',
            '17509': 'LANCASTER',
            '17512': 'LANCASTER',
            '17516': 'LANCASTER',
            '17517': 'LANCASTER',
            '17518': 'LANCASTER',
            '17519': 'LANCASTER',
            '17520': 'LANCASTER',
            '17521': 'LANCASTER',
            '17522': 'LANCASTER',
            '17527': 'LANCASTER',
            '17528': 'LANCASTER',
            '17529': 'LANCASTER',
            '17532': 'LANCASTER',
            '17533': 'LANCASTER',
            '17534': 'LANCASTER',
            '17535': 'LANCASTER',
            '17536': 'LANCASTER',
            '17537': 'LANCASTER',
            '17538': 'LANCASTER',
            '17540': 'LANCASTER',
            '17543': 'LANCASTER',
            '17545': 'LANCASTER',
            '17547': 'LANCASTER',
            '17549': 'LANCASTER',
            '17550': 'LANCASTER',
            '17551': 'LANCASTER',
            '17552': 'LANCASTER',
            '17554': 'LANCASTER',
            '17555': 'LANCASTER',
            '17557': 'LANCASTER',
            '17560': 'LANCASTER',
            '17562': 'LANCASTER',
            '17563': 'LANCASTER',
            '17564': 'LANCASTER',
            '17565': 'LANCASTER',
            '17566': 'LANCASTER',
            '17567': 'LANCASTER',
            '17568': 'LANCASTER',
            '17569': 'LANCASTER',
            '17570': 'LANCASTER',
            '17572': 'LANCASTER',
            '17573': 'LANCASTER',
            '17575': 'LANCASTER',
            '17576': 'LANCASTER',
            '17578': 'LANCASTER',
            '17579': 'LANCASTER',
            '17580': 'LANCASTER',
            '17581': 'LANCASTER',
            '17582': 'LANCASTER',
            '17584': 'LANCASTER',
            '17585': 'LANCASTER',
            '17601': 'LANCASTER',
            '17602': 'LANCASTER',
            '17603': 'LANCASTER',
            '17604': 'LANCASTER',
            '17605': 'LANCASTER',
            '17606': 'LANCASTER',
            '17607': 'LANCASTER',
            '17608': 'LANCASTER',
            '17611': 'LANCASTER',
            '17622': 'LANCASTER',
            '17699': 'LANCASTER',
            '17701': 'LYCOMING',
            '17702': 'LYCOMING',
            '17703': 'LYCOMING',
            '17705': 'LYCOMING',
            '17720': 'LYCOMING',
            '17721': 'CLINTON',
            '17723': 'LYCOMING',
            '17724': 'BRADFORD',
            '17726': 'CLINTON',
            '17727': 'LYCOMING',
            '17728': 'LYCOMING',
            '17729': 'POTTER',
            '17730': 'NORTHUMBERLAND',
            '17731': 'SULLIVAN',
            '17735': 'BRADFORD',
            '17737': 'LYCOMING',
            '17739': 'LYCOMING',
            '17740': 'LYCOMING',
            '17742': 'LYCOMING',
            '17744': 'LYCOMING',
            '17745': 'CLINTON',
            '17747': 'CLINTON',
            '17748': 'CLINTON',
            '17749': 'NORTHUMBERLAND',
            '17750': 'CLINTON',
            '17751': 'CLINTON',
            '17752': 'LYCOMING',
            '17754': 'LYCOMING',
            '17756': 'LYCOMING',
            '17758': 'SULLIVAN',
            '17760': 'CLINTON',
            '17762': 'LYCOMING',
            '17763': 'LYCOMING',
            '17764': 'CLINTON',
            '17765': 'TIOGA',
            '17768': 'SULLIVAN',
            '17769': 'LYCOMING',
            '17771': 'LYCOMING',
            '17772': 'NORTHUMBERLAND',
            '17774': 'LYCOMING',
            '17776': 'LYCOMING',
            '17777': 'NORTHUMBERLAND',
            '17778': 'CLINTON',
            '17779': 'CLINTON',
            '17801': 'NORTHUMBERLAND',
            '17810': 'LYCOMING',
            '17812': 'SNYDER',
            '17813': 'SNYDER',
            '17814': 'COLUMBIA',
            '17815': 'COLUMBIA',
            '17820': 'COLUMBIA',
            '17821': 'MONTOUR',
            '17822': 'MONTOUR',
            '17823': 'NORTHUMBERLAND',
            '17824': 'NORTHUMBERLAND',
            '17827': 'SNYDER',
            '17829': 'UNION',
            '17830': 'NORTHUMBERLAND',
            '17831': 'SNYDER',
            '17832': 'NORTHUMBERLAND',
            '17833': 'SNYDER',
            '17834': 'NORTHUMBERLAND',
            '17835': 'UNION',
            '17836': 'NORTHUMBERLAND',
            '17837': 'UNION',
            '17840': 'NORTHUMBERLAND',
            '17841': 'SNYDER',
            '17842': 'SNYDER',
            '17843': 'SNYDER',
            '17844': 'UNION',
            '17845': 'UNION',
            '17846': 'COLUMBIA',
            '17847': 'NORTHUMBERLAND',
            '17850': 'NORTHUMBERLAND',
            '17851': 'NORTHUMBERLAND',
            '17853': 'SNYDER',
            '17855': 'UNION',
            '17856': 'UNION',
            '17857': 'NORTHUMBERLAND',
            '17858': 'COLUMBIA',
            '17859': 'COLUMBIA',
            '17860': 'NORTHUMBERLAND',
            '17861': 'SNYDER',
            '17862': 'SNYDER',
            '17864': 'SNYDER',
            '17865': 'NORTHUMBERLAND',
            '17866': 'NORTHUMBERLAND',
            '17867': 'NORTHUMBERLAND',
            '17868': 'NORTHUMBERLAND',
            '17870': 'SNYDER',
            '17872': 'NORTHUMBERLAND',
            '17876': 'SNYDER',
            '17877': 'NORTHUMBERLAND',
            '17878': 'COLUMBIA',
            '17880': 'UNION',
            '17881': 'NORTHUMBERLAND',
            '17882': 'SNYDER',
            '17884': 'MONTOUR',
            '17885': 'UNION',
            '17886': 'UNION',
            '17887': 'UNION',
            '17888': 'COLUMBIA',
            '17889': 'UNION',
            '17901': 'SCHUYLKILL',
            '17920': 'COLUMBIA',
            '17921': 'SCHUYLKILL',
            '17922': 'SCHUYLKILL',
            '17923': 'SCHUYLKILL',
            '17925': 'SCHUYLKILL',
            '17929': 'SCHUYLKILL',
            '17930': 'SCHUYLKILL',
            '17931': 'SCHUYLKILL',
            '17932': 'SCHUYLKILL',
            '17933': 'SCHUYLKILL',
            '17934': 'SCHUYLKILL',
            '17935': 'SCHUYLKILL',
            '17936': 'SCHUYLKILL',
            '17938': 'SCHUYLKILL',
            '17941': 'SCHUYLKILL',
            '17943': 'SCHUYLKILL',
            '17944': 'SCHUYLKILL',
            '17945': 'SCHUYLKILL',
            '17946': 'SCHUYLKILL',
            '17948': 'SCHUYLKILL',
            '17949': 'SCHUYLKILL',
            '17951': 'SCHUYLKILL',
            '17952': 'SCHUYLKILL',
            '17953': 'SCHUYLKILL',
            '17954': 'SCHUYLKILL',
            '17957': 'SCHUYLKILL',
            '17959': 'SCHUYLKILL',
            '17960': 'SCHUYLKILL',
            '17961': 'SCHUYLKILL',
            '17963': 'SCHUYLKILL',
            '17964': 'SCHUYLKILL',
            '17965': 'SCHUYLKILL',
            '17966': 'SCHUYLKILL',
            '17967': 'SCHUYLKILL',
            '17968': 'SCHUYLKILL',
            '17970': 'SCHUYLKILL',
            '17972': 'SCHUYLKILL',
            '17974': 'SCHUYLKILL',
            '17976': 'SCHUYLKILL',
            '17978': 'DAUPHIN',
            '17979': 'SCHUYLKILL',
            '17980': 'SCHUYLKILL',
            '17981': 'SCHUYLKILL',
            '17982': 'SCHUYLKILL',
            '17983': 'SCHUYLKILL',
            '17985': 'SCHUYLKILL',
            '18001': 'NORTHAMPTON',
            '18002': 'NORTHAMPTON',
            '18003': 'NORTHAMPTON',
            '18005': 'NORTHAMPTON',
            '18011': 'LEHIGH',
            '18012': 'CARBON',
            '18013': 'NORTHAMPTON',
            '18014': 'NORTHAMPTON',
            '18015': 'NORTHAMPTON',
            '18016': 'NORTHAMPTON',
            '18017': 'NORTHAMPTON',
            '18018': 'NORTHAMPTON',
            '18020': 'NORTHAMPTON',
            '18030': 'CARBON',
            '18031': 'LEHIGH',
            '18032': 'LEHIGH',
            '18034': 'LEHIGH',
            '18035': 'NORTHAMPTON',
            '18036': 'LEHIGH',
            '18037': 'LEHIGH',
            '18038': 'NORTHAMPTON',
            '18039': 'BUCKS',
            '18040': 'NORTHAMPTON',
            '18041': 'MONTGOMERY',
            '18042': 'NORTHAMPTON',
            '18043': 'NORTHAMPTON',
            '18044': 'NORTHAMPTON',
            '18045': 'NORTHAMPTON',
            '18046': 'LEHIGH',
            '18049': 'LEHIGH',
            '18051': 'LEHIGH',
            '18052': 'LEHIGH',
            '18053': 'LEHIGH',
            '18054': 'MONTGOMERY',
            '18055': 'NORTHAMPTON',
            '18056': 'BERKS',
            '18058': 'MONROE',
            '18059': 'LEHIGH',
            '18060': 'LEHIGH',
            '18062': 'LEHIGH',
            '18063': 'NORTHAMPTON',
            '18064': 'NORTHAMPTON',
            '18065': 'LEHIGH',
            '18066': 'LEHIGH',
            '18067': 'NORTHAMPTON',
            '18068': 'LEHIGH',
            '18069': 'LEHIGH',
            '18070': 'MONTGOMERY',
            '18071': 'CARBON',
            '18072': 'NORTHAMPTON',
            '18073': 'MONTGOMERY',
            '18074': 'MONTGOMERY',
            '18076': 'MONTGOMERY',
            '18077': 'BUCKS',
            '18078': 'LEHIGH',
            '18079': 'LEHIGH',
            '18080': 'LEHIGH',
            '18081': 'BUCKS',
            '18083': 'NORTHAMPTON',
            '18084': 'MONTGOMERY',
            '18085': 'NORTHAMPTON',
            '18086': 'NORTHAMPTON',
            '18087': 'LEHIGH',
            '18088': 'NORTHAMPTON',
            '18091': 'NORTHAMPTON',
            '18092': 'LEHIGH',
            '18098': 'LEHIGH',
            '18099': 'LEHIGH',
            '18101': 'LEHIGH',
            '18102': 'LEHIGH',
            '18103': 'LEHIGH',
            '18104': 'LEHIGH',
            '18105': 'LEHIGH',
            '18106': 'LEHIGH',
            '18109': 'LEHIGH',
            '18195': 'LEHIGH',
            '18201': 'LUZERNE',
            '18202': 'LUZERNE',
            '18210': 'CARBON',
            '18211': 'SCHUYLKILL',
            '18212': 'CARBON',
            '18214': 'SCHUYLKILL',
            '18216': 'LUZERNE',
            '18218': 'SCHUYLKILL',
            '18219': 'LUZERNE',
            '18220': 'SCHUYLKILL',
            '18221': 'LUZERNE',
            '18222': 'LUZERNE',
            '18223': 'LUZERNE',
            '18224': 'LUZERNE',
            '18225': 'LUZERNE',
            '18229': 'CARBON',
            '18230': 'CARBON',
            '18231': 'SCHUYLKILL',
            '18232': 'CARBON',
            '18234': 'LUZERNE',
            '18235': 'CARBON',
            '18237': 'SCHUYLKILL',
            '18239': 'LUZERNE',
            '18240': 'CARBON',
            '18241': 'SCHUYLKILL',
            '18242': 'SCHUYLKILL',
            '18244': 'CARBON',
            '18245': 'SCHUYLKILL',
            '18246': 'LUZERNE',
            '18247': 'LUZERNE',
            '18248': 'SCHUYLKILL',
            '18249': 'LUZERNE',
            '18250': 'CARBON',
            '18251': 'LUZERNE',
            '18252': 'SCHUYLKILL',
            '18254': 'CARBON',
            '18255': 'CARBON',
            '18256': 'LUZERNE',
            '18301': 'MONROE',
            '18302': 'MONROE',
            '18320': 'MONROE',
            '18321': 'MONROE',
            '18322': 'MONROE',
            '18323': 'MONROE',
            '18324': 'PIKE',
            '18325': 'MONROE',
            '18326': 'MONROE',
            '18327': 'MONROE',
            '18328': 'PIKE',
            '18330': 'MONROE',
            '18331': 'MONROE',
            '18332': 'MONROE',
            '18333': 'MONROE',
            '18334': 'MONROE',
            '18335': 'MONROE',
            '18336': 'PIKE',
            '18337': 'PIKE',
            '18340': 'PIKE',
            '18341': 'MONROE',
            '18342': 'MONROE',
            '18343': 'NORTHAMPTON',
            '18344': 'MONROE',
            '18346': 'MONROE',
            '18347': 'MONROE',
            '18348': 'MONROE',
            '18349': 'MONROE',
            '18350': 'MONROE',
            '18351': 'NORTHAMPTON',
            '18352': 'MONROE',
            '18353': 'MONROE',
            '18354': 'MONROE',
            '18355': 'MONROE',
            '18356': 'MONROE',
            '18357': 'MONROE',
            '18360': 'MONROE',
            '18370': 'MONROE',
            '18371': 'PIKE',
            '18372': 'MONROE',
            '18403': 'LACKAWANNA',
            '18405': 'WAYNE',
            '18407': 'LACKAWANNA',
            '18410': 'LACKAWANNA',
            '18411': 'LACKAWANNA',
            '18413': 'SUSQUEHANNA',
            '18414': 'LACKAWANNA',
            '18415': 'WAYNE',
            '18416': 'LACKAWANNA',
            '18417': 'WAYNE',
            '18419': 'WYOMING',
            '18420': 'LACKAWANNA',
            '18421': 'SUSQUEHANNA',
            '18424': 'LACKAWANNA',
            '18425': 'PIKE',
            '18426': 'PIKE',
            '18427': 'WAYNE',
            '18428': 'PIKE',
            '18430': 'SUSQUEHANNA',
            '18431': 'WAYNE',
            '18433': 'LACKAWANNA',
            '18434': 'LACKAWANNA',
            '18435': 'PIKE',
            '18436': 'WAYNE',
            '18437': 'WAYNE',
            '18438': 'WAYNE',
            '18439': 'WAYNE',
            '18440': 'LACKAWANNA',
            '18441': 'SUSQUEHANNA',
            '18443': 'WAYNE',
            '18444': 'LACKAWANNA',
            '18445': 'WAYNE',
            '18446': 'WYOMING',
            '18447': 'LACKAWANNA',
            '18449': 'WAYNE',
            '18451': 'PIKE',
            '18452': 'LACKAWANNA',
            '18453': 'WAYNE',
            '18454': 'WAYNE',
            '18455': 'WAYNE',
            '18456': 'WAYNE',
            '18457': 'PIKE',
            '18458': 'PIKE',
            '18459': 'WAYNE',
            '18460': 'WAYNE',
            '18461': 'WAYNE',
            '18462': 'WAYNE',
            '18463': 'WAYNE',
            '18464': 'PIKE',
            '18465': 'SUSQUEHANNA',
            '18466': 'MONROE',
            '18469': 'WAYNE',
            '18470': 'SUSQUEHANNA',
            '18471': 'LACKAWANNA',
            '18472': 'WAYNE',
            '18473': 'WAYNE',
            '18501': 'LACKAWANNA',
            '18502': 'LACKAWANNA',
            '18503': 'LACKAWANNA',
            '18504': 'LACKAWANNA',
            '18505': 'LACKAWANNA',
            '18507': 'LACKAWANNA',
            '18508': 'LACKAWANNA',
            '18509': 'LACKAWANNA',
            '18510': 'LACKAWANNA',
            '18512': 'LACKAWANNA',
            '18515': 'LACKAWANNA',
            '18517': 'LACKAWANNA',
            '18518': 'LACKAWANNA',
            '18519': 'LACKAWANNA',
            '18540': 'LACKAWANNA',
            '18577': 'LACKAWANNA',
            '18601': 'LUZERNE',
            '18602': 'LUZERNE',
            '18603': 'COLUMBIA',
            '18610': 'MONROE',
            '18611': 'LUZERNE',
            '18612': 'LUZERNE',
            '18614': 'SULLIVAN',
            '18615': 'WYOMING',
            '18616': 'SULLIVAN',
            '18617': 'LUZERNE',
            '18618': 'LUZERNE',
            '18619': 'SULLIVAN',
            '18621': 'LUZERNE',
            '18622': 'LUZERNE',
            '18623': 'WYOMING',
            '18624': 'CARBON',
            '18625': 'WYOMING',
            '18626': 'SULLIVAN',
            '18627': 'LUZERNE',
            '18628': 'SULLIVAN',
            '18629': 'WYOMING',
            '18630': 'SUSQUEHANNA',
            '18631': 'COLUMBIA',
            '18632': 'SULLIVAN',
            '18634': 'LUZERNE',
            '18635': 'LUZERNE',
            '18636': 'WYOMING',
            '18640': 'LUZERNE',
            '18641': 'LUZERNE',
            '18642': 'LUZERNE',
            '18643': 'LUZERNE',
            '18644': 'LUZERNE',
            '18651': 'LUZERNE',
            '18653': 'LACKAWANNA',
            '18654': 'LUZERNE',
            '18655': 'LUZERNE',
            '18656': 'LUZERNE',
            '18657': 'WYOMING',
            '18660': 'LUZERNE',
            '18661': 'LUZERNE',
            '18701': 'LUZERNE',
            '18702': 'LUZERNE',
            '18703': 'LUZERNE',
            '18704': 'LUZERNE',
            '18705': 'LUZERNE',
            '18706': 'LUZERNE',
            '18707': 'LUZERNE',
            '18708': 'LUZERNE',
            '18709': 'LUZERNE',
            '18710': 'LUZERNE',
            '18711': 'LUZERNE',
            '18762': 'LUZERNE',
            '18764': 'LUZERNE',
            '18765': 'LUZERNE',
            '18766': 'LUZERNE',
            '18767': 'LUZERNE',
            '18768': 'LUZERNE',
            '18769': 'LUZERNE',
            '18773': 'LUZERNE',
            '18801': 'SUSQUEHANNA',
            '18810': 'BRADFORD',
            '18812': 'SUSQUEHANNA',
            '18813': 'SUSQUEHANNA',
            '18814': 'BRADFORD',
            '18815': 'BRADFORD',
            '18816': 'SUSQUEHANNA',
            '18817': 'BRADFORD',
            '18818': 'SUSQUEHANNA',
            '18820': 'SUSQUEHANNA',
            '18821': 'SUSQUEHANNA',
            '18822': 'SUSQUEHANNA',
            '18823': 'SUSQUEHANNA',
            '18824': 'SUSQUEHANNA',
            '18825': 'SUSQUEHANNA',
            '18826': 'SUSQUEHANNA',
            '18827': 'SUSQUEHANNA',
            '18828': 'SUSQUEHANNA',
            '18829': 'BRADFORD',
            '18830': 'SUSQUEHANNA',
            '18831': 'BRADFORD',
            '18832': 'BRADFORD',
            '18833': 'BRADFORD',
            '18834': 'SUSQUEHANNA',
            '18837': 'BRADFORD',
            '18840': 'BRADFORD',
            '18842': 'SUSQUEHANNA',
            '18843': 'SUSQUEHANNA',
            '18844': 'SUSQUEHANNA',
            '18845': 'BRADFORD',
            '18846': 'BRADFORD',
            '18847': 'SUSQUEHANNA',
            '18848': 'BRADFORD',
            '18850': 'BRADFORD',
            '18851': 'BRADFORD',
            '18853': 'BRADFORD',
            '18854': 'BRADFORD',
            '18901': 'BUCKS',
            '18902': 'BUCKS',
            '18910': 'BUCKS',
            '18911': 'BUCKS',
            '18912': 'BUCKS',
            '18913': 'BUCKS',
            '18914': 'BUCKS',
            '18915': 'MONTGOMERY',
            '18916': 'BUCKS',
            '18917': 'BUCKS',
            '18918': 'MONTGOMERY',
            '18920': 'BUCKS',
            '18921': 'BUCKS',
            '18922': 'BUCKS',
            '18923': 'BUCKS',
            '18925': 'BUCKS',
            '18927': 'BUCKS',
            '18928': 'BUCKS',
            '18929': 'BUCKS',
            '18930': 'BUCKS',
            '18931': 'BUCKS',
            '18932': 'BUCKS',
            '18933': 'BUCKS',
            '18934': 'BUCKS',
            '18935': 'BUCKS',
            '18936': 'MONTGOMERY',
            '18938': 'BUCKS',
            '18940': 'BUCKS',
            '18942': 'BUCKS',
            '18943': 'BUCKS',
            '18944': 'BUCKS',
            '18946': 'BUCKS',
            '18947': 'BUCKS',
            '18949': 'BUCKS',
            '18950': 'BUCKS',
            '18951': 'BUCKS',
            '18953': 'BUCKS',
            '18954': 'BUCKS',
            '18955': 'BUCKS',
            '18956': 'BUCKS',
            '18957': 'MONTGOMERY',
            '18958': 'MONTGOMERY',
            '18960': 'BUCKS',
            '18962': 'BUCKS',
            '18963': 'BUCKS',
            '18964': 'MONTGOMERY',
            '18966': 'BUCKS',
            '18968': 'BUCKS',
            '18969': 'MONTGOMERY',
            '18970': 'BUCKS',
            '18971': 'MONTGOMERY',
            '18972': 'BUCKS',
            '18974': 'BUCKS',
            '18976': 'BUCKS',
            '18977': 'BUCKS',
            '18979': 'MONTGOMERY',
            '18980': 'BUCKS',
            '18981': 'BUCKS',
            '18991': 'BUCKS',
            '19001': 'MONTGOMERY',
            '19002': 'MONTGOMERY',
            '19003': 'MONTGOMERY',
            '19004': 'MONTGOMERY',
            '19006': 'MONTGOMERY',
            '19007': 'BUCKS',
            '19008': 'DELAWARE',
            '19009': 'MONTGOMERY',
            '19010': 'DELAWARE',
            '19012': 'MONTGOMERY',
            '19013': 'DELAWARE',
            '19014': 'DELAWARE',
            '19015': 'DELAWARE',
            '19016': 'DELAWARE',
            '19017': 'DELAWARE',
            '19018': 'DELAWARE',
            '19019': 'PHILADELPHIA',
            '19020': 'BUCKS',
            '19021': 'BUCKS',
            '19022': 'DELAWARE',
            '19023': 'DELAWARE',
            '19025': 'MONTGOMERY',
            '19026': 'DELAWARE',
            '19027': 'MONTGOMERY',
            '19028': 'DELAWARE',
            '19029': 'DELAWARE',
            '19030': 'BUCKS',
            '19031': 'MONTGOMERY',
            '19032': 'DELAWARE',
            '19033': 'DELAWARE',
            '19034': 'MONTGOMERY',
            '19035': 'MONTGOMERY',
            '19036': 'DELAWARE',
            '19037': 'DELAWARE',
            '19038': 'MONTGOMERY',
            '19039': 'DELAWARE',
            '19040': 'MONTGOMERY',
            '19041': 'MONTGOMERY',
            '19043': 'DELAWARE',
            '19044': 'MONTGOMERY',
            '19046': 'MONTGOMERY',
            '19047': 'BUCKS',
            '19048': 'BUCKS',
            '19049': 'BUCKS',
            '19050': 'DELAWARE',
            '19052': 'DELAWARE',
            '19053': 'BUCKS',
            '19054': 'BUCKS',
            '19055': 'BUCKS',
            '19056': 'BUCKS',
            '19057': 'BUCKS',
            '19058': 'BUCKS',
            '19060': 'DELAWARE',
            '19061': 'DELAWARE',
            '19063': 'DELAWARE',
            '19064': 'DELAWARE',
            '19065': 'DELAWARE',
            '19066': 'MONTGOMERY',
            '19067': 'BUCKS',
            '19070': 'DELAWARE',
            '19072': 'MONTGOMERY',
            '19073': 'DELAWARE',
            '19074': 'DELAWARE',
            '19075': 'MONTGOMERY',
            '19076': 'DELAWARE',
            '19078': 'DELAWARE',
            '19079': 'DELAWARE',
            '19081': 'DELAWARE',
            '19082': 'DELAWARE',
            '19083': 'DELAWARE',
            '19085': 'DELAWARE',
            '19086': 'DELAWARE',
            '19087': 'DELAWARE',
            '19090': 'MONTGOMERY',
            '19091': 'DELAWARE',
            '19092': 'PHILADELPHIA',
            '19093': 'PHILADELPHIA',
            '19094': 'DELAWARE',
            '19095': 'MONTGOMERY',
            '19096': 'MONTGOMERY',
            '19101': 'PHILADELPHIA',
            '19102': 'PHILADELPHIA',
            '19103': 'PHILADELPHIA',
            '19104': 'PHILADELPHIA',
            '19105': 'PHILADELPHIA',
            '19106': 'PHILADELPHIA',
            '19107': 'PHILADELPHIA',
            '19108': 'PHILADELPHIA',
            '19109': 'PHILADELPHIA',
            '19110': 'PHILADELPHIA',
            '19111': 'PHILADELPHIA',
            '19112': 'PHILADELPHIA',
            '19113': 'DELAWARE',
            '19114': 'PHILADELPHIA',
            '19115': 'PHILADELPHIA',
            '19116': 'PHILADELPHIA',
            '19118': 'PHILADELPHIA',
            '19119': 'PHILADELPHIA',
            '19120': 'PHILADELPHIA',
            '19121': 'PHILADELPHIA',
            '19122': 'PHILADELPHIA',
            '19123': 'PHILADELPHIA',
            '19124': 'PHILADELPHIA',
            '19125': 'PHILADELPHIA',
            '19126': 'PHILADELPHIA',
            '19127': 'PHILADELPHIA',
            '19128': 'PHILADELPHIA',
            '19129': 'PHILADELPHIA',
            '19130': 'PHILADELPHIA',
            '19131': 'PHILADELPHIA',
            '19132': 'PHILADELPHIA',
            '19133': 'PHILADELPHIA',
            '19134': 'PHILADELPHIA',
            '19135': 'PHILADELPHIA',
            '19136': 'PHILADELPHIA',
            '19137': 'PHILADELPHIA',
            '19138': 'PHILADELPHIA',
            '19139': 'PHILADELPHIA',
            '19140': 'PHILADELPHIA',
            '19141': 'PHILADELPHIA',
            '19142': 'PHILADELPHIA',
            '19143': 'PHILADELPHIA',
            '19144': 'PHILADELPHIA',
            '19145': 'PHILADELPHIA',
            '19146': 'PHILADELPHIA',
            '19147': 'PHILADELPHIA',
            '19148': 'PHILADELPHIA',
            '19149': 'PHILADELPHIA',
            '19150': 'PHILADELPHIA',
            '19151': 'PHILADELPHIA',
            '19152': 'PHILADELPHIA',
            '19153': 'PHILADELPHIA',
            '19154': 'PHILADELPHIA',
            '19155': 'PHILADELPHIA',
            '19160': 'PHILADELPHIA',
            '19161': 'PHILADELPHIA',
            '19162': 'PHILADELPHIA',
            '19170': 'PHILADELPHIA',
            '19171': 'PHILADELPHIA',
            '19172': 'PHILADELPHIA',
            '19173': 'PHILADELPHIA',
            '19175': 'PHILADELPHIA',
            '19176': 'PHILADELPHIA',
            '19177': 'PHILADELPHIA',
            '19178': 'PHILADELPHIA',
            '19179': 'PHILADELPHIA',
            '19181': 'PHILADELPHIA',
            '19182': 'PHILADELPHIA',
            '19183': 'PHILADELPHIA',
            '19184': 'PHILADELPHIA',
            '19185': 'PHILADELPHIA',
            '19187': 'PHILADELPHIA',
            '19188': 'PHILADELPHIA',
            '19190': 'PHILADELPHIA',
            '19191': 'PHILADELPHIA',
            '19192': 'PHILADELPHIA',
            '19193': 'PHILADELPHIA',
            '19194': 'PHILADELPHIA',
            '19195': 'PHILADELPHIA',
            '19196': 'PHILADELPHIA',
            '19197': 'PHILADELPHIA',
            '19244': 'PHILADELPHIA',
            '19255': 'PHILADELPHIA',
            '19301': 'CHESTER',
            '19310': 'CHESTER',
            '19311': 'CHESTER',
            '19312': 'CHESTER',
            '19316': 'CHESTER',
            '19317': 'DELAWARE',
            '19318': 'CHESTER',
            '19319': 'DELAWARE',
            '19320': 'CHESTER',
            '19330': 'CHESTER',
            '19331': 'DELAWARE',
            '19333': 'CHESTER',
            '19335': 'CHESTER',
            '19339': 'DELAWARE',
            '19340': 'DELAWARE',
            '19341': 'CHESTER',
            '19342': 'DELAWARE',
            '19343': 'CHESTER',
            '19344': 'CHESTER',
            '19345': 'CHESTER',
            '19346': 'CHESTER',
            '19347': 'CHESTER',
            '19348': 'CHESTER',
            '19350': 'CHESTER',
            '19351': 'CHESTER',
            '19352': 'CHESTER',
            '19353': 'CHESTER',
            '19354': 'CHESTER',
            '19355': 'CHESTER',
            '19357': 'CHESTER',
            '19358': 'CHESTER',
            '19360': 'CHESTER',
            '19362': 'CHESTER',
            '19363': 'CHESTER',
            '19365': 'CHESTER',
            '19366': 'CHESTER',
            '19367': 'CHESTER',
            '19369': 'CHESTER',
            '19372': 'CHESTER',
            '19373': 'DELAWARE',
            '19374': 'CHESTER',
            '19375': 'CHESTER',
            '19376': 'CHESTER',
            '19380': 'CHESTER',
            '19381': 'CHESTER',
            '19382': 'CHESTER',
            '19383': 'CHESTER',
            '19390': 'CHESTER',
            '19395': 'CHESTER',
            '19397': 'CHESTER',
            '19398': 'CHESTER',
            '19399': 'CHESTER',
            '19401': 'MONTGOMERY',
            '19403': 'MONTGOMERY',
            '19404': 'MONTGOMERY',
            '19405': 'MONTGOMERY',
            '19406': 'MONTGOMERY',
            '19407': 'MONTGOMERY',
            '19408': 'MONTGOMERY',
            '19409': 'MONTGOMERY',
            '19415': 'MONTGOMERY',
            '19421': 'CHESTER',
            '19422': 'MONTGOMERY',
            '19423': 'MONTGOMERY',
            '19424': 'MONTGOMERY',
            '19425': 'CHESTER',
            '19426': 'MONTGOMERY',
            '19428': 'MONTGOMERY',
            '19429': 'MONTGOMERY',
            '19430': 'MONTGOMERY',
            '19432': 'CHESTER',
            '19435': 'MONTGOMERY',
            '19436': 'MONTGOMERY',
            '19437': 'MONTGOMERY',
            '19438': 'MONTGOMERY',
            '19440': 'MONTGOMERY',
            '19441': 'MONTGOMERY',
            '19442': 'CHESTER',
            '19443': 'MONTGOMERY',
            '19444': 'MONTGOMERY',
            '19446': 'MONTGOMERY',
            '19450': 'MONTGOMERY',
            '19451': 'MONTGOMERY',
            '19453': 'MONTGOMERY',
            '19454': 'MONTGOMERY',
            '19455': 'MONTGOMERY',
            '19456': 'MONTGOMERY',
            '19457': 'CHESTER',
            '19460': 'CHESTER',
            '19462': 'MONTGOMERY',
            '19464': 'MONTGOMERY',
            '19465': 'CHESTER',
            '19468': 'MONTGOMERY',
            '19470': 'CHESTER',
            '19472': 'MONTGOMERY',
            '19473': 'MONTGOMERY',
            '19474': 'MONTGOMERY',
            '19475': 'CHESTER',
            '19477': 'MONTGOMERY',
            '19478': 'MONTGOMERY',
            '19480': 'CHESTER',
            '19481': 'CHESTER',
            '19482': 'CHESTER',
            '19484': 'MONTGOMERY',
            '19486': 'MONTGOMERY',
            '19490': 'MONTGOMERY',
            '19492': 'MONTGOMERY',
            '19493': 'CHESTER',
            '19494': 'CHESTER',
            '19495': 'CHESTER',
            '19496': 'CHESTER',
            '19501': 'LANCASTER',
            '19503': 'BERKS',
            '19504': 'BERKS',
            '19505': 'BERKS',
            '19506': 'BERKS',
            '19507': 'BERKS',
            '19508': 'BERKS',
            '19510': 'BERKS',
            '19511': 'BERKS',
            '19512': 'BERKS',
            '19516': 'BERKS',
            '19518': 'BERKS',
            '19519': 'BERKS',
            '19520': 'CHESTER',
            '19522': 'BERKS',
            '19523': 'BERKS',
            '19525': 'MONTGOMERY',
            '19526': 'BERKS',
            '19529': 'BERKS',
            '19530': 'BERKS',
            '19533': 'BERKS',
            '19534': 'BERKS',
            '19535': 'BERKS',
            '19536': 'BERKS',
            '19538': 'BERKS',
            '19539': 'BERKS',
            '19540': 'BERKS',
            '19541': 'BERKS',
            '19543': 'BERKS',
            '19544': 'BERKS',
            '19545': 'BERKS',
            '19547': 'BERKS',
            '19548': 'BERKS',
            '19549': 'SCHUYLKILL',
            '19550': 'BERKS',
            '19551': 'BERKS',
            '19554': 'BERKS',
            '19555': 'BERKS',
            '19559': 'BERKS',
            '19560': 'BERKS',
            '19562': 'BERKS',
            '19564': 'BERKS',
            '19565': 'BERKS',
            '19567': 'BERKS',
            '19601': 'BERKS',
            '19602': 'BERKS',
            '19603': 'BERKS',
            '19604': 'BERKS',
            '19605': 'BERKS',
            '19606': 'BERKS',
            '19607': 'BERKS',
            '19608': 'BERKS',
            '19609': 'BERKS',
            '19610': 'BERKS',
            '19611': 'BERKS',
            '19612': 'BERKS'
            };

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