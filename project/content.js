// This script runs in the context of the web page
// For this simple extension, we don't need complex content script functionality

// Send the URL to the background script for analysis
chrome.runtime.sendMessage({
  action: "analyzeURL",
  url: window.location.href
});