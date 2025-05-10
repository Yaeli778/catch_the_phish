const extractUrlFeatures = (url) => {
  try {
    // Skip analysis for special URLs
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
      return [0, 0, 0];
    }

    const length = url.length;
    const dots = (url.match(/\./g) || []).length;
    const specialChars = (url.match(/[^a-zA-Z0-9.]/g) || []).length;
    
    // Additional suspicious patterns
    const hasExcessiveDots = dots > 3;
    const hasRandomChars = /[0-9]{4,}|[a-zA-Z0-9]{10,}/.test(url);
    const hasSuspiciousKeywords = /(secure|login|account|verify|update|password)/.test(url.toLowerCase());
    
    return [
      length,
      dots + (hasExcessiveDots ? 5 : 0),  // Penalize excessive dots
      specialChars + (hasRandomChars ? 5 : 0) + (hasSuspiciousKeywords ? 3 : 0)
    ];
  } catch (error) {
    console.error('Error extracting URL features:', error);
    return [0, 0, 0];
  }
};

const extractWebsiteFeatures = async (url) => {
  try {
    // Skip analysis for special URLs
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
      return [0, 0, 0, 0];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit' // Don't send cookies
    });
    
    clearTimeout(timeoutId);
    
    const html = await response.text();
    
    // Use regex for feature extraction instead of DOM parsing
    const formCount = (html.match(/<form[^>]*>/gi) || []).length;
    const inputCount = (html.match(/<input[^>]*>/gi) || []).length;
    const linkCount = (html.match(/<a[^>]*>/gi) || []).length;
    const hasPasswordField = /<input[^>]*type=["']password["'][^>]*>/i.test(html);
    
    // Additional suspicious patterns
    const hasHiddenForms = (html.match(/<form[^>]*style=["'][^"']*display:\s*none/gi) || []).length > 0;
    const hasSensitiveInputs = (html.match(/<input[^>]*name=["'](card|cvv|ssn)["'][^>]*>/gi) || []).length > 0;
    
    return [
      formCount + (hasHiddenForms ? 2 : 0),
      inputCount + (hasSensitiveInputs ? 3 : 0),
      linkCount,
      hasPasswordField ? 1 : 0
    ];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request timed out:', url);
    } else {
      console.error('Error fetching website:', error);
    }
    return [0, 0, 0, 0];
  }
};

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Handle special URLs
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('file://')) {
        chrome.action.setBadgeText({
          text: "N/A",
          tabId: tabId
        });
        chrome.action.setBadgeBackgroundColor({
          color: "#888888",
          tabId: tabId
        });
        return;
      }

      const urlFeatures = extractUrlFeatures(tab.url);
      const websiteFeatures = await extractWebsiteFeatures(tab.url);
      const features = [...urlFeatures, ...websiteFeatures];
      
      // Enhanced phishing detection logic
      const isPhishing = 
        features[0] > 50 || // Long URL
        features[1] > 3 ||  // Many dots or suspicious patterns
        features[2] > 5 ||  // Many special chars or suspicious patterns
        features[3] > 2 ||  // Multiple forms
        (features[4] > 5 && features[6] === 1) || // Many inputs with password field
        (features[3] > 0 && features[6] === 1 && features[2] > 3); // Form + password + special chars
      
      chrome.action.setBadgeText({
        text: isPhishing ? "RISK" : "SAFE",
        tabId: tabId
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: isPhishing ? "#FF0000" : "#00FF00",
        tabId: tabId
      });
    } catch (error) {
      console.error('Error analyzing URL:', error);
      chrome.action.setBadgeText({
        text: "ERR",
        tabId: tabId
      });
      chrome.action.setBadgeBackgroundColor({
        color: "#FF8800",
        tabId: tabId
      });
    }
  }
});