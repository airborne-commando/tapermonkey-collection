// ==UserScript==
// @name         Universal Background Check Exporter
// @namespace    http://tampermonkey.net/
// @updateURL    https://raw.githubusercontent.com/airborne-commando/tapermonkey-collection/refs/heads/main/SCRIPTS/universal-search.js
// @downloadURL  https://raw.githubusercontent.com/airborne-commando/tapermonkey-collection/refs/heads/main/SCRIPTS/universal-search.js
// @version      2.2.4
// @description  Export results from multiple background check sites: FastBackgroundCheck, FastPeopleSearch, ZabaSearch, and Vote.org with API integration
// @author       airborne-commando
// @match        https://www.fastbackgroundcheck.com/*
// @match        https://fastbackgroundcheck.com/*
// @match        https://www.fastpeoplesearch.com/*
// @match        https://www.zabasearch.com/*
// @match        https://verify.vote.org/your-status
// @match        https://verify.vote.org/
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      verify.vote.org
// @connect      vote.org
// @connect      maps.googleapis.com
// @license      GPL 3.0
// ==/UserScript==

(function() {
    'use strict';

    // Search Utility Class
    class SearchUtility {
        static formatNameForFPSFBC(name) {
            // For FPS and FBC: replace spaces with hyphens but keep existing hyphens
            return name.toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/--+/g, '-')
                .replace(/^-|-$/g, '');
        }

        static formatNameForZaba(name) {
            // For Zaba: keep hyphens and spaces become hyphens
            return name.toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/--+/g, '-')
                .replace(/^-|-$/g, '');
        }

        static formatLocation(location) {
            // Format location for URL
            return location.toLowerCase()
                .trim()
                .replace(/\s*,\s*/g, '-')
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '')
                .replace(/--+/g, '-')
                .replace(/^-|-$/g, '');
        }

        static formatStateForZaba(state) {
            // Zaba uses full state names, not abbreviations
            const stateMap = {
                'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas', 'ca': 'california',
                'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware', 'fl': 'florida', 'ga': 'georgia',
                'hi': 'hawaii', 'id': 'idaho', 'il': 'illinois', 'in': 'indiana', 'ia': 'iowa',
                'ks': 'kansas', 'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
                'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi', 'mo': 'missouri',
                'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada', 'nh': 'new-hampshire', 'nj': 'new-jersey',
                'nm': 'new-mexico', 'ny': 'new-york', 'nc': 'north-carolina', 'nd': 'north-dakota', 'oh': 'ohio',
                'ok': 'oklahoma', 'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode-island', 'sc': 'south-carolina',
                'sd': 'south-dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah', 'vt': 'vermont',
                'va': 'virginia', 'wa': 'washington', 'wv': 'west-virginia', 'wi': 'wisconsin', 'wy': 'wyoming'
            };

            const stateLower = state.toLowerCase().trim();
            return stateMap[stateLower] || this.formatLocation(state);
        }

        static generateSearchURLs(firstName, lastName, city, state) {
            const fullName = `${firstName} ${lastName}`;
            const formattedNameFPSFBC = this.formatNameForFPSFBC(fullName);
            const formattedNameZaba = this.formatNameForZaba(fullName);
            const formattedState = this.formatLocation(state);
            const formattedStateZaba = this.formatStateForZaba(state);
            const formattedCityState = city ? this.formatLocation(`${city}-${state}`) : '';

            const urls = {
                fastpeoplesearch: [],
                fastbackgroundcheck: [],
                zabasearch: []
            };

            // FastPeopleSearch URLs
            if (formattedCityState) {
                urls.fastpeoplesearch.push(`https://www.fastpeoplesearch.com/name/${formattedNameFPSFBC}_${formattedCityState}`);
            }
            // Always include state-only search for FPS
            urls.fastpeoplesearch.push(`https://www.fastpeoplesearch.com/name/${formattedNameFPSFBC}_${formattedState}`);

            // FastBackgroundCheck URLs
            if (formattedCityState) {
                urls.fastbackgroundcheck.push(`https://www.fastbackgroundcheck.com/people/${formattedNameFPSFBC}/${formattedCityState}`);
            }
            // Always include state-only search for FBC
            urls.fastbackgroundcheck.push(`https://www.fastbackgroundcheck.com/people/${formattedNameFPSFBC}/${formattedState}`);

            // ZabaSearch URLs
            if (city) {
                const formattedCity = this.formatLocation(city);
                urls.zabasearch.push(`https://www.zabasearch.com/people/${formattedNameZaba}/${formattedStateZaba}/${formattedCity}/`);
            }
            // Always include state-only search for Zaba
            urls.zabasearch.push(`https://www.zabasearch.com/people/${formattedNameZaba}/${formattedStateZaba}/`);

            return urls;
        }

        static validateName(name) {
            return name && name.trim().length > 0;
        }

        static validateState(state) {
            return state && state.trim().length > 0;
        }

        static getStateAbbreviation(stateName) {
            const stateMap = {
                'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
                'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
                'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
                'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
                'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
                'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
                'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
                'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
                'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
                'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
            };

            const normalized = stateName.toLowerCase().trim();
            return stateMap[normalized] || null;
        }
    }

    // Google Maps Utility Class
    class MapsUtility {
    static async geocodeAddress(address) {
        return new Promise((resolve, reject) => {
            // Simple geocoding using Google Maps API
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyC1lwGqZqQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1`;

            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        const data = JSON.parse(response.responseText);
                        if (data.status === 'OK' && data.results.length > 0) {
                            const location = data.results[0].geometry.location;
                            resolve({
                                success: true,
                                lat: location.lat,
                                lng: location.lng,
                                formattedAddress: data.results[0].formatted_address
                            });
                        } else {
                            resolve({
                                success: false,
                                error: data.status
                            });
                        }
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${response.status}`
                        });
                    }
                },
                onerror: function(error) {
                    resolve({
                        success: false,
                        error: 'Geocoding request failed'
                    });
                }
            });
        });
    }

    static generateStaticMapUrl(lat, lng, zoom = 14, width = 300, height = 200) {
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=color:red%7C${lat},${lng}&key=AIzaSyC1lwGqZqQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1qQ1`;
    }

    static generateGoogleMapsLink(lat, lng) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    static generateStreetViewUrl(lat, lng) {
        return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    }

    static parseAddressComponents(address) {
        // Simple address parsing for common formats
        const patterns = [
            /(\d+)\s+([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})/i, // 123 Main St, City, ST 12345
            /([^,]+),\s*([^,]+),\s*([A-Z]{2})/i, // City, ST
            /([^,]+),\s*([A-Z]{2})/i // City, ST
        ];

        for (const pattern of patterns) {
            const match = address.match(pattern);
            if (match) {
                return {
                    street: match[1] || '',
                    city: match[2] || '',
                    state: match[3] || '',
                    zip: match[4] || ''
                };
            }
        }
        return null;
    }
}

    // Vote.org API Integration Class
    class VoteOrgAPI {
        static async checkVoterStatus(voterData) {
            return new Promise((resolve, reject) => {
                const url = 'https://verify.vote.org/your-status';

                // Default values
                const data = {
                    first_name: voterData.firstName || '',
                    last_name: voterData.lastName || '',
                    street_address: voterData.streetAddress || '',
                    city: voterData.city || '',
                    state_abbr: voterData.state || '',
                    zip_5: voterData.zipCode || '',
                    email: voterData.email || 'tahis60368@haotuwu.com',
                    date_of_birth_month: '01',
                    date_of_birth_day: '01',
                    date_of_birth_year: voterData.dobYear || '',
                    phone_number: voterData.phone || '',
                    agreed_to_terms: '1'
                };

                // Build form data
                const formData = Object.keys(data)
                    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
                    .join('&');

                GM_xmlhttpRequest({
                    method: "POST",
                    url: url,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                    },
                    data: formData,
                    onload: function(response) {
                        if (response.status === 200) {
                            resolve({
                                success: true,
                                status: response.status,
                                responseText: response.responseText,
                                finalUrl: response.finalUrl
                            });
                        } else {
                            resolve({
                                success: false,
                                status: response.status,
                                error: `HTTP ${response.status}`,
                                responseText: response.responseText
                            });
                        }
                    },
                    onerror: function(error) {
                        resolve({
                            success: false,
                            error: 'Request failed',
                            details: error
                        });
                    },
                    ontimeout: function() {
                        resolve({
                            success: false,
                            error: 'Request timeout'
                        });
                    }
                });
            });
        }

        static parseVoterResponse(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const result = {
                type: 'voter_registration',
                status: 'unknown',
                isRegistered: false,
                registrationStatus: 'Unknown',
                source: 'api'
            };

            // Check for registered voter indicators
            const hasRegisteredClass = doc.querySelector('.registered-lead') !== null;
            const hasGreenCheck = doc.querySelector('.green-check') !== null;
            const hasRegisteredText = doc.querySelector('h2')?.textContent.includes('You are registered to vote');

            // Check for positive confirmation in the main content
            const bodyText = doc.body.textContent;
            const hasPositiveConfirmation = bodyText.includes('is registered to vote at') &&
                                           !bodyText.includes('could not confirm') &&
                                           !bodyText.includes('do NOT show');

            // Check for not registered indicators
            const hasNotRegisteredClass = doc.querySelector('.not-registered') !== null;
            const hasNotRegisteredLead = doc.querySelector('.not-registered-lead') !== null;
            const hasRedCross = doc.querySelector('.red-cross') !== null;
            const hasNegativeIndicators = bodyText.includes('We could not confirm that you are registered to vote') ||
                                         bodyText.includes('Our records do NOT show that') ||
                                         bodyText.includes('is not registered to vote at');

            if (hasRegisteredClass || hasGreenCheck || hasRegisteredText || hasPositiveConfirmation) {
                result.status = 'found';
                result.isRegistered = true;
                result.registrationStatus = 'Registered to Vote';

                // Extract voter details
                const nameElement = doc.querySelector('.address-block b');
                if (nameElement) {
                    result.fullName = nameElement.textContent.trim();
                }

                const addressElement = doc.querySelector('.ldv-address b');
                if (addressElement) {
                    result.registrationAddress = addressElement.textContent.trim();
                }
            } else if (hasNotRegisteredClass || hasNotRegisteredLead || hasRedCross || hasNegativeIndicators) {
                result.status = 'not_found';
                result.isRegistered = false;
                result.registrationStatus = 'Not Registered - Could Not Confirm';

                // Extract name from the address block
                const nameElement = doc.querySelector('.address-block b');
                if (nameElement) {
                    result.fullName = nameElement.textContent.trim();
                }

                const addressElement = doc.querySelector('.ldv-address b');
                if (addressElement) {
                    result.registrationAddress = addressElement.textContent.trim();
                }
            } else {
                result.status = 'error';
                result.registrationStatus = 'Unable to determine status';
            }

            return result;
        }
    }

    // Base Extractor Class
    class BaseExtractor {
        extractData() {
            return {
                url: window.location.href,
                timestamp: new Date().toISOString(),
                pageTitle: document.title,
                results: [],
                pageType: 'unknown'
            };
        }

        convertToText(data, scope) {
            return 'Text export not implemented for this site';
        }
    }

    // FastBackgroundCheck Extractor
    class FastBackgroundCheckExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();

            // Check if this is a search results page with person containers
            if (document.querySelector('.person-container, [class*="person"]')) {
                data.results = this.extractSearchResultsData();
                data.pageType = 'search_results';
            }
            // Check for individual person details page
            else if (document.querySelector('.person-details, .profile-container')) {
                const personData = this.extractPersonDetailsData();
                if (personData) {
                    data.results.push(personData);
                }
                data.pageType = 'person_details';
            }
            // Check for no results
            else if (document.querySelector('.no-results, .no-records, .not-found')) {
                data.results = [{ status: 'no_results', message: 'No records found matching search criteria' }];
                data.pageType = 'no_results';
            }

            return data;
        }

        extractSearchResultsData() {
            const people = [];
            const personSelectors = [
                '.person-container',
                '.people-list li',
                '[class*="person"]',
                '.result-item',
                '.record-item'
            ];

            let personElements = [];
            personSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    personElements = elements;
                }
            });

            if (personElements.length === 0) {
                personElements = document.querySelectorAll('li');
            }

            personElements.forEach((element, index) => {
                const person = {
                    type: 'search_result',
                    status: 'found',
                    id: element.id || `person_${index}`
                };

                // Extract name
                const nameSelectors = ['h1', 'h2', 'h3', 'h4', '.name', '.person-name', '.full-name'];
                nameSelectors.forEach(selector => {
                    const nameElement = element.querySelector(selector);
                    if (nameElement && !person.name) {
                        person.name = nameElement.textContent.trim();
                    }
                });

                // Extract location
                const locationSelectors = ['.location', '.address', '.city-state', '[class*="location"]'];
                locationSelectors.forEach(selector => {
                    const locationElement = element.querySelector(selector);
                    if (locationElement && !person.location) {
                        person.location = locationElement.textContent.trim();
                    }
                });

                // Extract age
                const ageText = element.textContent.match(/Age:\s*(\d+)/i);
                if (ageText) {
                    person.age = ageText[1];
                }

                // Extract addresses
                const addressLinks = element.querySelectorAll('a[href*="/address/"], a[href*="address"]');
                const addresses = [];
                addressLinks.forEach(link => {
                    const addressText = link.textContent.trim();
                    if (addressText && addressText.length > 5) {
                        addresses.push({
                            address: addressText,
                            url: link.href
                        });
                    }
                });
                if (addresses.length > 0) {
                    person.addresses = addresses;
                }

                // Extract phone numbers
                const phoneLinks = element.querySelectorAll('a[href*="/phone/"], a[href*="tel:"], a[href*="phone"]');
                const phones = [];
                phoneLinks.forEach(link => {
                    const phoneText = link.textContent.trim();
                    if (phoneText && phoneText.match(/\(\d{3}\)\s*\d{3}[-\.]\d{4}/)) {
                        phones.push({
                            number: phoneText,
                            url: link.href
                        });
                    }
                });
                if (phones.length > 0) {
                    person.phones = phones;
                }

                // Extract relatives
                const relativeLinks = element.querySelectorAll('a[href*="/people/"], a[href*="name="]');
                const relatives = [];
                relativeLinks.forEach(link => {
                    if (!link.textContent.includes(person.name)) {
                        relatives.push({
                            name: link.textContent.trim(),
                            url: link.href
                        });
                    }
                });
                if (relatives.length > 0) {
                    person.relatives = relatives;
                }

                // Extract details URL
                const detailsLink = element.querySelector('a[href*="/people/"], a[href*="/person/"], a[href*="id="]');
                if (detailsLink) {
                    person.detailsUrl = detailsLink.href;
                }

                if (person.name || person.addresses || person.phones) {
                    people.push(person);
                }
            });

            return people;
        }

        extractPersonDetailsData() {
            const person = {
                type: 'detailed_record',
                status: 'found'
            };

            // Extract name from various possible elements
            const nameSelectors = ['h1', 'h2', '.person-name', '.full-name', '.profile-name'];
            nameSelectors.forEach(selector => {
                const nameElement = document.querySelector(selector);
                if (nameElement && !person.name) {
                    person.name = nameElement.textContent.trim();
                }
            });

            // Extract all sections with potential data
            const sections = document.querySelectorAll('.person-info, .profile-section, .details-section, .card, .info-block');

            sections.forEach(section => {
                const text = section.textContent.toLowerCase();

                // Age information
                if (text.includes('age') && !person.age) {
                    const ageMatch = section.textContent.match(/\b(\d+)\s*years?\b/i);
                    if (ageMatch) {
                        person.age = ageMatch[1];
                    }
                }

                // Address information
                if ((text.includes('address') || text.includes('location')) && !person.addresses) {
                    const addressElements = section.querySelectorAll('a, span, div');
                    addressElements.forEach(el => {
                        const addressText = el.textContent.trim();
                        if (addressText.length > 10 && addressText.match(/\d+/)) {
                            if (!person.addresses) person.addresses = [];
                            person.addresses.push({
                                address: addressText,
                                type: text.includes('current') ? 'current' : 'past'
                            });
                        }
                    });
                }

                // Phone information
                if (text.includes('phone') && !person.phones) {
                    const phoneMatches = section.textContent.match(/\(\d{3}\)\s*\d{3}[-\.]\d{4}/g);
                    if (phoneMatches) {
                        person.phones = phoneMatches.map(number => ({ number: number.trim() }));
                    }
                }
            });

            return Object.keys(person).length > 1 ? person : null;
        }

        convertToText(data, scope) {
            let text = `FASTBACKGROUNDCHECK EXPORT\n`;
            text += `Page URL: ${data.url}\n`;
            text += `Export Time: ${new Date().toLocaleString()}\n`;
            text += `Records Count: ${data.results.length}\n`;
            text += '='.repeat(60) + '\n\n';

            data.results.forEach((result, index) => {
                text += `RECORD ${index + 1}:\n`;
                text += `Name: ${result.name || 'N/A'}\n`;
                text += `Age: ${result.age || 'N/A'}\n`;
                text += `Location: ${result.location || 'N/A'}\n`;

                if (result.addresses && result.addresses.length > 0) {
                    text += `Addresses:\n`;
                    result.addresses.forEach(addr => {
                        text += `  - ${addr.address}\n`;
                    });
                }

                if (result.phones && result.phones.length > 0) {
                    text += `Phones:\n`;
                    result.phones.forEach(phone => {
                        text += `  - ${phone.number}\n`;
                    });
                }

                if (result.relatives && result.relatives.length > 0) {
                    text += `Relatives: ${result.relatives.map(rel => rel.name).join(', ')}\n`;
                }

                if (result.detailsUrl) {
                    text += `Details URL: ${result.detailsUrl}\n`;
                }

                text += '\n' + '-'.repeat(40) + '\n\n';
            });

            return text;
        }
    }

    // FastPeopleSearch Extractor
    class FastPeopleSearchExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();

            // Check if this is a people list page
            if (document.querySelector('.people-list')) {
                const peopleList = document.querySelector('.people-list');
                data.results = this.extractPeopleListData(peopleList);
                data.pageType = 'people_list';
            }
            // Check for individual person details page
            else if (document.querySelector('.card-details')) {
                const personCards = document.querySelectorAll('.card-details');
                personCards.forEach((card, index) => {
                    const personData = this.extractPersonDetailsData(card);
                    if (personData) {
                        data.results.push(personData);
                    }
                });
                data.pageType = 'person_details';
            }
            // Check for no results
            else if (document.querySelector('.no-results')) {
                data.results = [{ status: 'no_results', message: 'No people found matching search criteria' }];
                data.pageType = 'no_results';
            }

            return data;
        }

        extractPeopleListData(listElement) {
            const people = [];
            const cards = listElement.querySelectorAll('.card');

            cards.forEach((card, index) => {
                const person = {
                    type: 'list_person',
                    status: 'found',
                    id: card.id || `person_${index}`
                };

                // Extract basic info from card-title
                const titleElement = card.querySelector('.card-title');
                if (titleElement) {
                    const nameElement = titleElement.querySelector('.larger');
                    if (nameElement) {
                        person.name = nameElement.textContent.trim();
                    }

                    const locationElement = titleElement.querySelector('.grey');
                    if (locationElement) {
                        person.location = locationElement.textContent.trim();
                    }
                }

                // Extract all sections by finding h3 elements and their content
                const sections = card.querySelectorAll('h3');

                sections.forEach(section => {
                    const sectionText = section.textContent.trim();

                    // Age section
                    if (sectionText.includes('Age:')) {
                        const ageContent = this.getSectionContent(section);
                        if (ageContent) {
                            person.age = ageContent.replace(':', '').trim();
                        }
                    }

                    // Full Name section
                    else if (sectionText.includes('Full Name:')) {
                        const fullNameContent = this.getSectionContent(section);
                        if (fullNameContent) {
                            person.fullName = fullNameContent.trim();
                        }
                    }

                    // Current Home Address section
                    else if (sectionText.includes('Current Home Address:')) {
                        const addressLink = section.parentElement.querySelector('a[href*="/address/"]');
                        if (addressLink) {
                            const addressLines = addressLink.textContent.trim().split('\n').map(line => line.trim());
                            person.currentAddress = {
                                address: addressLines.join(' ').replace(/\s+/g, ' '),
                                url: addressLink.href
                            };
                        }
                    }

                    // Past Addresses section
                    else if (sectionText.includes('Past Addresses:')) {
                        const pastAddresses = [];
                        const addressLinks = section.parentElement.querySelectorAll('a[href*="/address/"]');
                        addressLinks.forEach(link => {
                            const isCurrentAddress = link.closest('h3') && link.closest('h3').textContent.includes('Current Home Address:');
                            if (!isCurrentAddress) {
                                const addressLines = link.textContent.trim().split('\n').map(line => line.trim());
                                const addressText = addressLines.join(' ').replace(/\s+/g, ' ');
                                pastAddresses.push({
                                    address: addressText,
                                    url: link.href
                                });
                            }
                        });

                        if (pastAddresses.length > 0) {
                            person.pastAddresses = pastAddresses;
                        }
                    }

                    // Phone section
                    else if (sectionText.includes('Phone:')) {
                        const phones = [];
                        const phoneLinks = section.parentElement.querySelectorAll('a[href*="/phone/"], a[href*="/tel/"]');
                        phoneLinks.forEach(link => {
                            const phoneText = link.textContent.trim();
                            phones.push({
                                number: phoneText,
                                url: link.href
                            });
                        });

                        if (phones.length > 0) {
                            person.phones = phones;
                        }
                    }

                    // AKA section
                    else if (sectionText.includes('AKA:')) {
                        const akas = [];
                        const akaSpans = section.parentElement.querySelectorAll('.nowrap');
                        akaSpans.forEach(aka => {
                            if (aka.textContent.trim()) {
                                akas.push(aka.textContent.trim());
                            }
                        });

                        if (akas.length > 0) {
                            person.aliases = akas;
                        }
                    }

                    // Relatives section
                    else if (sectionText.includes('Relatives:')) {
                        const relatives = [];
                        const relativeLinks = section.parentElement.querySelectorAll('a[href*="/name/"]');
                        relativeLinks.forEach(link => {
                            relatives.push({
                                name: link.textContent.trim(),
                                url: link.href
                            });
                        });

                        if (relatives.length > 0) {
                            person.relatives = relatives;
                        }
                    }
                });

                // Extract view details link
                const detailsLink = card.querySelector('a.link-to-details, a[href*="_id_"]');
                if (detailsLink) {
                    person.detailsUrl = detailsLink.href;
                }

                if (person.name) {
                    people.push(person);
                }
            });

            return people;
        }

        getSectionContent(sectionElement) {
            let content = '';
            let nextSibling = sectionElement.nextSibling;

            while (nextSibling) {
                if (nextSibling.nodeType === Node.TEXT_NODE) {
                    content += nextSibling.textContent;
                } else if (nextSibling.nodeType === Node.ELEMENT_NODE) {
                    if (nextSibling.tagName === 'H3') {
                        break;
                    }
                    if (nextSibling.tagName === 'BR') {
                        content += ' ';
                    } else {
                        content += nextSibling.textContent;
                    }
                }
                nextSibling = nextSibling.nextSibling;
            }

            return content.trim();
        }

        extractPersonDetailsData(cardElement) {
            const person = {
                type: 'detailed_person',
                status: 'found'
            };

            // Extract name from h1 or h2
            const nameElement = cardElement.querySelector('h1, h2');
            if (nameElement) {
                person.name = nameElement.textContent.trim();
            }

            // Extract basic info sections
            const sections = cardElement.querySelectorAll('.card-body, .person-info');
            sections.forEach(section => {
                this.extractDetailedInfo(section, person);
            });

            return Object.keys(person).length > 1 ? person : null;
        }

        extractDetailedInfo(section, person) {
            const headings = section.querySelectorAll('h3, h4, strong');

            headings.forEach(heading => {
                const text = heading.textContent.toLowerCase();
                const nextElement = heading.nextElementSibling;

                if (text.includes('age') && nextElement) {
                    person.age = nextElement.textContent.trim();
                } else if (text.includes('address') && nextElement) {
                    if (!person.addresses) person.addresses = [];
                    person.addresses.push(nextElement.textContent.trim());
                } else if (text.includes('phone') && nextElement) {
                    if (!person.phones) person.phones = [];
                    person.phones.push(nextElement.textContent.trim());
                }
            });
        }

        convertToText(data, scope) {
            let text = `FASTPEOPLESEARCH EXPORT\n`;
            text += `Page URL: ${data.url}\n`;
            text += `Export Time: ${new Date().toLocaleString()}\n`;
            text += `Results Count: ${data.results.length}\n`;
            text += '='.repeat(60) + '\n\n';

            data.results.forEach((result, index) => {
                text += `RESULT ${index + 1}:\n`;
                text += `Name: ${result.name || 'N/A'}\n`;
                text += `Full Name: ${result.fullName || 'N/A'}\n`;
                text += `Age: ${result.age || 'N/A'}\n`;
                text += `Location: ${result.location || 'N/A'}\n`;

                if (result.currentAddress) {
                    text += `Current Address: ${result.currentAddress.address}\n`;
                }

                if (result.pastAddresses && result.pastAddresses.length > 0) {
                    text += `Past Addresses: ${result.pastAddresses.map(addr => addr.address).join('; ')}\n`;
                }

                if (result.phones && result.phones.length > 0) {
                    text += `Phones: ${result.phones.map(phone => phone.number).join('; ')}\n`;
                }

                if (result.aliases && result.aliases.length > 0) {
                    text += `Aliases: ${result.aliases.join('; ')}\n`;
                }

                if (result.relatives && result.relatives.length > 0) {
                    text += `Relatives: ${result.relatives.map(rel => rel.name).join('; ')}\n`;
                }

                if (result.detailsUrl) {
                    text += `Details URL: ${result.detailsUrl}\n`;
                }

                text += '\n' + '-'.repeat(40) + '\n\n';
            });

            return text;
        }
    }

    // ZabaSearch Extractor
    class ZabaSearchExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();
            this.extractLocationInfo(data);

            // Check if this is a search results page with multiple people
            if (this.isSearchResultsPage()) {
                data.results = this.extractSearchResultsData();
                data.pageType = 'search_results';
            }
            // Check for individual person details page
            else if (this.isPersonDetailsPage()) {
                const personData = this.extractPersonDetailsData();
                if (personData) {
                    data.results.push(personData);
                }
                data.pageType = 'person_details';
            }
            // Check for no results
            else if (this.isNoResultsPage()) {
                data.results = [{ status: 'no_results', message: 'No records found matching search criteria' }];
                data.pageType = 'no_results';
            }

            return data;
        }

        extractLocationInfo(data) {
            const urlParts = window.location.pathname.split('/').filter(part => part);
            data.searchLocation = {};

            if (urlParts.length >= 2 && urlParts[0] === 'people') {
                data.searchQuery = urlParts[1];

                if (urlParts.length >= 3) {
                    data.searchLocation.state = urlParts[2];
                }
                if (urlParts.length >= 4) {
                    data.searchLocation.cityOrCounty = urlParts[3];
                }
            }

            // Extract from breadcrumbs
            const breadcrumbs = document.querySelectorAll('#breadcrumbs li');
            if (breadcrumbs.length > 0) {
                data.breadcrumbs = Array.from(breadcrumbs).map(li => li.textContent.trim()).filter(text => text);
                const breadcrumbText = data.breadcrumbs.join(' ');
                if (breadcrumbText.includes('Pennsylvania') || data.breadcrumbs.some(b => b === 'Pennsylvania')) {
                    data.searchLocation.state = 'Pennsylvania';
                }
                if (breadcrumbText.includes('Erie') || data.breadcrumbs.some(b => b === 'Erie')) {
                    data.searchLocation.cityOrCounty = 'Erie';
                }
            }

            // Extract from page title
            const titleMatch = document.title.match(/in\s+([^,]+)(?:,\s*([^|-]+))?/);
            if (titleMatch) {
                if (titleMatch[2]) {
                    data.searchLocation.cityOrCounty = titleMatch[1].trim();
                    data.searchLocation.state = titleMatch[2].trim();
                } else if (titleMatch[1]) {
                    data.searchLocation.state = titleMatch[1].trim();
                }
            }
        }

        isSearchResultsPage() {
            return document.querySelectorAll('.person, .person-container, [class*="person"]').length > 1 ||
                   document.querySelector('.resultsbox') !== null ||
                   document.querySelector('h1')?.textContent.includes('record found') ||
                   document.querySelector('h1')?.textContent.includes('records found');
        }

        isPersonDetailsPage() {
            return document.querySelector('.person, .person-container') !== null &&
                   document.querySelectorAll('.person, .person-container').length === 1 &&
                   document.querySelector('.section-box') !== null;
        }

        isNoResultsPage() {
            return document.querySelector('.no-results, .no-records, .not-found') !== null ||
                   document.querySelector('h1')?.textContent.includes('No results') ||
                   document.querySelector('h1')?.textContent.includes('No records');
        }

        extractSearchResultsData() {
            const people = [];
            const personSelectors = [
                '.person',
                '.person-container',
                '.resultsbox .person',
                '#container-result .person',
                '[class*="person-"]'
            ];

            let personElements = [];
            personSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    personElements = elements;
                }
            });

            if (personElements.length === 0) {
                personElements = document.querySelectorAll('.result-item, .record-item, li');
            }

            personElements.forEach((element, index) => {
                const person = {
                    type: 'search_result',
                    status: 'found',
                    id: element.getAttribute('data-id') || element.id || `person_${index}`
                };

                // Extract name from ZabaSearch structure
                const nameElement = element.querySelector('#container-name h2 a, h2 a, .name, .person-name');
                if (nameElement) {
                    person.name = nameElement.textContent.trim();
                }

                // Extract age
                const ageElement = element.querySelector('h3');
                if (ageElement && ageElement.previousElementSibling &&
                    ageElement.previousElementSibling.textContent.includes('Age')) {
                    person.age = ageElement.textContent.trim();
                } else {
                    const ageMatch = element.textContent.match(/Age\s*:\s*(\d+)/i);
                    if (ageMatch) {
                        person.age = ageMatch[1];
                    }
                }

                // Extract phone numbers
                const phoneLinks = element.querySelectorAll('a[href*="/phone/"]');
                const phones = [];
                phoneLinks.forEach(link => {
                    const phoneText = link.textContent.trim();
                    if (phoneText && phoneText.match(/\(\d{3}\)\s*\d{3}[-\.]\d{4}/)) {
                        phones.push({
                            number: phoneText,
                            url: link.href
                        });
                    }
                });
                if (phones.length > 0) {
                    person.phones = phones;
                }

                // Extract email addresses
                const emailElements = element.querySelectorAll('.showMore-list li:not(:has(a))');
                const emails = [];
                emailElements.forEach(el => {
                    const emailText = el.textContent.trim();
                    if (emailText && emailText.includes('@')) {
                        emails.push(emailText);
                    }
                });
                if (emails.length > 0) {
                    person.emails = emails;
                }

                // Extract relatives
                const relativeLinks = element.querySelectorAll('a[href*="/people/"]');
                const relatives = [];
                relativeLinks.forEach(link => {
                    const name = link.textContent.trim();
                    if (name && (!person.name || !name.includes(person.name))) {
                        relatives.push({
                            name: name,
                            url: link.href
                        });
                    }
                });
                if (relatives.length > 0) {
                    person.relatives = relatives;
                }

                // Extract addresses
                const addressLists = element.querySelectorAll('ul.flex.column-2 li, .address-list li');
                const addresses = [];
                addressLists.forEach(li => {
                    const addressText = li.textContent.trim();
                    if (addressText && addressText.length > 10 && addressText.match(/\d+/)) {
                        addresses.push({
                            address: addressText,
                            type: 'unknown'
                        });
                    }
                });
                if (addresses.length > 0) {
                    person.addresses = addresses;
                }

                // Extract aliases
                const aliasContainer = element.querySelector('#container-alt-names');
                if (aliasContainer) {
                    const aliasElements = aliasContainer.querySelectorAll('li');
                    const aliases = [];
                    aliasElements.forEach(el => {
                        aliases.push(el.textContent.trim());
                    });
                    if (aliases.length > 0) {
                        person.aliases = aliases;
                    }
                }

                // Extract details URL
                const detailsLink = element.querySelector('a[href*="/people/"]');
                if (detailsLink && (!person.name || detailsLink.textContent.trim().includes(person.name))) {
                    person.detailsUrl = detailsLink.href;
                }

                if (person.name || person.phones || person.emails || person.addresses) {
                    people.push(person);
                }
            });

            return people;
        }

        extractPersonDetailsData() {
            const person = {
                type: 'detailed_record',
                status: 'found'
            };

            // Extract name from ZabaSearch structure
            const nameElement = document.querySelector('#container-name h2, h1');
            if (nameElement) {
                person.name = nameElement.textContent.replace(/^\d+\s+record found for /, '').trim();
            }

            // Extract age
            const ageElement = document.querySelector('.flex h3');
            if (ageElement && ageElement.previousElementSibling &&
                ageElement.previousElementSibling.textContent.includes('Age')) {
                person.age = ageElement.textContent.trim();
            }

            // Extract all sections with data
            const sections = document.querySelectorAll('.section-box');

            sections.forEach(section => {
                const heading = section.querySelector('h3, h4');
                if (!heading) return;

                const headingText = heading.textContent.toLowerCase();

                // Phone numbers
                if (headingText.includes('phone')) {
                    const phoneLinks = section.querySelectorAll('a[href*="/phone/"]');
                    const phones = [];
                    phoneLinks.forEach(link => {
                        phones.push({
                            number: link.textContent.trim(),
                            url: link.href,
                            type: headingText.includes('last known') ? 'last_known' : 'associated'
                        });
                    });
                    if (phones.length > 0) {
                        person.phones = phones;
                    }
                }

                // Email addresses
                if (headingText.includes('email')) {
                    const emailElements = section.querySelectorAll('li:not(:has(a))');
                    const emails = [];
                    emailElements.forEach(el => {
                        const emailText = el.textContent.trim();
                        if (emailText.includes('@')) {
                            emails.push(emailText);
                        }
                    });
                    if (emails.length > 0) {
                        person.emails = emails;
                    }
                }

                // Addresses
                if (headingText.includes('address')) {
                    const addressElements = section.querySelectorAll('p, li');
                    const addresses = [];
                    addressElements.forEach(el => {
                        const addressText = el.textContent.trim();
                        if (addressText.length > 10 && addressText.match(/\d+/)) {
                            addresses.push({
                                address: addressText,
                                type: headingText.includes('past') ? 'past' :
                                       headingText.includes('last known') ? 'current' : 'unknown'
                            });
                        }
                    });
                    if (addresses.length > 0) {
                        person.addresses = addresses;
                    }
                }

                // Relatives
                if (headingText.includes('relative')) {
                    const relativeLinks = section.querySelectorAll('a[href*="/people/"]');
                    const relatives = [];
                    relativeLinks.forEach(link => {
                        relatives.push({
                            name: link.textContent.trim(),
                            url: link.href
                        });
                    });
                    if (relatives.length > 0) {
                        person.relatives = relatives;
                    }
                }

                // Aliases
                if (headingText.includes('alias') || headingText.includes('aka')) {
                    const aliasElements = section.querySelectorAll('li');
                    const aliases = [];
                    aliasElements.forEach(el => {
                        aliases.push(el.textContent.trim());
                    });
                    if (aliases.length > 0) {
                        person.aliases = aliases;
                    }
                }
            });

            return Object.keys(person).length > 1 ? person : null;
        }

        convertToText(data, scope) {
            let text = `ZABASEARCH EXPORT\n`;
            text += `Page URL: ${data.url}\n`;
            text += `Export Time: ${new Date().toLocaleString()}\n`;
            text += `Records Count: ${data.results.length}\n`;
            if (data.searchLocation) {
                const loc = data.searchLocation;
                if (loc.state && loc.cityOrCounty) {
                    text += `Search Location: ${loc.cityOrCounty}, ${loc.state}\n`;
                } else if (loc.state) {
                    text += `Search Location: ${loc.state}\n`;
                }
            }
            text += '='.repeat(60) + '\n\n';

            data.results.forEach((result, index) => {
                text += `RECORD ${index + 1}:\n`;
                text += `Name: ${result.name || 'N/A'}\n`;
                text += `Age: ${result.age || 'N/A'}\n`;
                text += `Location: ${result.location || 'N/A'}\n`;

                if (result.aliases && result.aliases.length > 0) {
                    text += `Aliases: ${result.aliases.join(', ')}\n`;
                }

                if (result.addresses && result.addresses.length > 0) {
                    text += `Addresses:\n`;
                    result.addresses.forEach(addr => {
                        text += `  - ${addr.address} (${addr.type || 'unknown'})\n`;
                    });
                }

                if (result.phones && result.phones.length > 0) {
                    text += `Phones:\n`;
                    result.phones.forEach(phone => {
                        text += `  - ${phone.number}${phone.type ? ` (${phone.type})` : ''}\n`;
                    });
                }

                if (result.emails && result.emails.length > 0) {
                    text += `Emails: ${result.emails.join(', ')}\n`;
                }

                if (result.relatives && result.relatives.length > 0) {
                    text += `Relatives: ${result.relatives.map(rel => rel.name).join(', ')}\n`;
                }

                text += '\n' + '-'.repeat(40) + '\n\n';
            });

            return text;
        }
    }

    // Vote.org Extractor Class
    class VoteOrgExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();

            // Check for registered voter page FIRST (most specific)
            if (this.isRegisteredVoterPage()) {
                data.results = this.extractVoterRegistrationData();
                data.pageType = 'voter_registration_results';
            }
            // Check for no registration found
            else if (this.isNoRegistrationPage()) {
                data.results = this.extractNoRegistrationData();
                data.pageType = 'no_registration';
            }
            // Check if this is the search form page
            else if (this.isSearchFormPage()) {
                data.results = [{ status: 'search_form', message: 'Voter registration search form' }];
                data.pageType = 'search_form';
            }
            // Fallback: check page content for registration status
            else {
                data.results = this.extractFromPageContent();
                if (data.results.length > 0) {
                    data.pageType = data.results[0].isRegistered ? 'voter_registration_results' : 'no_registration';
                }
            }

            return data;
        }

        autofillForm(data = null) {
            const form = document.querySelector('form#verification_form');
            if (!form) {
                console.log('Universal Exporter: No Vote.org form found on this page');
                return false;
            }

            // Use provided data or generate sample data
            const fillData = data || this.generateSampleData();

            let filledFields = 0;

            // Fill first name
            const firstNameInput = form.querySelector('input[name="first_name"]');
            if (firstNameInput && fillData.firstName) {
                firstNameInput.value = fillData.firstName;
                filledFields++;
            }

            // Fill last name
            const lastNameInput = form.querySelector('input[name="last_name"]');
            if (lastNameInput && fillData.lastName) {
                lastNameInput.value = fillData.lastName;
                filledFields++;
            }

            // Fill street address
            const streetInput = form.querySelector('input[name="street_address"]');
            if (streetInput && fillData.streetAddress) {
                streetInput.value = fillData.streetAddress;
                filledFields++;
            }

            // Fill city
            const cityInput = form.querySelector('input[name="city"]');
            if (cityInput && fillData.city) {
                cityInput.value = fillData.city;
                filledFields++;
            }

            // Fill state (dropdown)
            const stateSelect = form.querySelector('select[name="state_abbr"]');
            if (stateSelect && fillData.state) {
                const option = Array.from(stateSelect.options).find(opt =>
                    opt.value.toUpperCase() === fillData.state.toUpperCase()
                );
                if (option) {
                    stateSelect.value = option.value;
                    filledFields++;
                }
            }

            // Fill ZIP code
            const zipInput = form.querySelector('input[name="zip_5"]');
            if (zipInput && fillData.zipCode) {
                zipInput.value = fillData.zipCode;
                filledFields++;
            }

            // Fill email (hidden - use default)
            const emailInput = form.querySelector('input[name="email"]');
            if (emailInput) {
                emailInput.value = 'tahis60368@haotuwu.com';
                filledFields++;
            }

            // Fill date of birth (01/01/ with user year)
            const dobMonth = form.querySelector('select[name="date_of_birth_month"]');
            const dobDay = form.querySelector('select[name="date_of_birth_day"]');
            const dobYear = form.querySelector('select[name="date_of_birth_year"]');
            if (dobMonth && dobDay && dobYear) {
                // Always set to 01/01/
                dobMonth.value = '1';
                dobDay.value = '1';

                // Use provided year or current year - 30 as default
                if (fillData.dobYear) {
                    dobYear.value = fillData.dobYear;
                } else {
                    const currentYear = new Date().getFullYear();
                    dobYear.value = (currentYear - 30).toString();
                }
                filledFields += 3;
            }

            // Fill phone number (optional)
            const phoneInput = form.querySelector('input[name="phone_number"]');
            if (phoneInput && fillData.phone) {
                phoneInput.value = fillData.phone;
                filledFields++;
            }

            // Check the terms agreement checkbox
            const termsCheckbox = form.querySelector('input[name="agreed_to_terms"]');
            if (termsCheckbox) {
                termsCheckbox.checked = true;
                filledFields++;
            }

            console.log(`Universal Exporter: Autofilled ${filledFields} form fields`);
            return filledFields > 0;
        }

        // Add this method to generate sample data
        generateSampleData() {
            // Sample data for testing
            const sampleData = {
                firstName: 'John',
                lastName: 'Smith',
                streetAddress: '123 Main Street',
                city: 'Anytown',
                state: 'CA',
                zipCode: '90210',
                dobYear: '1985',
                phone: '(555) 123-4567'
            };

            // Try to get previously used data from storage
            try {
                const previousData = GM_getValue('vote_org_previous_data', null);
                if (previousData) {
                    return previousData;
                }
            } catch (error) {
                // Fall back to sample data if storage fails
                console.log('Universal Exporter: Error loading saved data, using sample data');
            }

            return sampleData;
        }

        // Update the extractFormData method to match the form structure
        extractFormData() {
            const form = document.querySelector('form#verification_form');
            if (!form) return null;

            const formData = {};

            const firstNameInput = form.querySelector('input[name="first_name"]');
            if (firstNameInput) formData.firstName = firstNameInput.value;

            const lastNameInput = form.querySelector('input[name="last_name"]');
            if (lastNameInput) formData.lastName = lastNameInput.value;

            const streetInput = form.querySelector('input[name="street_address"]');
            if (streetInput) formData.streetAddress = streetInput.value;

            const cityInput = form.querySelector('input[name="city"]');
            if (cityInput) formData.city = cityInput.value;

            const stateSelect = form.querySelector('select[name="state_abbr"]');
            if (stateSelect) formData.state = stateSelect.value;

            const zipInput = form.querySelector('input[name="zip_5"]');
            if (zipInput) formData.zipCode = zipInput.value;

            const emailInput = form.querySelector('input[name="email"]');
            if (emailInput) formData.email = emailInput.value;

            const phoneInput = form.querySelector('input[name="phone_number"]');
            if (phoneInput) formData.phone = phoneInput.value;

            const dobMonth = form.querySelector('select[name="date_of_birth_month"]');
            const dobDay = form.querySelector('select[name="date_of_birth_day"]');
            const dobYear = form.querySelector('select[name="date_of_birth_year"]');
            if (dobMonth && dobDay && dobYear) {
                formData.dobMonth = dobMonth.value;
                formData.dobDay = dobDay.value;
                formData.dobYear = dobYear.value;
            }

            return formData;
        }

        saveFormData(formData) {
            try {
                GM_setValue('vote_org_previous_data', formData);
            } catch (error) {
                console.log('Universal Exporter: Error saving form data');
            }
        }

        isRegisteredVoterPage() {
            // Check for explicit registered voter indicators
            const hasRegisteredClass = document.querySelector('.registered-lead') !== null;
            const hasGreenCheck = document.querySelector('.green-check') !== null;
            const hasRegisteredText = document.querySelector('h2')?.textContent.includes('You are registered to vote');

            // Check for positive confirmation in the main content
            const bodyText = document.body.textContent;
            const hasPositiveConfirmation = bodyText.includes('is registered to vote at') &&
                                           !bodyText.includes('could not confirm') &&
                                           !bodyText.includes('do NOT show');

            return hasRegisteredClass || hasGreenCheck || hasRegisteredText || hasPositiveConfirmation;
        }

        isNoRegistrationPage() {
            // Check for explicit "not registered" indicators
            const hasNotRegisteredClass = document.querySelector('.not-registered') !== null;
            const hasNotRegisteredLead = document.querySelector('.not-registered-lead') !== null;
            const hasRedCross = document.querySelector('.red-cross') !== null;

            // Check page content for negative indicators
            const bodyText = document.body.textContent;
            const hasNegativeIndicators = bodyText.includes('We could not confirm that you are registered to vote') ||
                                         bodyText.includes('Our records do NOT show that') ||
                                         bodyText.includes('is not registered to vote at');

            // Check for the specific "could not confirm" text in headings
            const headings = document.querySelectorAll('h1, h2, h3');
            let hasNegativeHeading = false;
            headings.forEach(heading => {
                const text = heading.textContent.trim();
                if (text.includes('could not confirm') || text.includes('not registered')) {
                    hasNegativeHeading = true;
                }
            });

            return hasNotRegisteredClass || hasNotRegisteredLead || hasRedCross ||
                   hasNegativeIndicators || hasNegativeHeading;
        }

        isSearchFormPage() {
            return document.querySelector('form[action*="vote.org"]') !== null ||
                   document.querySelector('input[name*="voter"]') !== null ||
                   document.querySelector('.vote-org-form form') !== null;
        }

        extractFromPageContent() {
            const bodyText = document.body.textContent;
            const results = [];

            // Try to extract registration status from page content
            if (bodyText.includes('is registered to vote at') && !bodyText.includes('could not confirm')) {
                // This appears to be a registered voter
                const voter = {
                    type: 'voter_registration',
                    status: 'found',
                    isRegistered: true,
                    registrationStatus: 'Registered to Vote'
                };
                this.extractVoterDetailsFromContent(voter);
                results.push(voter);
            }
            else if (bodyText.includes('could not confirm') || bodyText.includes('do NOT show')) {
                // This appears to be not registered
                const voter = {
                    type: 'voter_registration',
                    status: 'not_found',
                    isRegistered: false,
                    registrationStatus: 'Not Registered - Could Not Confirm'
                };
                this.extractVoterDetailsFromContent(voter);
                results.push(voter);
            }

            return results;
        }

        extractVoterDetailsFromContent(voter) {
            // Extract name from bold elements
            const boldElements = document.querySelectorAll('b');
            boldElements.forEach(element => {
                const text = element.textContent.trim();
                // Look for name (typically appears in address blocks)
                if (text && text.length > 5 && text.length < 50 && !text.match(/^\d/)) {
                    voter.fullName = text;
                }
            });

            // Extract address from elements with address-related classes or content
            const addressSelectors = ['.ldv-address b', '.address-block b', '[class*="address"] b'];
            addressSelectors.forEach(selector => {
                const addressElement = document.querySelector(selector);
                if (addressElement && !voter.registrationAddress) {
                    voter.registrationAddress = addressElement.textContent.trim();
                    this.parseAddressComponents(voter);
                }
            });

            // Fallback: look for address patterns in the text
            if (!voter.registrationAddress) {
                const addressMatch = document.body.textContent.match(/\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}/);
                if (addressMatch) {
                    voter.registrationAddress = addressMatch[0];
                    this.parseAddressComponents(voter);
                }
            }
        }

        extractVoterRegistrationData() {
            const voter = {
                type: 'voter_registration',
                status: 'found',
                isRegistered: true,
                registrationStatus: 'Registered to Vote'
            };

            // Extract registration status
            const statusElement = document.querySelector('.registered-lead');
            if (statusElement) {
                voter.registrationStatus = statusElement.textContent.trim();
            }

            // Extract voter name
            const nameElement = document.querySelector('.address-block b');
            if (nameElement) {
                voter.fullName = nameElement.textContent.trim();
            }

            // Extract address
            const addressElement = document.querySelector('.ldv-address b');
            if (addressElement) {
                voter.registrationAddress = addressElement.textContent.trim();
                this.parseAddressComponents(voter);
            }

            // Extract additional voter information if available
            this.extractAdditionalVoterInfo(voter);

            return [voter];
        }

        extractNoRegistrationData() {
            const voter = {
                type: 'voter_registration',
                status: 'not_found',
                isRegistered: false,
                registrationStatus: 'Not Registered - Could Not Confirm'
            };

            // Extract the main message
            const notRegisteredLead = document.querySelector('.not-registered-lead');
            if (notRegisteredLead) {
                voter.message = notRegisteredLead.textContent.trim();
            } else {
                const headings = document.querySelectorAll('h1, h2, h3');
                headings.forEach(heading => {
                    const text = heading.textContent.trim();
                    if (text.includes('could not confirm') || text.includes('not registered')) {
                        voter.message = text;
                    }
                });
            }

            // Extract name from the address block
            const nameElement = document.querySelector('.address-block b');
            if (nameElement) {
                voter.fullName = nameElement.textContent.trim();
            }

            // Extract address
            const addressElement = document.querySelector('.ldv-address b');
            if (addressElement) {
                voter.registrationAddress = addressElement.textContent.trim();
                this.parseAddressComponents(voter);
            }

            // Extract reasons or additional information
            const reasons = [];
            const listItems = document.querySelectorAll('li');
            listItems.forEach(li => {
                const text = li.textContent.trim();
                if (text && (text.includes('registered') || text.includes('inaccurate') || text.includes('incomplete') || text.includes('updating'))) {
                    reasons.push(text);
                }
            });

            if (reasons.length > 0) {
                voter.possibleReasons = reasons;
            }

            // Extract recommendation text
            const bodyText = document.body.textContent;
            if (bodyText.includes('double check with your state') || bodyText.includes('click through to the next page')) {
                voter.recommendation = 'Double check with your state election office';
            }

            // Extract hidden form data if available
            this.extractFormData(voter);

            return [voter];
        }

        parseAddressComponents(voter) {
            if (!voter.registrationAddress) return;

            const addressParts = voter.registrationAddress.split(',');
            if (addressParts.length >= 2) {
                voter.streetAddress = addressParts[0].trim();
                voter.cityStateZip = addressParts.slice(1).join(',').trim();

                // Further parse city, state, zip
                const cityStateZipMatch = voter.cityStateZip.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?\.?)/);
                if (cityStateZipMatch) {
                    voter.city = cityStateZipMatch[1].trim();
                    voter.state = cityStateZipMatch[2].trim();
                    voter.zipCode = cityStateZipMatch[3].replace(/\.$/, '').trim(); // Remove trailing period
                }
            }
        }

        extractAdditionalVoterInfo(voter) {
            const additionalInfoElements = document.querySelectorAll('.results-block');
            additionalInfoElements.forEach(element => {
                const text = element.textContent.trim();

                // Look for polling place information
                if (text.toLowerCase().includes('polling place') || text.toLowerCase().includes('precinct')) {
                    voter.pollingPlace = text;
                }

                // Look for election district information
                if (text.toLowerCase().includes('district') || text.toLowerCase().includes('ward')) {
                    voter.district = text;
                }

                // Look for registration date
                if (text.toLowerCase().includes('registered') && text.toLowerCase().includes('date')) {
                    voter.registrationDate = text.replace(/.*registered\s*:\s*/i, '').trim();
                }
            });

            // Extract any timestamp or last update information
            const timestampElements = document.querySelectorAll('small, .timestamp, .last-updated');
            timestampElements.forEach(element => {
                const text = element.textContent.trim();
                if (text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || text.includes('updated') || text.includes('as of')) {
                    voter.lastUpdated = text;
                }
            });
        }

        extractFormData(voter) {
            const firstNameInput = document.querySelector('input[name="first_name"]');
            const lastNameInput = document.querySelector('input[name="last_name"]');
            if (firstNameInput && lastNameInput) {
                voter.searchedFirstName = firstNameInput.value;
                voter.searchedLastName = lastNameInput.value;
            }

            const streetInput = document.querySelector('input[name="street_address"]');
            const cityInput = document.querySelector('input[name="city"]');
            const stateInput = document.querySelector('input[name="state_abbr"]');
            const zipInput = document.querySelector('input[name="zip_5"]');
            if (streetInput && cityInput && stateInput && zipInput) {
                voter.searchedAddress = {
                    street: streetInput.value,
                    city: cityInput.value,
                    state: stateInput.value,
                    zip: zipInput.value
                };
            }
        }

        convertToText(data, scope) {
            let text = `VOTE.ORG VOTER REGISTRATION EXPORT\n`;
            text += `Page URL: ${data.url}\n`;
            text += `Export Time: ${new Date().toLocaleString()}\n`;
            text += `Records Count: ${data.results.length}\n`;
            text += '='.repeat(60) + '\n\n';

            data.results.forEach((result, index) => {
                if (result.type === 'voter_registration') {
                    text += `VOTER REGISTRATION RECORD:\n`;
                    text += `Registration Status: ${result.registrationStatus || 'N/A'}\n`;
                    text += `Registered: ${result.isRegistered ? 'YES' : 'NO'}\n`;

                    if (result.fullName) {
                        text += `Full Name: ${result.fullName}\n`;
                    }

                    if (result.registrationAddress) {
                        text += `Registration Address: ${result.registrationAddress}\n`;
                    }

                    if (result.streetAddress) {
                        text += `Street Address: ${result.streetAddress}\n`;
                    }

                    if (result.city && result.state) {
                        text += `City, State: ${result.city}, ${result.state}\n`;
                    }

                    if (result.zipCode) {
                        text += `ZIP Code: ${result.zipCode}\n`;
                    }

                    if (result.pollingPlace) {
                        text += `Polling Place: ${result.pollingPlace}\n`;
                    }

                    if (result.district) {
                        text += `District: ${result.district}\n`;
                    }

                    if (result.registrationDate) {
                        text += `Registration Date: ${result.registrationDate}\n`;
                    }

                    if (result.lastUpdated) {
                        text += `Last Updated: ${result.lastUpdated}\n`;
                    }

                    if (result.message) {
                        text += `Message: ${result.message}\n`;
                    }

                    if (result.possibleReasons && result.possibleReasons.length > 0) {
                        text += `Possible Reasons:\n`;
                        result.possibleReasons.forEach(reason => {
                            text += `  - ${reason}\n`;
                        });
                    }

                    if (result.recommendation) {
                        text += `Recommendation: ${result.recommendation}\n`;
                    }

                    if (result.searchedFirstName && result.searchedLastName) {
                        text += `Searched Name: ${result.searchedFirstName} ${result.searchedLastName}\n`;
                    }

                    if (result.searchedAddress) {
                        text += `Searched Address: ${result.searchedAddress.street}, ${result.searchedAddress.city}, ${result.searchedAddress.state} ${result.searchedAddress.zip}\n`;
                    }
                } else if (result.status === 'search_form') {
                    text += `PAGE TYPE: SEARCH FORM\n`;
                    text += `Message: ${result.message}\n`;
                }

                text += '\n' + '-'.repeat(40) + '\n\n';
            });

            return text;
        }
    }

    // Generic Extractor for fallback
    class GenericExtractor extends BaseExtractor {
        extractData() {
            const data = super.extractData();

            // Try to extract any person-like data
            const potentialPeople = document.querySelectorAll('[class*="person"], [class*="result"], [class*="card"]');
            if (potentialPeople.length > 0) {
                data.results = this.extractGenericData(potentialPeople);
                data.pageType = 'generic_results';
            }

            return data;
        }

        extractGenericData(elements) {
            const people = [];

            elements.forEach((element, index) => {
                const person = {
                    type: 'generic_result',
                    status: 'found',
                    id: element.id || `generic_${index}`,
                    rawText: element.textContent.trim().substring(0, 200) + '...'
                };

                // Try to find name-like text (usually in headings)
                const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b');
                headings.forEach(heading => {
                    const text = heading.textContent.trim();
                    if (text && text.length > 2 && text.length < 50 && !person.name) {
                        person.name = text;
                    }
                });

                if (person.name || person.rawText.length > 50) {
                    people.push(person);
                }
            });

            return people;
        }
    }

    // Main Universal Exporter Class
    class UniversalBackgroundCheckExporter {
        constructor() {
            this.site = this.detectSite();
            this.isMobile = this.detectMobile();
            this.currentPageData = null;
            this.siteExtractor = null;
            this.init();
        }

        async init() {
            await this.waitForPageLoad();
            this.initializeSiteExtractor();
            this.extractCurrentPageData();
            this.createUI();
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

        showStreetView() {
            if (!this.currentCoords) {
                const resultsDiv = document.getElementById('ubcMapsResults');
                resultsDiv.innerHTML = '<div style="color: #e74c3c;">Please geocode an address first</div>';
                return;
            }

            const streetViewUrl = MapsUtility.generateStreetViewUrl(this.currentCoords.lat, this.currentCoords.lng);
            window.open(streetViewUrl, '_blank');
        }



        initializeSiteExtractor() {
            switch (this.site) {
                case 'fastbackgroundcheck':
                    this.siteExtractor = new FastBackgroundCheckExtractor();
                    break;
                case 'fastpeoplesearch':
                    this.siteExtractor = new FastPeopleSearchExtractor();
                    break;
                case 'zabasearch':
                    this.siteExtractor = new ZabaSearchExtractor();
                    break;
                case 'vote.org':
                    this.siteExtractor = new VoteOrgExtractor();
                    break;
                default:
                    this.siteExtractor = new GenericExtractor();
            }
        }

        detectSite() {
            const url = window.location.href;
            if (url.includes('fastbackgroundcheck.com')) return 'fastbackgroundcheck';
            if (url.includes('fastpeoplesearch.com')) return 'fastpeoplesearch';
            if (url.includes('zabasearch.com')) return 'zabasearch';
            if (url.includes('verify.vote.org') || url.includes('vote.org')) return 'vote.org';
            return 'unknown';
        }

        detectMobile() {
            return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        extractCurrentPageData() {
            this.currentPageData = this.siteExtractor.extractData();
            return this.currentPageData;
        }


createUI() {
    // Remove existing UI if present
    const existingUI = document.getElementById('ubc-exporter-ui');
    if (existingUI) {
        existingUI.remove();
    }

    // Create main container
    const container = document.createElement('div');
    container.id = 'ubc-exporter-ui';

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
            font-size: 14px;
            max-height: 80vh;
            overflow-y: auto;
        `;
    } else {
        container.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 500px;
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

    // Header with site info and branding
    const header = document.createElement('div');
    header.style.cssText = 'border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 15px;';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    const title = document.createElement('h3');
    const siteNames = {
        'fastbackgroundcheck': 'FastBackgroundCheck',
        'fastpeoplesearch': 'FastPeopleSearch',
        'zabasearch': 'ZabaSearch',
        'vote.org': 'Vote.org'
    };
    title.textContent = `Universal Exporter v2.2.0 - ${siteNames[this.site] || this.site}`;
    title.style.cssText = 'margin: 0; margin-left: 100px; color: #2c3e50; font-size: 16px;';
    titleRow.appendChild(title);
    header.appendChild(titleRow);

    // Quick navigation links
    const navLinks = document.createElement('div');
    navLinks.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; margin-left: 50px; font-size: 11px;';
    navLinks.innerHTML = `
        <a href="https://www.fastbackgroundcheck.com" target="_blank" style="color: #3498db; text-decoration: none; padding: 3px 6px; border: 1px solid #3498db; border-radius: 3px;">FastBackgroundCheck</a>
        <a href="https://www.fastpeoplesearch.com" target="_blank" style="color: #27ae60; text-decoration: none; padding: 3px 6px; border: 1px solid #27ae60; border-radius: 3px;">FastPeopleSearch</a>
        <a href="https://www.zabasearch.com" target="_blank" style="color: #f39c12; text-decoration: none; padding: 3px 6px; border: 1px solid #f39c12; border-radius: 3px;">ZabaSearch</a>
        <a href="https://verify.vote.org/" target="_blank" style="color: #9b59b6; text-decoration: none; padding: 3px 6px; border: 1px solid #9b59b6; border-radius: 3px;">Vote.org</a>
    `;
    header.appendChild(navLinks);

    // Search Section
    const searchSection = document.createElement('div');
    searchSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #e9ecef;';
    searchSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #2c3e50;">Quick Search:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcSearchFirstName" placeholder="First Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcSearchLastName" placeholder="Last Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcSearchCity" placeholder="City (optional)" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcSearchState" placeholder="State *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="font-size: 10px; color: #666; margin-bottom: 8px;">
            * Required fields. State is required for all searches.
        </div>
        <button id="ubcGenerateSearch" style="background: #9b59b6; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">Generate Search Links</button>
        <div id="ubcSearchResults" style="margin-top: 10px; font-size: 11px; display: none;"></div>
    `;

    // Vote.org API Section
    const voteOrgSection = document.createElement('div');
    voteOrgSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #f0e6ff; border-radius: 4px; border: 1px solid #d9c2ff;';
    voteOrgSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #6b46c1;">Vote.org API Check:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcVoteFirstName" placeholder="First Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteLastName" placeholder="Last Name *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteStreet" placeholder="Street Address *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; width: auto;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcVoteCity" placeholder="City *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteState" placeholder="State *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="ubcVoteZip" placeholder="ZIP Code *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            <input type="text" id="ubcVoteYear" placeholder="Birth Year (YYYY) *" style="padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="font-size: 10px; color: #666; margin-bottom: 8px;">
            * Required fields. Date of birth will be set to 01/01/YYYY automatically. see why <a href="https://gist.github.com/airborne-commando/cfdf2c1d6e27520f7446f6e774285237#voter-extraction-lite" target="_blank" style="color: #9b59b6">here</a>.
        </div>
        <button id="ubcCheckVoter" style="background: #6b46c1; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">Check Voter Status via API</button>
        <div id="ubcVoteResults" style="margin-top: 10px; font-size: 11px; display: none;"></div>
    `;

    // Current page info
    const pageInfo = document.createElement('div');
    pageInfo.style.cssText = 'margin-bottom: 10px; padding: 8px; background: #e8f4fd; border-radius: 4px; font-size: 12px;';

    const pageType = this.currentPageData.pageType === 'search_results' ? 'Search Results' :
                   this.currentPageData.pageType === 'person_details' ? 'Person Details' :
                   this.currentPageData.pageType === 'people_list' ? 'People List' :
                   this.currentPageData.pageType === 'voter_registration_results' ? 'Voter Registration' :
                   this.currentPageData.pageType === 'no_registration' ? 'No Registration' :
                   this.currentPageData.pageType === 'search_form' ? 'Search Form' : 'No Results';

    let locationInfo = '';
    if (this.currentPageData.searchLocation) {
        const loc = this.currentPageData.searchLocation;
        if (loc.state && loc.cityOrCounty) {
            locationInfo = `<br><strong>Location:</strong> ${loc.cityOrCounty}, ${loc.state}`;
        } else if (loc.state) {
            locationInfo = `<br><strong>Location:</strong> ${loc.state}`;
        }
    }

    pageInfo.innerHTML = `
        <strong>Site:</strong> ${siteNames[this.site] || this.site}<br>
        <strong>Page Type:</strong> ${pageType}<br>
        <strong>Records Found:</strong> ${this.currentPageData.results.length}${locationInfo}<br>
        <small>${window.location.href}</small>
    `;

    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.style.cssText = this.isMobile ?
        'margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;' :
        'margin: 10px 0; display: flex; flex-wrap: wrap; gap: 8px;';

    actionButtons.innerHTML = this.isMobile ? `
        <button id="ubcSavePageBtn" style="background: #3498db; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; grid-column: 1 / -1;">Save Current Page</button>
        <button id="ubcExportBtn" style="background: #27ae60; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Export Data</button>
        <button id="ubcViewSavedBtn" style="background: #f39c12; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">View Saved</button>
        <button id="ubcAutofillBtn" style="background: #9b59b6; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Autofill Form</button>
        <button id="ubcImportBtn" style="background: #e67e22; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Import Data</button>
        <button id="ubcClearBtn" style="background: #e74c3c; color: white; border: none; padding: 12px 8px; border-radius: 6px; cursor: pointer; font-size: 14px;">Clear Data</button>
    ` : `
        <button id="ubcSavePageBtn" style="background: #3498db; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Save Page</button>
        <button id="ubcExportBtn" style="background: #27ae60; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Export</button>
        <button id="ubcViewSavedBtn" style="background: #f39c12; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">View Saved</button>
        <button id="ubcAutofillBtn" style="background: #9b59b6; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Autofill</button>
        <button id="ubcImportBtn" style="background: #e67e22; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Import</button>
        <button id="ubcClearBtn" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; flex: 1;">Clear</button>
    `;

    // Quick Maps Section
    const quickMapsSection = document.createElement('div');
    quickMapsSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;';
    quickMapsSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #856404;">🗺️ Quick Maps:</div>
        <div style="margin-bottom: 8px;">
            <input type="text" id="ubcQuickMaps" placeholder="Enter address for maps..."
                   style="width: 70%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; margin-bottom: 8px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button id="ubcGoogleMapsBtn" style="background: #4285f4; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                    Google Maps
                </button>
                <button id="ubcBingMapsBtn" style="background: #008373; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                    Bing Maps
                </button>
                <button id="ubcOpenstreetMapsBtn" style="background: #7ebc6f; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                OpenStreetMap
            </button>
                <button id="ubcOpenEarth" style="background: #4285f4; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Google Earth
            </button>
            </div>
        </div>
        <div style="font-size: 10px; color: #666;">
            Quick address lookup on all mapping platforms
        </div>
`;

    // Export options
    const optionsDiv = document.createElement('div');
    optionsDiv.style.cssText = 'margin: 10px 0;';
    optionsDiv.innerHTML = `
        <label style="display: block; margin-bottom: 8px; font-weight: bold;">Export Format:</label>
        <select id="ubcExportFormat" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="json">JSON</option>
            <option value="txt">Text</option>
        </select>
        <label style="display: block; margin-bottom: 8px; font-weight: bold;">Data Scope:</label>
        <select id="ubcDataScope" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="current">Current Page Only</option>
            <option value="all">All Saved Pages</option>
            <option value="site_all">All ${siteNames[this.site] || this.site} Pages</option>
        </select>
    `;

    // Status display
    const statusDiv = document.createElement('div');
    statusDiv.id = 'ubcExporterStatus';
    statusDiv.style.cssText = 'margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 13px;';
    statusDiv.innerHTML = '<strong>Status:</strong> Ready';

    // Preview area
    const previewDiv = document.createElement('div');
    previewDiv.id = 'ubcResultsPreview';
    previewDiv.style.cssText = `margin-top: 10px; border: 1px solid #ddd; padding: 10px; height: ${this.isMobile ? '150px' : '200px'}; overflow-y: auto; font-size: 11px; background: #f9f9f9; border-radius: 4px;`;
    previewDiv.innerHTML = '<div>Preview will appear here...</div>';

    // Footer with additional links
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; font-size: 10px; color: #666; text-align: center;';
    footer.innerHTML = `
        <div style="margin-bottom: 5px;">
            <strong>Quick Navigation:</strong>
            <a href="https://www.fastbackgroundcheck.com" target="_blank" style="color: #3498db; margin: 0 5px;">FBC</a> •
            <a href="https://www.fastpeoplesearch.com" target="_blank" style="color: #27ae60; margin: 0 5px;">FPS</a> •
            <a href="https://www.zabasearch.com" target="_blank" style="color: #f39c12; margin: 0 5px;">Zaba</a> •
            <a href="https://verify.vote.org/" target="_blank" style="color: #9b59b6; margin: 0 5px;">Vote</a>
        </div>
    `;

    // Assemble UI
    container.appendChild(header);
    container.appendChild(searchSection);
    container.appendChild(voteOrgSection);
    container.appendChild(pageInfo);
    container.appendChild(actionButtons);
    container.appendChild(quickMapsSection);
    container.appendChild(optionsDiv);
    container.appendChild(statusDiv);
    container.appendChild(previewDiv);
    container.appendChild(footer);

    document.body.appendChild(container);

    // Event listeners - ADD THEM AFTER ALL ELEMENTS ARE CREATED
    document.getElementById('ubcSavePageBtn').onclick = () => this.saveCurrentPage();
    document.getElementById('ubcExportBtn').onclick = () => this.exportData();
    document.getElementById('ubcViewSavedBtn').onclick = () => this.viewSavedPages();
    document.getElementById('ubcClearBtn').onclick = () => this.clearAllData();
    document.getElementById('ubcGenerateSearch').onclick = () => this.generateSearchLinks();
    document.getElementById('ubcCheckVoter').onclick = () => this.checkVoterStatus();
    document.getElementById('ubcExportFormat').addEventListener('change', () => this.updatePreview());
    document.getElementById('ubcDataScope').addEventListener('change', () => this.updatePreview());
    document.getElementById('ubcAutofillBtn').onclick = () => this.autofillForm();
    document.getElementById('ubcImportBtn').onclick = () => this.importSearchData();

    // Add event listener for quick maps
    document.getElementById('ubcGoogleMapsBtn').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            window.open(mapsUrl, '_blank');
        }
    };

    document.getElementById('ubcBingMapsBtn').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const bingUrl = `https://www.bing.com/maps?q=${encodeURIComponent(address)}`;
            window.open(bingUrl, '_blank');
        }
    };

    document.getElementById('ubcOpenstreetMapsBtn').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const SteetURL = `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
            window.open(SteetURL, '_blank');
        }
    };

    document.getElementById('ubcOpenEarth').onclick = () => {
        const address = document.getElementById('ubcQuickMaps').value.trim();
        if (address) {
            const EarthURL = `https://earth.google.com/web/search/${encodeURIComponent(address)}`;
            window.open(EarthURL, '_blank');
        }
    };

    // Add event listeners for advanced maps AFTER the section is added to DOM
    setTimeout(() => {
        const geocodeBtn = document.getElementById('ubcGeocodeBtn');
        const streetViewBtn = document.getElementById('ubcStreetViewBtn');
        const mapsAddressInput = document.getElementById('ubcMapsAddress');

        if (geocodeBtn) {
            geocodeBtn.onclick = () => this.showMapForAddress();
        }
        if (streetViewBtn) {
            streetViewBtn.onclick = () => this.showStreetView();
        }
        if (mapsAddressInput) {
            mapsAddressInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.showMapForAddress();
                }
            });
        }
    }, 100);

    this.log(`Universal exporter initialized for ${siteNames[this.site]}`);
    this.updatePreview();
}


        async checkVoterStatus() {
            const firstName = document.getElementById('ubcVoteFirstName').value.trim();
            const lastName = document.getElementById('ubcVoteLastName').value.trim();
            const streetAddress = document.getElementById('ubcVoteStreet').value.trim();
            const city = document.getElementById('ubcVoteCity').value.trim();
            const state = document.getElementById('ubcVoteState').value.trim();
            const zipCode = document.getElementById('ubcVoteZip').value.trim();
            const dobYear = document.getElementById('ubcVoteYear').value.trim();

            // Validate inputs
            if (!firstName || !lastName || !streetAddress || !city || !state || !zipCode || !dobYear) {
                this.log('Please fill all required fields for voter check');
                return;
            }

            if (!dobYear.match(/^\d{4}$/) || parseInt(dobYear) < 1900 || parseInt(dobYear) > new Date().getFullYear()) {
                this.log('Please enter a valid 4-digit birth year');
                return;
            }

            this.log('Checking voter registration status via API...');

            const voterData = {
                firstName,
                lastName,
                streetAddress,
                city,
                state,
                zipCode,
                dobYear
            };

            try {
                const result = await VoteOrgAPI.checkVoterStatus(voterData);

                if (result.success) {
                    const voterInfo = VoteOrgAPI.parseVoterResponse(result.responseText);

                    // Display results
                    const resultsDiv = document.getElementById('ubcVoteResults');
                    let html = '<div style="font-weight: bold; margin-bottom: 5px;">Voter Registration Results:</div>';

                    if (voterInfo.isRegistered) {
                        html += `<div style="color: #27ae60; font-weight: bold;">✓ REGISTERED TO VOTE</div>`;
                    } else {
                        html += `<div style="color: #e74c3c; font-weight: bold;">✗ NOT REGISTERED</div>`;
                    }

                    if (voterInfo.fullName) {
                        html += `<div><strong>Name:</strong> ${voterInfo.fullName}</div>`;
                    }

                    if (voterInfo.registrationAddress) {
                        html += `<div><strong>Address:</strong> ${voterInfo.registrationAddress}</div>`;
                    }

                    html += `<div><strong>Status:</strong> ${voterInfo.registrationStatus}</div>`;
                    html += `<div style="margin-top: 8px; font-size: 10px; color: #666;">API request successful</div>`;

                    resultsDiv.innerHTML = html;
                    resultsDiv.style.display = 'block';

                    this.log(`Voter check completed: ${voterInfo.registrationStatus}`);

                    // Save the result
                    this.saveVoterResult(voterInfo, voterData);

                } else {
                    this.log(`API request failed: ${result.error}`);
                    const resultsDiv = document.getElementById('ubcVoteResults');
                    resultsDiv.innerHTML = `<div style="color: #e74c3c;">API request failed: ${result.error}</div>`;
                    resultsDiv.style.display = 'block';
                }
            } catch (error) {
                this.log(`Error checking voter status: ${error}`);
                const resultsDiv = document.getElementById('ubcVoteResults');
                resultsDiv.innerHTML = `<div style="color: #e74c3c;">Error: ${error.message}</div>`;
                resultsDiv.style.display = 'block';
            }
        }

        saveVoterResult(voterInfo, voterData) {
            try {
                const pageKey = `ubc_vote.org_api_${Date.now()}`;
                const pageData = {
                    url: 'https://verify.vote.org/your-status (API)',
                    timestamp: new Date().toISOString(),
                    pageTitle: 'Vote.org API Check',
                    results: [voterInfo],
                    pageType: 'api_voter_check',
                    site: 'vote.org',
                    siteName: 'Vote.org',
                    searchData: voterData
                };

                GM_setValue(pageKey, pageData);

                // Add to the list of saved pages
                const savedPages = GM_getValue('ubc_saved_pages', []);
                savedPages.push({
                    key: pageKey,
                    url: pageData.url,
                    timestamp: pageData.timestamp,
                    resultCount: 1,
                    site: 'vote.org',
                    siteName: 'Vote.org',
                    location: { state: voterData.state, cityOrCounty: voterData.city }
                });
                GM_setValue('ubc_saved_pages', savedPages);

                this.log('Saved voter check result');
                this.updatePreview();
            } catch (error) {
                this.log(`Error saving voter result: ${error}`);
            }
        }

        // ... (rest of the existing methods remain the same)
        generateSearchLinks() {
            const firstName = document.getElementById('ubcSearchFirstName').value.trim();
            const lastName = document.getElementById('ubcSearchLastName').value.trim();
            const city = document.getElementById('ubcSearchCity').value.trim();
            const state = document.getElementById('ubcSearchState').value.trim();

            // Validate inputs
            if (!SearchUtility.validateName(firstName) || !SearchUtility.validateName(lastName)) {
                this.log('Please enter both first and last name');
                return;
            }

            if (!SearchUtility.validateState(state)) {
                this.log('Please enter a state (required for all searches)');
                return;
            }

            // Generate URLs
            const urls = SearchUtility.generateSearchURLs(firstName, lastName, city, state);
            const resultsDiv = document.getElementById('ubcSearchResults');

            let html = '<div style="font-weight: bold; margin-bottom: 5px;">Generated Search Links:</div>';

            // FastPeopleSearch links
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="color: #27ae60;">FastPeopleSearch:</strong><br>';
            urls.fastpeoplesearch.forEach(url => {
                html += `<a href="${url}" target="_blank" style="color: #27ae60; font-size: 10px; display: block; margin: 2px 0; word-break: break-all;">${url}</a>`;
            });
            html += '</div>';

            // FastBackgroundCheck links
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="color: #3498db;">FastBackgroundCheck:</strong><br>';
            urls.fastbackgroundcheck.forEach(url => {
                html += `<a href="${url}" target="_blank" style="color: #3498db; font-size: 10px; display: block; margin: 2px 0; word-break: break-all;">${url}</a>`;
            });
            html += '</div>';

            // ZabaSearch links
            html += '<div style="margin-bottom: 8px;">';
            html += '<strong style="color: #f39c12;">ZabaSearch:</strong><br>';
            urls.zabasearch.forEach(url => {
                html += `<a href="${url}" target="_blank" style="color: #f39c12; font-size: 10px; display: block; margin: 2px 0; word-break: break-all;">${url}</a>`;
            });
            html += '</div>';

            resultsDiv.innerHTML = html;
            resultsDiv.style.display = 'block';

            this.log(`Generated ${urls.fastpeoplesearch.length + urls.fastbackgroundcheck.length + urls.zabasearch.length} search links`);
        }

        log(message) {
            const statusElement = document.getElementById('ubcExporterStatus');
            const timestamp = new Date().toLocaleTimeString();
            statusElement.innerHTML = `<strong>Status:</strong> [${timestamp}] ${message}`;
            console.log(`[Universal Exporter] ${message}`);
        }

        saveCurrentPage() {
            if (!this.currentPageData || this.currentPageData.results.length === 0) {
                this.log('No data to save on current page');
                return;
            }

            try {
                const pageKey = `ubc_${this.site}_page_${Date.now()}`;
                const pageData = {
                    ...this.currentPageData,
                    site: this.site,
                    siteName: this.getSiteName()
                };

                GM_setValue(pageKey, pageData);

                // Also add to the list of saved pages
                const savedPages = GM_getValue('ubc_saved_pages', []);
                savedPages.push({
                    key: pageKey,
                    url: this.currentPageData.url,
                    timestamp: this.currentPageData.timestamp,
                    resultCount: this.currentPageData.results.length,
                    site: this.site,
                    siteName: this.getSiteName(),
                    location: this.currentPageData.searchLocation
                });
                GM_setValue('ubc_saved_pages', savedPages);

                this.log(`Saved current page with ${this.currentPageData.results.length} records`);
                this.updatePreview();
            } catch (error) {
                this.log(`Error saving page: ${error}`);
            }
        }

        getSiteName() {
            const siteNames = {
                'fastbackgroundcheck': 'FastBackgroundCheck',
                'fastpeoplesearch': 'FastPeopleSearch',
                'zabasearch': 'ZabaSearch',
                'vote.org': 'Vote.org'
            };
            return siteNames[this.site] || this.site;
        }

        getAllSavedData(scope = 'all') {
            try {
                const savedPages = GM_getValue('ubc_saved_pages', []);
                let filteredPages = savedPages;

                if (scope === 'site_all') {
                    filteredPages = savedPages.filter(page => page.site === this.site);
                }

                const allData = [];
                filteredPages.forEach(pageInfo => {
                    const pageData = GM_getValue(pageInfo.key);
                    if (pageData) {
                        allData.push({
                            ...pageData,
                            savedKey: pageInfo.key
                        });
                    }
                });

                return allData;
            } catch (error) {
                this.log(`Error loading saved data: ${error}`);
                return [];
            }
        }

        updatePreview() {
            const format = document.getElementById('ubcExportFormat').value;
            const scope = document.getElementById('ubcDataScope').value;
            const previewDiv = document.getElementById('ubcResultsPreview');

            let dataToPreview;
            let title;

            if (scope === 'current') {
                dataToPreview = this.currentPageData;
                title = 'Current Page Data';
            } else {
                const allData = this.getAllSavedData(scope);
                dataToPreview = { pages: allData, totalPages: allData.length };
                const scopeText = scope === 'all' ? 'All Sites' : `All ${this.getSiteName()} Pages`;
                title = `${scopeText} (${allData.length} pages)`;
            }

            let previewContent = '';

            if (!dataToPreview || (scope !== 'current' && dataToPreview.totalPages === 0)) {
                previewContent = 'No data available for preview';
            } else {
                switch (format) {
                    case 'json':
                        previewContent = this.generateJSONPreview(dataToPreview, scope);
                        break;
                    case 'txt':
                        previewContent = this.generateTextPreview(dataToPreview, scope);
                        break;
                }
            }

            previewDiv.innerHTML = `
                <div style="margin-bottom: 5px; font-weight: bold;">${title}</div>
                <div style="font-family: monospace; white-space: pre-wrap; font-size: 10px;">${previewContent}</div>
            `;
        }

        generateJSONPreview(data, scope) {
            let previewData;
            if (scope === 'current') {
                previewData = {
                    site: this.site,
                    pageInfo: {
                        url: data.url,
                        timestamp: data.timestamp,
                        resultCount: data.results.length,
                        searchLocation: data.searchLocation
                    },
                    results: data.results.slice(0, 2)
                };
            } else {
                previewData = {
                    totalPages: data.totalPages,
                    pages: data.pages.slice(0, 1).map(page => ({
                        site: page.site,
                        url: page.url,
                        resultCount: page.results.length,
                        searchLocation: page.searchLocation,
                        sampleResults: page.results.slice(0, 1)
                    }))
                };
            }
            return JSON.stringify(previewData, null, 2);
        }

        generateTextPreview(data, scope) {
            if (scope === 'current') {
                let text = `${this.getSiteName().toUpperCase()} EXPORT\n`;
                text += `Page URL: ${data.url}\n`;
                text += `Results: ${data.results.length}\n`;
                if (data.searchLocation) {
                    const loc = data.searchLocation;
                    if (loc.state && loc.cityOrCounty) {
                        text += `Location: ${loc.cityOrCounty}, ${loc.state}\n`;
                    } else if (loc.state) {
                        text += `Location: ${loc.state}\n`;
                    }
                }
                text += `Time: ${new Date(data.timestamp).toLocaleString()}\n`;
                text += '='.repeat(50) + '\n\n';

                data.results.slice(0, 2).forEach((result, index) => {
                    text += `Record ${index + 1}:\n`;
                    text += `  Name: ${result.name || 'N/A'}\n`;
                    if (result.age) text += `  Age: ${result.age}\n`;
                    if (result.location) text += `  Location: ${result.location}\n`;
                    if (result.aliases && result.aliases.length > 0) {
                        text += `  Aliases: ${result.aliases.join(', ')}\n`;
                    }
                    if (result.addresses && result.addresses.length > 0) {
                        const addrText = result.addresses.map(addr =>
                            typeof addr === 'string' ? addr : addr.address
                        ).join('; ');
                        text += `  Addresses: ${addrText}\n`;
                    }
                    if (result.phones && result.phones.length > 0) {
                        const phoneText = result.phones.map(phone =>
                            typeof phone === 'string' ? phone : phone.number
                        ).join('; ');
                        text += `  Phones: ${phoneText}\n`;
                    }
                    text += '\n';
                });

                if (data.results.length > 2) {
                    text += `... and ${data.results.length - 2} more results`;
                }
                return text;
            } else {
                return `Total saved pages: ${data.totalPages}\nExport to see complete data from all pages`;
            }
        }

        exportData() {
            const format = document.getElementById('ubcExportFormat').value;
            const scope = document.getElementById('ubcDataScope').value;

            let dataToExport;
            let filename;

            if (scope === 'current') {
                dataToExport = this.currentPageData;
                filename = `${this.site}_current_${Date.now()}.${format}`;
            } else {
                dataToExport = this.getAllSavedData(scope);
                const scopeText = scope === 'all' ? 'all_sites' : `all_${this.site}_pages`;
                filename = `background_checks_${scopeText}_${Date.now()}.${format}`;
            }

            if (!dataToExport || (scope !== 'current' && dataToExport.length === 0)) {
                this.log('No data to export');
                return;
            }

            try {
                let content = '';
                let mimeType = '';

                switch (format) {
                    case 'json':
                        content = this.convertToJSON(dataToExport, scope);
                        mimeType = 'application/json;charset=utf-8;';
                        break;
                    case 'txt':
                        content = this.convertToText(dataToExport, scope);
                        mimeType = 'text/plain;charset=utf-8;';
                        break;
                }

                const blob = new Blob([content], { type: mimeType });
                GM_download({
                    url: URL.createObjectURL(blob),
                    name: filename,
                    saveAs: true
                });

                const recordCount = scope === 'current' ? dataToExport.results.length :
                    dataToExport.reduce((sum, page) => sum + page.results.length, 0);

                let scopeText = '';
                if (scope === 'current') {
                    scopeText = 'current page';
                } else if (scope === 'site_all') {
                    scopeText = `${dataToExport.length} ${this.getSiteName()} pages`;
                } else {
                    scopeText = `${dataToExport.length} pages from all sites`;
                }

                this.log(`Exported ${recordCount} records from ${scopeText} as ${format.toUpperCase()}`);

            } catch (error) {
                this.log(`Export error: ${error}`);
            }
        }

        convertToJSON(data, scope) {
            if (scope === 'current') {
                return JSON.stringify({
                    site: this.site,
                    siteName: this.getSiteName(),
                    ...data
                }, null, 2);
            } else {
                return JSON.stringify({
                    exportScope: scope,
                    totalPages: data.length,
                    totalRecords: data.reduce((sum, page) => sum + page.results.length, 0),
                    sites: [...new Set(data.map(page => page.site))],
                    pages: data
                }, null, 2);
            }
        }

        convertToText(data, scope) {
            if (scope === 'current') {
                return this.siteExtractor.convertToText(data, scope);
            } else {
                let text = `UNIVERSAL BACKGROUND CHECK EXPORT\n`;
                text += `Export Time: ${new Date().toLocaleString()}\n`;
                text += `Scope: ${scope === 'all' ? 'All Sites' : `All ${this.getSiteName()} Pages`}\n`;
                text += `Total Pages: ${data.length}\n`;
                text += `Total Records: ${data.reduce((sum, page) => sum + page.results.length, 0)}\n`;

                // Group by site
                const sites = {};
                data.forEach(page => {
                    if (!sites[page.site]) {
                        sites[page.site] = [];
                    }
                    sites[page.site].push(page);
                });

                Object.keys(sites).forEach(site => {
                    const sitePages = sites[site];
                    const siteName = sitePages[0].siteName || site;
                    text += `\n${'='.repeat(60)}\n`;
                    text += `${siteName.toUpperCase()} - ${sitePages.length} PAGES\n`;
                    text += `${'='.repeat(60)}\n\n`;

                    sitePages.forEach((page, pageIndex) => {
                        text += `PAGE ${pageIndex + 1}: ${page.url}\n`;
                        text += `Time: ${new Date(page.timestamp).toLocaleString()}\n`;
                        text += `Records: ${page.results.length}\n`;
                        if (page.searchLocation) {
                            const loc = page.searchLocation;
                            if (loc.state && loc.cityOrCounty) {
                                text += `Location: ${loc.cityOrCounty}, ${loc.state}\n`;
                            } else if (loc.state) {
                                text += `Location: ${loc.state}\n`;
                            }
                        }
                        text += '-'.repeat(50) + '\n\n';

                        page.results.slice(0, 3).forEach((result, resultIndex) => {
                            text += `  Record ${resultIndex + 1}: ${result.name || 'N/A'}\n`;
                            if (result.age) text += `    Age: ${result.age}\n`;
                            if (result.location) text += `    Location: ${result.location}\n`;
                            text += '\n';
                        });

                        if (page.results.length > 3) {
                            text += `  ... and ${page.results.length - 3} more records\n`;
                        }
                        text += '\n';
                    });
                });

                return text;
            }
        }

        viewSavedPages() {
            const savedPages = GM_getValue('ubc_saved_pages', []);
            const previewDiv = document.getElementById('ubcResultsPreview');

            if (savedPages.length === 0) {
                previewDiv.innerHTML = '<div>No saved pages found</div>';
                return;
            }

            // Group by site
            const sites = {};
            savedPages.forEach(page => {
                if (!sites[page.site]) {
                    sites[page.site] = [];
                }
                sites[page.site].push(page);
            });

            let html = '<div style="margin-bottom: 10px;"><strong>Saved Pages by Site:</strong></div>';

            Object.keys(sites).forEach(site => {
                const sitePages = sites[site];
                const siteName = sitePages[0].siteName || site;

                html += `<div style="margin-bottom: 10px; padding: 8px; background: #e8f4fd; border-radius: 4px;">
                    <strong>${siteName}</strong> (${sitePages.length} pages)
                </div>`;

                sitePages.forEach((page, index) => {
                    let locationInfo = '';
                    if (page.location) {
                        const loc = page.location;
                        if (loc.state && loc.cityOrCounty) {
                            locationInfo = `<br><small>Location: ${loc.cityOrCounty}, ${loc.state}</small>`;
                        } else if (loc.state) {
                            locationInfo = `<br><small>Location: ${loc.state}</small>`;
                        }
                    }

                    html += `
                        <div style="margin-bottom: 5px; padding: 5px; background: #f0f0f0; border-radius: 3px;">
                            <strong>${index + 1}.</strong> ${page.url}<br>
                            <small>Records: ${page.resultCount} | ${new Date(page.timestamp).toLocaleString()}</small>
                            ${locationInfo}
                        </div>
                    `;
                });
            });

            previewDiv.innerHTML = html;
        }

        clearAllData() {
            if (!confirm('Are you sure you want to clear ALL saved data from ALL sites?')) {
                return;
            }

            try {
                const savedPages = GM_getValue('ubc_saved_pages', []);
                savedPages.forEach(page => {
                    GM_deleteValue(page.key);
                });
                GM_setValue('ubc_saved_pages', []);

                this.log(`Cleared all saved data (${savedPages.length} pages from all sites)`);
                this.updatePreview();
            } catch (error) {
                this.log(`Error clearing data: ${error}`);
            }
        }

        autofillForm() {
            if (this.site === 'vote.org' && this.siteExtractor && this.siteExtractor.autofillForm) {
                const success = this.siteExtractor.autofillForm();
                if (success) {
                    this.log('Form autofilled successfully');

                    // Save the filled data for future use
                    const formData = this.siteExtractor.extractFormData();
                    if (formData) {
                        this.siteExtractor.saveFormData(formData);
                    }
                } else {
                    this.log('No form found to autofill');
                }
            } else {
                this.log('Autofill only available on Vote.org pages');
            }
        }

        importSearchData() {
            // Implementation for import functionality
            this.log('Import functionality coming soon');
        }
    }

    // Initialize when page loads
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => new UniversalBackgroundCheckExporter(), 1000);
        });
    } else {
        setTimeout(() => new UniversalBackgroundCheckExporter(), 1000);
    }
})();
