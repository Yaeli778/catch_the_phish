# Simple Phishing Website Detector

A basic Chrome extension that detects potential phishing websites based on URL length.

## Features

- Analyzes the URL of the current tab
- Flags URLs shorter than 10 characters as potential phishing websites
- Shows visual feedback in the popup
- Updates the extension icon badge to indicate safety status

## Installation Instructions

1. Download this repository or unzip the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now be installed and active

## Usage

- Click on the extension icon to see the analysis of the current webpage
- Green "SAFE" badge means the URL is considered safe (10 or more characters)
- Red "RISK" badge means the URL might be a phishing site (less than 10 characters)

## Development

This is a simple implementation that can be extended with more sophisticated phishing detection techniques. Future improvements could include:
- Domain reputation checking
- Analysis of page content
- Machine learning-based detection
- Reporting capabilities