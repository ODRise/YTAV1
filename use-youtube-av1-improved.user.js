// ==UserScript==
// @name         Use YouTube AV1 (Improved)
// @description  Enhanced AV1 codec enablement for YouTube with better reliability and configuration
// @version      3.1.1
// @author       RM
// @homepageURL  https://github.com/ODRise/YTAV1
// @match        *://*.www.youtube.com/*
// @match        *://*.youtube-nocookie.com/embed/*
// @exclude      *://music.www.youtube.com/*
// @exclude      *://studio.www.youtube.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_notification
// @run-at       document-start
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/ODRise/YTAV1/main/use-youtube-av1-improved.user.js
// @updateURL    https://raw.githubusercontent.com/ODRise/YTAV1/main/use-youtube-av1-improved.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ===============================
    // CONSTANTS & CONFIGURATION
    // ===============================
    const CONFIG = {
        SCRIPT_NAME: 'Use YouTube AV1 (Improved)', // More specific name
        AV1_PREF_VALUE: '8192',
        AV1_PREF_KEY: 'yt-player-av1-pref',
        DEFAULT_SETTINGS: { // Added for menu and logger
            debug: false,
            enableOverrides: true, // New setting to toggle format overrides
            enableExperimentFlags: true // New setting to toggle experiment flag changes
        },
        TIMERS: {
            FLAG_CHECK_INTERVAL: 1000,
            MUTATION_DELAY: 100,
            INITIALIZATION_TIMEOUT: 5000,
            CAPABILITY_TEST_TIMEOUT: 3000
        },
        AV1_TEST_CONFIGS: [
            {
                name: 'AV1 Main Profile',
                video: { contentType: 'video/mp4; codecs="av01.0.05M.08"', width: 1920, height: 1080, bitrate: 2826848, framerate: 30 }
            },
            {
                name: 'AV1 High Profile',
                video: { contentType: 'video/mp4; codecs="av01.0.08M.08"', width: 3840, height: 2160, bitrate: 8000000, framerate: 60 }
            }
        ],
        EXPERIMENT_FLAGS: {
            html5_disable_av1_hdr: false,
            html5_prefer_hbr_vp9_over_av1: false,
            html5_account_onesie_format_selection_during_format_filter: false,
            html5_max_av1_fps: 120,
            html5_subsegment_readahead_load_speed_check_native: true
        },
        DEBUG_LEVELS: { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 } // Kept from original script
    };

    // ===============================
    // UTILITY FUNCTIONS (for version comparison)
    // ===============================
    function compareVersions(v1, v2) {
        const parts1 = String(v1).split('.').map(Number);
        const parts2 = String(v2).split('.').map(Number);
        const len = Math.max(parts1.length, parts2.length);
        for (let i = 0; i < len; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    }

    // ===============================
    // UTILITY CLASSES (Logger, Timer from original script)
    // ===============================
    class Logger {
        constructor(name, level = CONFIG.DEBUG_LEVELS.INFO, settingsManager) {
            this.name = name;
            this.level = level;
            this.settingsManager = settingsManager; // For dynamic debug state
            this._updateMethods(); // Initial setup
        }

        _updateMethods() {
            const isDebugEnabled = this.settingsManager ? this.settingsManager.get('debug') : (this.level >= CONFIG.DEBUG_LEVELS.DEBUG);
            const currentLevel = isDebugEnabled ? CONFIG.DEBUG_LEVELS.DEBUG : this.level;

            const methods = {};
            const levels = ['error', 'warn', 'info', 'debug'];

            levels.forEach((methodName, index) => {
                methods[methodName] = currentLevel >= index
                    ? (...args) => console[methodName](`[${this.name}]`, ...args)
                    : () => {};
            });
            this.enabledMethods = methods;
        }

        error(...args) { this.enabledMethods.error(...args); }
        warn(...args) { this.enabledMethods.warn(...args); }
        info(...args) { this.enabledMethods.info(...args); }
        debug(...args) { this.enabledMethods.debug(...args); }

        setLevel(level) { // Kept if direct level setting is needed
            this.level = level;
            this._updateMethods();
        }

        refreshDebugState() { // Call when debug setting changes
            this._updateMethods();
        }
    }

    class Timer { // (Kept from original script, unchanged)
        constructor() { this.timers = new Set(); }
        setTimeout(cb, d) { const id = setTimeout(() => { this.timers.delete(id); cb(); }, d); this.timers.add(id); return id; }
        setInterval(cb, i) { const id = setInterval(cb, i); this.timers.add(id); return id; }
        clearTimeout(id) { clearTimeout(id); this.timers.delete(id); }
        clearInterval(id) { clearInterval(id); this.timers.delete(id); }
        clearAll() { this.timers.forEach(id => { clearTimeout(id); clearInterval(id); }); this.timers.clear(); }
    }

    // ===============================
    // NEW: SETTINGS MANAGEMENT
    // ===============================
    class SettingsManager {
        constructor(logger) {
            this.logger = logger; // Logger will be passed later
            this.settings = { ...CONFIG.DEFAULT_SETTINGS };
            this.useCompatibilityMode = typeof GM === 'undefined' || typeof GM.getValue === 'undefined';
        }

        async loadSettings() {
            try {
                const getValue = this.useCompatibilityMode ? GM_getValue : GM.getValue;
                const stored = await getValue('av1EnablerSettings', JSON.stringify(CONFIG.DEFAULT_SETTINGS));
                const parsed = JSON.parse(stored);
                this.settings = { ...CONFIG.DEFAULT_SETTINGS, ...parsed };

                ['debug', 'enableOverrides', 'enableExperimentFlags'].forEach(key => {
                    if (typeof this.settings[key] !== 'boolean') {
                        this.logger?.warn(`Invalid type for setting ${key}, reverting to default.`);
                        this.settings[key] = CONFIG.DEFAULT_SETTINGS[key];
                    }
                });

                await this.saveSettings(); // Save after potential validation
                this.logger?.debug(`Settings loaded: ${JSON.stringify(this.settings)}`);
                return this.settings;
            } catch (error) {
                this.logger?.error(`Failed to load settings: ${error.message}. Using default settings.`);
                this.settings = { ...CONFIG.DEFAULT_SETTINGS };
                return this.settings;
            }
        }

        async saveSettings() {
            try {
                const setValue = this.useCompatibilityMode ? GM_setValue : GM.setValue;
                await setValue('av1EnablerSettings', JSON.stringify(this.settings));
                this.logger?.debug('Settings saved successfully');
            } catch (error) {
                this.logger?.error(`Failed to save settings: ${error.message}`);
            }
        }

        async updateSetting(key, value) {
            if (this.settings.hasOwnProperty(key)) {
                this.settings[key] = value;
                await this.saveSettings();
                this.logger?.info(`Setting updated: ${key} = ${value}`);
            } else {
                this.logger?.warn(`Attempted to update non-existent setting: ${key}`);
            }
        }
        get(key) { return this.settings.hasOwnProperty(key) ? this.settings[key] : undefined; }
    }


    // ===============================
    // CORE CLASSES (AV1Detector, FormatOverride, PreferenceManager, ExperimentManager from original script)
    // Minor modifications for settings integration
    // ===============================
    class AV1Detector { // (Kept from original script, mostly unchanged)
        constructor(logger) { this.logger = logger; this.supportCache = new Map(); }
        isAV1Type(type) {
            if (typeof type !== 'string' || !type.startsWith('video/')) return false;
            if (this.supportCache.has(type)) return this.supportCache.get(type);
            const isAV1 = (type.includes('av01') && /codecs[\x20-\x7F]*["']?[^"']*\bav01\b/.test(type)) ||
                          (type.includes('av1') && /codecs[\x20-\x7F]*["']?[^"']*\bav1\b/.test(type));
            this.supportCache.set(type, isAV1); return isAV1;
        }
        async testAV1Support() { /* ... (content from original script, unchanged) ... */
            const results = { mediaCapabilities: null, videoElement: null, mediaSource: null, overall: false };
            if (navigator.mediaCapabilities?.decodingInfo) {
                try { results.mediaCapabilities = await this._testMediaCapabilities(); this.logger.debug('Media Capabilities test:', results.mediaCapabilities); }
                catch (error) { this.logger.warn('Media Capabilities test failed:', error.message); }
            }
            results.videoElement = this._testVideoElement(); this.logger.debug('Video Element test:', results.videoElement);
            results.mediaSource = this._testMediaSource(); this.logger.debug('MediaSource test:', results.mediaSource);
            results.overall = results.mediaCapabilities?.supported || results.videoElement || results.mediaSource;
            this.logger.info('AV1 Support Summary:', results); return results;
        }
        async _testMediaCapabilities() { /* ... (content from original script, unchanged) ... */
            const results = [];
            for (const config of CONFIG.AV1_TEST_CONFIGS) {
                try {
                    const testConfig = { type: 'file', video: config.video, audio: { contentType: 'audio/webm; codecs=opus', channels: '2', samplerate: 48000, bitrate: 128000 }};
                    const result = await Promise.race([ navigator.mediaCapabilities.decodingInfo(testConfig), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), CONFIG.TIMERS.CAPABILITY_TEST_TIMEOUT)) ]);
                    results.push({ config: config.name, supported: result.supported, smooth: result.smooth, powerEfficient: result.powerEfficient });
                } catch (error) { this.logger.debug(`Failed to test ${config.name}:`, error.message); results.push({ config: config.name, supported: false, error: error.message }); }
            }
            return { supported: results.some(r => r.supported), smooth: results.some(r => r.smooth), powerEfficient: results.some(r => r.powerEfficient), details: results };
        }
        _testVideoElement() { /* ... (content from original script, unchanged) ... */
            try { const v = document.createElement('video'); const t = ['video/mp4; codecs="av01.0.05M.08"', 'video/webm; codecs="av01.0.05M.08"']; return t.some(type => { const s = v.canPlayType(type); return s==='probably'||s==='maybe';}); }
            catch(e){ this.logger.debug('Video element test failed:', e.message); return false; }
        }
        _testMediaSource() { /* ... (content from original script, unchanged) ... */
             try { if(!window.MediaSource?.isTypeSupported) return false; const t = ['video/mp4; codecs="av01.0.05M.08"', 'video/webm; codecs="av01.0.05M.08"']; return t.some(type => MediaSource.isTypeSupported(type));}
             catch(e){ this.logger.debug('MediaSource test failed:', e.message); return false; }
        }
    }

    class FormatOverride {
        constructor(logger, detector, settingsManager) { // Added settingsManager
            this.logger = logger;
            this.detector = detector;
            this.settingsManager = settingsManager;
            this.originalMethods = {};
        }
        installOverrides() {
            if (!this.settingsManager.get('enableOverrides')) {
                this.logger.info('Format overrides disabled by settings.');
                return false;
            }
            try { /* ... (content from original script, with this.originalMethods.canPlayType = videoProto.canPlayType.bind(videoProto) etc for correct context if needed) ... */
                this._overrideVideoElement(); this._overrideMediaSource(); this.logger.info('Format overrides installed successfully'); return true;
            } catch (error) { this.logger.error('Failed to install format overrides:', error); return false;}
        }
        _overrideVideoElement() { /* ... (content from original script) ... */
            const videoProto = HTMLVideoElement?.prototype; if(!videoProto?.canPlayType) return;
            this.originalMethods.canPlayType = videoProto.canPlayType;
            videoProto.canPlayType = this._createEnhancedTypeChecker(this.originalMethods.canPlayType, true).bind(videoProto); // Bind context
            this.logger.debug('HTMLVideoElement.canPlayType overridden');
        }
        _overrideMediaSource() { /* ... (content from original script) ... */
            const mediaSource = window.MediaSource; if(!mediaSource?.isTypeSupported) return;
            this.originalMethods.isTypeSupported = mediaSource.isTypeSupported;
            mediaSource.isTypeSupported = this._createEnhancedTypeChecker(this.originalMethods.isTypeSupported, false);
            this.logger.debug('MediaSource.isTypeSupported overridden');
        }
        _createEnhancedTypeChecker(originalMethod, returnProbability = false) { /* ... (content from original script) ... */
            return (type) => {
                if (type === undefined) return returnProbability ? '' : false;
                const isAV1 = this.detector.isAV1Type(type); let result;
                if (isAV1) { result = true; this.logger.debug(`AV1 type detected and supported: ${type}`);}
                else { try { result = originalMethod.call(this, type); } catch (error) { this.logger.warn('Original type checker failed:', error.message); result = false; } }
                if (returnProbability) result = result ? 'probably' : '';
                this.logger.debug(`Type check: ${type} → ${result}`); return result;
            };
        }
        restore() { /* ... (content from original script) ... */
            if (!this.settingsManager.get('enableOverrides') && Object.keys(this.originalMethods).length === 0) {
                return; // No overrides were installed, or they are disabled now, so nothing to restore.
            }
            try {
                if (this.originalMethods.canPlayType) HTMLVideoElement.prototype.canPlayType = this.originalMethods.canPlayType;
                if (this.originalMethods.isTypeSupported) MediaSource.isTypeSupported = this.originalMethods.isTypeSupported;
                this.logger.debug('Format overrides restored');
                this.originalMethods = {}; // Clear stored methods after restoring
            } catch(e) {this.logger.warn('Failed to restore original methods:', e.message);}
        }
    }

    class PreferenceManager { // (Kept from original script, mostly unchanged)
        constructor(logger) { this.logger = logger; this.isConfigured = false; }
        configureAV1Preference() { /* ... (content from original script) ... */
            try {
                if (this._setupPropertyDescriptor()) { this.logger.debug('AV1 preference configured via property descriptor'); this.isConfigured = true; return true; }
                if (this._setupDirectAssignment()) { this.logger.debug('AV1 preference configured via direct assignment'); this.isConfigured = true; return true; }
                return false;
            } catch (e) { this.logger.error('Failed to configure AV1 preference:', e); return false; }
        }
        _setupPropertyDescriptor() { /* ... (content from original script) ... */
            try {
                Object.defineProperty(Storage.prototype, CONFIG.AV1_PREF_KEY, {
                    get: () => CONFIG.AV1_PREF_VALUE,
                    set: () => true, // Allow setting but always return our preferred value
                    enumerable: false, configurable: true
                });
                return localStorage[CONFIG.AV1_PREF_KEY] === CONFIG.AV1_PREF_VALUE;
            } catch (e) { this.logger.debug('Property descriptor method failed:', e.message); return false; }
        }
        _setupDirectAssignment() { /* ... (content from original script) ... */
             try {
                localStorage.setItem(CONFIG.AV1_PREF_KEY, CONFIG.AV1_PREF_VALUE);
                const originalGetItem = localStorage.getItem.bind(localStorage);
                localStorage.getItem = function(key) { if (key === CONFIG.AV1_PREF_KEY) return CONFIG.AV1_PREF_VALUE; return originalGetItem(key); };
                return localStorage.getItem(CONFIG.AV1_PREF_KEY) === CONFIG.AV1_PREF_VALUE;
            } catch (e) { this.logger.debug('Direct assignment method failed:', e.message); return false; }
        }
        verifyConfiguration() { /* ... (content from original script) ... */
            try { const c = localStorage[CONFIG.AV1_PREF_KEY]; const i = c === CONFIG.AV1_PREF_VALUE; this.logger.debug(`AV1 preference verification: ${c} (expected: ${CONFIG.AV1_PREF_VALUE})`); return i;}
            catch(e){ this.logger.warn('Could not verify AV1 preference:', e.message); return false;}
        }
    }

    class ExperimentManager {
        constructor(logger, timer, settingsManager) { // Added settingsManager
            this.logger = logger;
            this.timer = timer;
            this.settingsManager = settingsManager;
            this.observer = null;
            this.intervalId = null;
        }
        configureExperimentFlags() {
             if (!this.settingsManager.get('enableExperimentFlags')) {
                this.logger.info('Experiment flag modification disabled by settings.');
                this.stop(); // Ensure it's stopped if previously running
                return;
            }
            /* ... (content from original script, unchanged logic but calls this.stop() if disabled) ... */
            let isFirstRun = true;
            const processFlags = () => {
                const ytConfig = window.ytcfg?.data_; if (!ytConfig) return;
                const wasFirstRun = isFirstRun; isFirstRun = false; let flagsModified = 0;
                [ytConfig.EXPERIMENT_FLAGS, ytConfig.EXPERIMENTS_FORCED_FLAGS].filter(Boolean).forEach(flags => {
                    Object.entries(CONFIG.EXPERIMENT_FLAGS).forEach(([key, value]) => {
                        if (flags.hasOwnProperty(key) && flags[key] !== value) { flags[key] = value; flagsModified++; }
                    });
                });
                if (flagsModified > 0) this.logger.debug(`Modified ${flagsModified} experiment flags`);
                if (wasFirstRun && flagsModified > 0) this._setupMutationObserver();
            };
            if(this.intervalId) this.timer.clearInterval(this.intervalId); // Clear previous before starting new
            this.intervalId = this.timer.setInterval(processFlags, CONFIG.TIMERS.FLAG_CHECK_INTERVAL);
            this.logger.debug('Experiment flag monitoring started');
        }
        _setupMutationObserver() { /* ... (content from original script) ... */
            if (this.observer) return;
            this.observer = new MutationObserver(() => {
                this.observer.disconnect(); this.observer = null;
                this.timer.setTimeout(() => {
                    if (this.intervalId) { this.timer.clearInterval(this.intervalId); this.intervalId = null; }
                    this.configureExperimentFlags(); // Re-call to ensure it checks settings again
                }, CONFIG.TIMERS.MUTATION_DELAY);
            });
            this.observer.observe(document, { subtree: true, childList: true });
            this.logger.debug('Mutation observer configured for experiment flags');
        }
        stop() { /* ... (content from original script) ... */
            if (this.intervalId) { this.timer.clearInterval(this.intervalId); this.intervalId = null; }
            if (this.observer) { this.observer.disconnect(); this.observer = null; }
            this.logger.debug('Experiment flag monitoring stopped');
        }
    }

    // ===============================
    // NEW: MENU MANAGER
    // ===============================
    class MenuManager {
        constructor(settingsManager, mainApp) {
            this.settingsManager = settingsManager;
            this.mainApp = mainApp;
            this.logger = mainApp.logger; // Use main app's logger
            this.menuIds = [];
            this.registerMenuCommand = (typeof GM !== 'undefined' && GM.registerMenuCommand) ?
                                      GM.registerMenuCommand : (typeof GM_registerMenuCommand !== 'undefined' ? GM_registerMenuCommand : null);
        }

        createMenus() {
            if (!this.registerMenuCommand) {
                this.logger.warn("GM_registerMenuCommand or GM.registerMenuCommand not available. Menus not created.");
                return;
            }
            this.menuIds.forEach(id => { // Attempt to unregister old ones, may not work with all managers
                try { GM.unregisterMenuCommand?.(id); } catch(e){}
            });
            this.menuIds = [];

            const menuItems = [
                {
                    key: 'enableOverrides', label: 'Enable Format Overrides',
                    callback: (newValue) => {
                        if (newValue) this.mainApp.formatOverride.installOverrides();
                        else this.mainApp.formatOverride.restore();
                        this.logger.info(`Format Overrides ${newValue ? 'enabled' : 'disabled'}. Page refresh may be needed.`);
                    }
                },
                {
                    key: 'enableExperimentFlags', label: 'Enable Experiment Flag Changes',
                    callback: (newValue) => {
                        this.mainApp.experimentManager.configureExperimentFlags(); // This will stop if newValue is false
                        this.logger.info(`Experiment Flag Changes ${newValue ? 'enabled' : 'disabled'}.`);
                    }
                },
                {
                    key: 'debug', label: 'Debug Mode',
                    callback: (newValue) => {
                        this.mainApp.logger.refreshDebugState(); // Refresh logger's own state
                        this.logger.info(`Debug mode ${newValue ? 'enabled' : 'disabled'}`);
                    }
                }
            ];

            menuItems.forEach(({ key, label, callback }) => {
                const isEnabled = this.settingsManager.get(key);
                const menuLabel = `${isEnabled ? '✅' : '⚪'} ${label}`;
                const menuId = this.registerMenuCommand(menuLabel, async () => {
                    const currentValue = this.settingsManager.get(key);
                    const newValue = !currentValue;
                    await this.settingsManager.updateSetting(key, newValue);
                    callback(newValue);
                    this.refreshMenuLabels();
                });
                this.menuIds.push(menuId);
            });

            this.menuIds.push(this.registerMenuCommand('─ Script Updates ─', () => {}));
            this.menuIds.push(this.registerMenuCommand('Check for Updates', () => this.mainApp.checkForUpdates()));
            this.logger.debug("Menus created/updated.");
        }
        refreshMenuLabels() { this.logger.debug("Menu label refresh requested. Actual update requires script/page reload.");}
    }


    // ===============================
    // MAIN APPLICATION CLASS
    // ===============================
    class YouTubeAV1Enabler {
        constructor() {
            // Initialize SettingsManager first as Logger depends on it for debug state
            this.settingsManager = new SettingsManager(null); // Logger will be set post-init for settingsManager itself
            this.logger = new Logger(CONFIG.SCRIPT_NAME, CONFIG.DEBUG_LEVELS.INFO, this.settingsManager);
            this.settingsManager.logger = this.logger; // Assign logger to settingsManager

            this.timer = new Timer();
            this.detector = new AV1Detector(this.logger);
            this.formatOverride = new FormatOverride(this.logger, this.detector, this.settingsManager);
            this.preferenceManager = new PreferenceManager(this.logger);
            this.experimentManager = new ExperimentManager(this.logger, this.timer, this.settingsManager);
            this.menuManager = new MenuManager(this.settingsManager, this); // `this` is mainApp

            this.isInitialized = false;
            this.supportResults = null;
        }

        async initialize() {
            await this.settingsManager.loadSettings(); // Load settings before anything else
            this.logger.refreshDebugState(); // Ensure logger reflects loaded debug state

            this.logger.debug('Starting initialization...');
            this.menuManager.createMenus(); // Create menus after settings are loaded

            try {
                this.supportResults = await this.detector.testAV1Support();
                if (this.supportResults.overall) {
                    this.logger.info('AV1 support detected, enabling optimizations...');
                    await this._enableAV1Optimizations();
                } else {
                    this.logger.warn('Limited AV1 support detected, applying basic configuration...');
                    await this._enableBasicAV1();
                }
                this.isInitialized = true;
                this._reportStatus();
            } catch (error) {
                this.logger.error('Initialization failed:', error);
                await this._fallbackInitialization();
            }
        }

        async _enableAV1Optimizations() {
            if (!this.preferenceManager.configureAV1Preference()) {
                this.logger.warn('Failed to configure AV1 preferences (optimistic continuation).');
            }
            // Install/restore format overrides based on settings
            if (this.settingsManager.get('enableOverrides')) this.formatOverride.installOverrides();
            else this.formatOverride.restore();

            // Configure experiment flags based on settings
            this.experimentManager.configureExperimentFlags(); // This checks internal setting

            this.logger.info('AV1 optimizations configured based on settings.');
        }
        async _enableBasicAV1() { /* ... (content from original script) ... */
             if (this.preferenceManager.configureAV1Preference()) this.logger.info('Basic AV1 configuration applied');
             else throw new Error('Failed to apply basic AV1 configuration');
        }
        async _fallbackInitialization() { /* ... (content from original script) ... */
            this.logger.warn('Attempting fallback initialization...');
            try { this.preferenceManager.configureAV1Preference(); this.logger.info('Fallback AV1 configuration applied');}
            catch(e){this.logger.error('Fallback initialization also failed:', e);}
        }
        _reportStatus() { /* ... (content from original script) ... */
            const isConfigured = this.preferenceManager.verifyConfiguration();
            const message = isConfigured ? 'AV1 codec preference enabled - YouTube will prioritize AV1 when available' : 'AV1 configuration may not have taken effect properly';
            this.logger.info(message);
            if(this.supportResults) this.logger.info('Support summary:', { mediaCapabilities: this.supportResults.mediaCapabilities?.supported||false, videoElement: this.supportResults.videoElement||false, mediaSource: this.supportResults.mediaSource||false });
        }
        cleanup() { /* ... (content from original script) ... */
            this.experimentManager.stop(); this.formatOverride.restore(); this.timer.clearAll(); this.logger.debug('Cleanup completed');
        }
        getStatus() { /* ... (content from original script) ... */
            return { initialized: this.isInitialized, preferenceConfigured: this.preferenceManager.isConfigured, settings: this.settingsManager.settings, supportResults: this.supportResults };
        }

        // NEW: Update Checker
        async checkForUpdates() {
            this.logger.log('Checking for script updates...');
            const scriptInfo = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script : null;
            if (!scriptInfo || !scriptInfo.version || !scriptInfo.updateURL) {
                const msg = 'Script metadata (version/updateURL) not available via GM_info. Cannot check for updates.';
                this.logger.error(msg);
                if (typeof GM_notification === 'function') GM_notification({ text: msg, title: `${CONFIG.SCRIPT_NAME} - Update Error`, timeout: 7000 });
                else alert(msg); return;
            }
            const currentVersion = scriptInfo.version; const updateURL = scriptInfo.updateURL;
            const scriptName = scriptInfo.name || CONFIG.SCRIPT_NAME; const downloadURL = scriptInfo.downloadURL || updateURL;
            this.logger.debug(`Current Version: ${currentVersion}, Update URL: ${updateURL}`);
            GM_xmlhttpRequest({
                method: 'GET', url: updateURL, headers: { 'Cache-Control': 'no-cache' },
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        const remoteVersionMatch = response.responseText.match(/@version\s+([\d\w\.-]+)/);
                        if (remoteVersionMatch && remoteVersionMatch[1]) {
                            const remoteVersion = remoteVersionMatch[1]; this.logger.log(`Remote version: ${remoteVersion}`);
                            if (compareVersions(remoteVersion, currentVersion) > 0) {
                                const updateMessage = `A new version (${remoteVersion}) of ${scriptName} is available!`; this.logger.log(updateMessage);
                                if (typeof GM_notification === 'function') GM_notification({ text: `${updateMessage} Click to install.`, title: `${scriptName} - Update Available`, onclick: () => window.open(downloadURL, '_blank'), timeout: 0 });
                                else if (confirm(`${updateMessage}\n\nGo to download page?`)) window.open(downloadURL, '_blank');
                            } else {
                                const uptodateMsg = `${scriptName} (v${currentVersion}) is up to date.`; this.logger.log(uptodateMsg);
                                if (typeof GM_notification === 'function') GM_notification({ text: uptodateMsg, title: `${scriptName} - Up to Date`, timeout: 5000 }); else alert(uptodateMsg);
                            }
                        } else { this.logger.warn('Could not parse @version from remote script.'); if (typeof GM_notification === 'function') GM_notification({ text: 'Could not parse remote version.', title: `${scriptName} - Update Check Failed`, timeout: 7000 });}
                    } else { this.logger.error(`Error fetching update: ${response.status} ${response.statusText}`); if (typeof GM_notification === 'function') GM_notification({ text: `Error fetching update: ${response.statusText}`, title: `${scriptName} - Update Check Failed`, timeout: 7000 });}
                },
                onerror: (error) => { this.logger.error('Network error during update check:', error); if (typeof GM_notification === 'function') GM_notification({ text: 'Network error during update check. See console.', title: `${scriptName} - Update Check Failed`, timeout: 7000 });}
            });
        }
    }

    // ===============================
    // INITIALIZATION
    // ===============================
    if (window.youtubeAV1EnablerInstanceMarker) {
        console.log('[Use YouTube AV1] Instance marker found. Skipping initialization.'); return;
    }
    window.youtubeAV1EnablerInstanceMarker = true;

    const NativePromise = (async () => {})().constructor;
    const app = new YouTubeAV1Enabler();
    NativePromise.resolve().then(() => app.initialize());
    window.addEventListener('beforeunload', () => app.cleanup());

    if (typeof window !== 'undefined') { // Expose for debugging
        window.youtubeAV1App = {
            controller: app,
            getStatus: () => app.getStatus(),
            toggleDebug: async () => {
                if (app && app.settingsManager && app.logger && app.menuManager) {
                    const newDebugState = !app.settingsManager.get('debug');
                    await app.settingsManager.updateSetting('debug', newDebugState);
                    app.logger.refreshDebugState();
                    app.logger.info(`Debug mode toggled to ${newDebugState} via console.`);
                    app.menuManager.refreshMenuLabels();
                } else { console.error("App not fully initialized for debug toggle.");}
            },
            checkForUpdates: () => app.checkForUpdates(),
        };
    }
})();
