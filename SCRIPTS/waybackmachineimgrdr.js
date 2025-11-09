// ==UserScript==
// @name         Wayback Machine - Imgur Image Redirector
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Redirect Imgur images to existing Wayback Machine snapshots
// @author       airborne-commando
// @match        https://4chanarchives.com/*
// @match        http://4chanarchives.com/*
// @match        https://*.4chanarchives.com/*
// @match        http://*.4chanarchives.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      archive.org
// @connect      web.archive.org
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('Wayback Machine Imgur Redirector started');

    // Cache to avoid repeated requests
    let cache = GM_getValue('waybackCache', {});
    let requestQueue = [];
    let isProcessing = false;
    const REQUEST_DELAY = 500;

    // Add menu command to clear cache
    GM_registerMenuCommand('Clear Wayback Cache', clearCache);

    function clearCache() {
        cache = {};
        GM_setValue('waybackCache', {});
        console.log('Wayback cache cleared');
        // Reprocess all links on the page
        processImgurLinks();
    }

    // Function to find existing Wayback Machine snapshot for a URL
    function findExistingSnapshot(imgurUrl) {
        return new Promise((resolve, reject) => {
            // Check cache first - but only for positive results
            if (cache[imgurUrl] && cache[imgurUrl] !== 'NOT_FOUND') {
                console.log(`Using cached result for ${imgurUrl}`);
                resolve(cache[imgurUrl]);
                return;
            }

            console.log(`Checking Wayback for: ${imgurUrl}`);

            // Try CDX API first (most reliable)
            checkWaybackCDX(imgurUrl)
                .then(waybackUrl => {
                    console.log(`Found Wayback snapshot: ${waybackUrl}`);
                    cache[imgurUrl] = waybackUrl;
                    GM_setValue('waybackCache', cache);
                    resolve(waybackUrl);
                })
                .catch(() => {
                    // Fallback to direct check
                    checkWaybackDirect(imgurUrl)
                        .then(waybackUrl => {
                            console.log(`Found Wayback snapshot via direct check: ${waybackUrl}`);
                            cache[imgurUrl] = waybackUrl;
                            GM_setValue('waybackCache', cache);
                            resolve(waybackUrl);
                        })
                        .catch(() => {
                            // Last resort: try the standard API
                            checkWaybackAPI(imgurUrl)
                                .then(waybackUrl => {
                                    console.log(`Found Wayback snapshot via API: ${waybackUrl}`);
                                    cache[imgurUrl] = waybackUrl;
                                    GM_setValue('waybackCache', cache);
                                    resolve(waybackUrl);
                                })
                                .catch(error => {
                                    console.log(`No Wayback snapshot found for ${imgurUrl}`);
                                    // Only cache negative results temporarily (5 minutes)
                                    setTimeout(() => {
                                        if (cache[imgurUrl] === 'NOT_FOUND') {
                                            delete cache[imgurUrl];
                                            GM_setValue('waybackCache', cache);
                                        }
                                    }, 5 * 60 * 1000);
                                    cache[imgurUrl] = 'NOT_FOUND';
                                    GM_setValue('waybackCache', cache);
                                    reject(error);
                                });
                        });
                });
        });
    }

    // CDX API method - most comprehensive
    function checkWaybackCDX(imgurUrl) {
        return new Promise((resolve, reject) => {
            // Use CDX API with multiple output formats
            const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(imgurUrl)}&output=json&limit=10&collapse=timestamp:8`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: cdxUrl,
                timeout: 15000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.length > 1) {
                            // Get the most recent snapshot
                            const snapshot = data[1];
                            const timestamp = snapshot[1];
                            const waybackUrl = `https://web.archive.org/web/${timestamp}/${imgurUrl}`;
                            resolve(waybackUrl);
                        } else {
                            reject(new Error('No CDX results'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: reject,
                ontimeout: reject
            });
        });
    }

    // Direct check method
    function checkWaybackDirect(imgurUrl) {
        return new Promise((resolve, reject) => {
            // Try to access the snapshot directly
            const waybackUrl = `https://web.archive.org/web/${imgurUrl}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: waybackUrl,
                timeout: 10000,
                onload: function(response) {
                    if (response.status === 200 || response.status === 302) {
                        resolve(waybackUrl);
                    } else {
                        reject(new Error('Direct check failed'));
                    }
                },
                onerror: reject,
                ontimeout: reject
            });
        });
    }

    // Standard API method
    function checkWaybackAPI(imgurUrl) {
        return new Promise((resolve, reject) => {
            const waybackApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(imgurUrl)}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: waybackApiUrl,
                timeout: 15000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.archived_snapshots && data.archived_snapshots.closest) {
                            resolve(data.archived_snapshots.closest.url);
                        } else {
                            reject(new Error('No API results'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: reject,
                ontimeout: reject
            });
        });
    }

    // Process requests with delay to avoid rate limiting
    async function processQueue() {
        if (isProcessing || requestQueue.length === 0) return;

        isProcessing = true;
        console.log(`Processing queue with ${requestQueue.length} items`);

        while (requestQueue.length > 0) {
            const request = requestQueue.shift();
            try {
                await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
                await request.fn();
            } catch (error) {
                console.error('Error processing Wayback request:', error);
            }
        }

        isProcessing = false;
        console.log('Queue processing complete');
    }

    // Function to process all Imgur links on the page
    function processImgurLinks() {
        console.log('Processing Imgur links on page...');

        // Clear any existing processing flags to allow reprocessing
        document.querySelectorAll('[data-wayback-processed]').forEach(el => {
            el.removeAttribute('data-wayback-processed');
        });

        // Find ALL imgur links and images on the page
        const allImgurLinks = document.querySelectorAll('a[href*="imgur.com"]');
        const allImgurImages = document.querySelectorAll('img[src*="imgur.com"]');

        console.log(`Found ${allImgurLinks.length} Imgur links and ${allImgurImages.length} Imgur images`);

        let processedCount = 0;

        // Process all Imgur links (both file text links and thumbnail links)
        allImgurLinks.forEach(link => {
            const href = link.href;
            if (isDirectImgurImageUrl(href)) {
                processedCount++;
                requestQueue.push({
                    fn: () => processLink(link, href)
                });
            }
        });

        // Process all Imgur images (thumbnail images)
        allImgurImages.forEach(img => {
            const src = img.src;
            if (isDirectImgurImageUrl(src)) {
                processedCount++;
                requestQueue.push({
                    fn: () => processThumbnailImage(img, src)
                });
            }
        });

        console.log(`Queued ${processedCount} Imgur items for Wayback redirection`);

        // Start processing the queue
        if (processedCount > 0) {
            processQueue();
        }
    }

    // Helper function to check if URL is a DIRECT Imgur image
    function isDirectImgurImageUrl(url) {
        url = String(url).trim();

        // Skip search/redirect URLs and already archived URLs
        if (url.includes('lens.google.com') ||
            url.includes('yandex.com/images') ||
            url.includes('bing.com/images') ||
            url.includes('google.com/uploadbyurl') ||
            url.includes('rpt=imageview') ||
            url.includes('view=detailv2') ||
            url.includes('web.archive.org')) {
            return false;
        }

        // Match direct Imgur image URLs (including thumbnails with 'm' suffix)
        return url.match(/^https?:\/\/(i\.)?imgur\.com\/[a-zA-Z0-9]+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
    }

    // Process individual link (file text links and thumbnail links)
    async function processLink(link, href) {
        console.log(`Processing link: ${href}`);

        // Skip if already processed (unless cache was cleared)
        if (link.getAttribute('data-wayback-processed') === 'true') {
            return;
        }

        link.style.borderLeft = '3px solid #ff6b6b';
        link.title = 'Checking Wayback Machine...';
        link.setAttribute('data-wayback-processed', 'true');

        try {
            const waybackUrl = await findExistingSnapshot(href);
            link.href = waybackUrl;
            link.style.borderLeft = '3px solid #4ecdc4';
            link.title = 'Redirects to Wayback Machine snapshot';
            link.target = '_blank';

            // Add visual indicator
            const waybackBadge = document.createElement('span');
            waybackBadge.textContent = ' 🕒';
            waybackBadge.style.fontSize = '0.8em';
            waybackBadge.title = 'Wayback Machine snapshot';
            link.appendChild(waybackBadge);

            console.log(`Redirected link: ${href} -> ${waybackUrl}`);
        } catch (error) {
            console.log(`No Wayback snapshot found for ${href}`);
            link.style.borderLeft = '3px solid #ffd166';
            link.title = 'No Wayback Machine snapshot available';
        }
    }

    // Process thumbnail image (replace the actual image source)
    async function processThumbnailImage(img, src) {
        console.log(`Processing thumbnail image: ${src}`);

        // Skip if already processed (unless cache was cleared)
        if (img.getAttribute('data-wayback-processed') === 'true') {
            return;
        }

        const originalSrc = src;
        img.setAttribute('data-wayback-processed', 'true');

        try {
            // For thumbnails, we need to get the full image URL first
            const fullImageUrl = getFullImageUrl(originalSrc);
            console.log(`Getting full image URL for thumbnail: ${fullImageUrl}`);

            const waybackUrl = await findExistingSnapshot(fullImageUrl);

            // Replace the thumbnail image source with the Wayback URL
            img.src = waybackUrl;
            img.style.border = '2px solid #4ecdc4';
            img.title = 'Loaded from Wayback Machine - ' + (img.title || '');

            // If image fails to load, revert to original
            img.onerror = function() {
                console.log('Wayback thumbnail failed to load, reverting to original');
                this.src = originalSrc;
                this.style.border = '2px solid #ff6b6b';
                this.title = 'Wayback failed - using original';
            };

            console.log(`Replaced thumbnail: ${src} -> ${waybackUrl}`);
        } catch (error) {
            console.log(`No Wayback snapshot found for thumbnail image ${src}`);
            img.style.border = '2px solid #ffd166';
            img.title = 'No Wayback available - ' + (img.title || '');
        }
    }

    // Convert thumbnail URL to full image URL
    function getFullImageUrl(thumbnailUrl) {
        // Thumbnail URLs typically have an 'm' before the extension
        // Example: https://i.imgur.com/wUxSQoZm.gif -> https://i.imgur.com/wUxSQoZ.gif
        return thumbnailUrl.replace(/([a-zA-Z0-9]+)m\.(jpg|jpeg|png|gif|webp)$/i, '$1.$2');
    }

    // Initialize the script
    function init() {
        console.log('Initializing Wayback Machine Imgur Redirector');

        // Process immediately
        processImgurLinks();

        // Also process after delays to catch dynamically loaded content
        setTimeout(processImgurLinks, 2000);
        setTimeout(processImgurLinks, 5000);
    }

    // Wait for page to load and then process
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Process on navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('URL changed, reprocessing...');
            setTimeout(processImgurLinks, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

})();
