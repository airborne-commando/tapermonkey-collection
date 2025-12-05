# Main repo for tapermonkey scripts for simple OSINT.

Inside this repo You'll find a collection of tapermonkey scripts for either basic or advanced OSINT.

# Google Dorking Assistant

[gdrok](./SCRIPTS/gdork.js)

A Tampermonkey userscript that provides an interactive interface for building and managing Google advanced search queries (Google Dorking) directly within Google's search pages.

## Overview

The Google Dorking Assistant is a browser extension that adds a floating toolbar to Google search pages, enabling users to easily construct complex search queries using Google's advanced search operators without needing to memorize syntax or manually type operators.

## Features

### Search Operators
- **Basic Operators**: `site:`, `intitle:`, `inurl:`, `intext:`
- **Advanced Operators**: `allintitle:`, `allinurl:`, `allintext:`, `allinanchor:`, `inanchor:`
- **Boolean & Proximity**: `OR`, `-` (exclude), `""` (exact phrase), `*` (wildcard), `AROUND(n)` (proximity search)
- **Filetype Filters**: `filetype:pdf`, `filetype:pptx`, `filetype:doc`, `filetype:xls`
- **Date Filters**: `before:`, `after:`
- **Technical Operators**: `define`, `..` (number range)

### Profile Management
- **Pre-built Search Profiles**: Common search templates for social media, government sites, educational institutions, and more
- **Custom Profiles**: Save and manage your own frequently used search queries
- **Profile Import/Export**: Backup and restore your custom profiles via JSON files
- **Profile Management**: Delete individual custom profiles or clear all custom profiles at once

### User Interface
- **Floating Toolbar**: Always accessible interface that appears on Google search pages
- **Interactive Builder**: Step-by-step query construction with operator descriptions
- **Real-time Preview**: See your current query as you build it
- **Quick Execution**: One-click search execution with your constructed query

## Installation

1. Install the Tampermonkey browser extension
2. Create a new userscript and paste the provided code
3. Save the script and enable it
4. Navigate to Google search to see the floating toolbar

## Usage

### Basic Operation
1. The toolbar automatically appears when visiting Google search pages
2. Use the main menu to access different operator categories
3. Build queries by selecting operators and entering values when prompted
4. Execute searches directly from the toolbar

### Search Profiles
- **Built-in Profiles**: Pre-configured searches for common scenarios
- **Custom Profiles**: Save your frequently used queries for quick access
- **Profile Templates**: Many profiles include placeholders for customization (e.g., "First Last" for names)

### Profile Management
- **Save Current Query**: Convert your current search into a reusable profile
- **Import/Export**: Transfer profiles between browsers or backup your settings
- **Delete Profiles**: Remove individual custom profiles or clear all custom profiles

## Supported Operators

The script includes all currently supported Google advanced search operators as documented in Google's official documentation, with deprecated operators removed for accuracy.

## Compatibility

- Works with Google search pages
- Requires Tampermonkey or similar userscript manager
- Compatible with most modern browsers and works on mobile phones

## License

GPL 3.0

## Version

Current version: 2.0

## Author

airborne-commando

## Notes

This tool is designed for legitimate security research, penetration testing, and advanced search purposes. Users should ensure they comply with Google's Terms of Service and applicable laws when using advanced search techniques.


## Universal Background Check Exporter

Export results from multiple background check sites: FastBackgroundCheck, FastPeopleSearch, and ZabaSearch

Can only do one page each, comes with hyperlinks.

## Save as

- JSON
- Text

Also has the option to check ones voter status thoughout the states (less advanced, can't check political demographic).

## How to use:
- Install tapermonkey/greasemonkey
- copy paste this script
- ???
- profit

## Voter extraction (lite)

The voter extraction tool that is linked here is pretty lite, it isn't accurate with the mm-dd but it is accurate with the year. It is only accurate with the first-lastname, street, city, state and zipcodes. You also cannot get voter demographics such as what party this person belongs to.

---

## Voter reg status: Tapermonkey edition

Due to chrome driver being blocked, this would probably be the better solution!


## CSV file input example:


    zip,firstname,lastname,MM/DD/YYYY


and even for continuous days of that month.

    zip,firstname,lastname,MM/00/YYYY


Also does direct input and year range

Example

ZIP,FirstName,LastName,DOB-DOB

DOB-DOB Will turn into a next year for that month.

## Firefox

Right click inspect element > storage > cookies > https://www.pavoterservices.pa.gov > Delete all session cookies

## Chrome

Right click inspect element > storage > cookies > https://www.pavoterservices.pa.gov > clear

Use this when dealing with a CAPTCHA, how would you know? if the error sign isn't showing up.

Should clear for you however automatically since the [recent update](https://github.com/airborne-commando/tampermonkey-collection/commit/5a8efe6fc8b1f0a745b11ee65f7e6bf94e27c9ba).

## Example output


        firstName,lastName,dob,zip,county,status,result,timestamp
        "firstname","lastname","MM/DD/YYYY","zip","county","found","YOUR RESIDENTIAL ADDRESS
        zip  address
        YOUR MAILING ADDRESS
        Is your information up to date?
        If you need to update your voter registration, please visit
        vote.pa.gov/Register and submit an online voter registration application.
        VOTER RECORD DETAILS
        Status:
        ACTIVE
        Date of Birth:
        mm/dd/yyyy
        Party:
        DEMOCRATIC
        Are you an annual mail-in or absentee voter?
        NO
        Do you have an approved mail ballot request for the upcoming election?
        NO
        VOTING DISTRICTS
        County:
        ERIE
        Precinct:
        MILLCREEK TOWNSHIP 6TH DISTRICT
        Municipality:
        MILLCREEK TOWNSHIP
        United States Congress:
        16TH CONGRESSIONAL DISTRICT
        State Senate:
        49TH SENATORIAL DISTRICT
        State House:
        3RD LEGISLATIVE DISTRICT
        COUNTY BOARD OF ELECTIONS
        140 W 6TH ST RM 112 ERIE, PA 16501
        Phone:
        (814) 451-6275
        Email:
        TFERNANDEZ@ERIECOUNTYPA.GOV
        If you have any questions about your voter record or voting districts, you may find county election office contact information at
        www.vote.pa.gov/county
        YOUR ELECTION DAY POLLING PLACE
        Polling Place for MILLCREEK TOWNSHIP 6TH DISTRICT
        place
        address
        ERIE,
        PA
        zip
        State:
        Zip Code:","2025-10-24T14:06:01.376Z"


1. Get taper monkey https://www.tampermonkey.net/ or greasemonkey (mobile).
2.  Install this script (copy paste)
3.  profit?

-----

**Scripts:**

[universal-search.js](./SCRIPTS/universal-search.js)

[pavoter-bulk-dev.js](./SCRIPTS/pavoter-bulk-dev.js)

**Zip file**
[pa-zip-mapping.js](./SCRIPTS/pa-zip-mapping.js)


**This one has no zip codes, just a base template.**

[pavoter-bulk-ziptemp.js](./SCRIPTS/pavoter-bulk-ziptemp.js)

Usage for **Vote.org API Check(universal-search.js):**

**Input:**

    First, last name
    Address: home address street, city, state zip.
    Only unique value is: yyyy

**The year is the only value that matters.**

**Result:**

    ✓ REGISTERED TO VOTE
    Name: John Doe
    Address: 17201 Elite 1337, city, anywhere 0000.
    Status: Registered to Vote
    API request successful

-----

## Breach.VIP and reddit profile analyzer

Search breach data and analyze Reddit users

[Breachvip-reddit.js](./SCRIPTS/Breachvip-reddit.js)

## Breach data search

Find results via:

* Email
* username
* phone number
* full name

## R00M101

* Input reddit username (even deleted).

---

TO DO:

Make the GUI look more clean perhaps?

---

# 4chan archive

[waybackmachineimgrdr.js](./SCRIPTS/waybackmachineimgrdr.js)

This user script automatically replaces broken or missing Imgur images on **4chanarchives.com** with archived versions from the **Wayback Machine**.  

***

Here’s what it does in short:

- Scans all **Imgur image links** and embedded **thumbnails** on the page.  
- Uses multiple **Wayback Machine APIs** (CDX, direct, and standard) to locate existing archived snapshots of those images.  
- If a backup is found, it redirects the link or image to the archived version.  
- Visually marks each link with color-coded borders:
  - Green for success (snapshot found)  
  - Yellow for missing (no snapshot found)  
  - Red for errors  
- Saves results in a **local cache** to avoid rechecking the same URLs.  
- Adds a **menu option** in Tampermonkey to clear the cache and re-scan the page.  
- Handles dynamically loaded content and URL changes by reprocessing automatically.

Essentially, it ensures that old threads with dead Imgur links on 4chanarchives.com still display usable images when archived copies exist.

---

# Link extractor

[linkextractor.js](./SCRIPTS/linkextractor.js)

Basically just extracts links on a webpage, use this with archive.ph or wayback machine.

* Hitting clear will clear everything, even what's in memory. Will not clear downloads.
* Load saved will load what's saved in memory.
* Save to file will download.
* Use with [archive-gui.py](https://github.com/airborne-commando/link-extractor-and-archive/blob/main/archive-gui.py) OR [archive.py](https://github.com/airborne-commando/link-extractor-and-archive/blob/main/archive.py)