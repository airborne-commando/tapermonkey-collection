
# Google Dorking Assistant

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
