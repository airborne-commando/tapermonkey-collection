// ==UserScript==
// @name         PA Voter Registration Bulk Checker
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Bulk check voter registration status in PA with complete ZIP code mapping
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
                '16507': 'ERIE',
                '19103': 'PHILADELPHIA',
                '19102': 'PHILADELPHIA',
                '15217': 'ALLEGHENY',
                '15222': 'ALLEGHENY',
                '16801': 'CENTRE',
                '16802': 'CENTRE',
                '16803': 'CENTRE',
                '17013': 'CUMBERLAND',
                '17015': 'CUMBERLAND',
                '17050': 'CUMBERLAND',
                '17055': 'CUMBERLAND',
                '18015': 'NORTHAMPTON',
                '18016': 'NORTHAMPTON',
                '18017': 'NORTHAMPTON',
                '18018': 'NORTHAMPTON',
                // Added ZIP codes from your list
                // Add more zips if missingm, perhaps add a database?
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
                '16505': 'ERIE',
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