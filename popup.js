document.addEventListener('DOMContentLoaded', function() {
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    const currentTab = tabs[0];
    const url = currentTab.url;
    
    const urlInfo = document.getElementById('url-info');
    const resultDiv = document.getElementById('result');
    const lengthInfo = document.getElementById('length-info');
    
    // Show loading state
    resultDiv.textContent = "Analyzing...";
    resultDiv.className = "result";
    
    try {
      // Handle special URLs
      if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
        resultDiv.textContent = "Cannot analyze this type of URL";
        resultDiv.className = "result error";
        urlInfo.textContent = `URL: ${url}`;
        lengthInfo.textContent = "Features: Not available for this URL type";
        return;
      }

      const urlFeatures = extractUrlFeatures(url);
      const websiteFeatures = await extractWebsiteFeatures(url);
      
      // Combine features
      const features = [...urlFeatures, ...websiteFeatures];
      
      urlInfo.textContent = `URL: ${url}`;
      lengthInfo.textContent = `Features: Length=${features[0]}, Dots=${features[1]}, Special chars=${features[2]}, ` +
        `Forms=${features[3]}, Inputs=${features[4]}, Links=${features[5]}, Has Password Field=${features[6]}`;
      
      // Get badge state to show consistent result
      chrome.action.getBadgeText({ tabId: currentTab.id }, (text) => {
        const isPhishing = text === "RISK";
        resultDiv.textContent = isPhishing ? "Potential Phishing Website Detected!" : "Website Appears Safe";
        resultDiv.className = `result ${isPhishing ? 'phishing' : 'safe'}`;
      });
    } catch (error) {
      console.error('Error:', error);
      resultDiv.textContent = "Error analyzing website";
      resultDiv.className = "result error";
    }
  });
});

const extractUrlFeatures = (url) => {
  try {
    // Skip analysis for special URLs
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
      return [0, 0, 0];
    }

    const length = url.length;
    const dots = (url.match(/\./g) || []).length;
    const specialChars = (url.match(/[^a-zA-Z0-9.]/g) || []).length;
    return [length, dots, specialChars];
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
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit'
    });
    
    clearTimeout(timeoutId);
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const numForms = doc.getElementsByTagName('form').length;
    const numInputs = doc.getElementsByTagName('input').length;
    const numLinks = doc.getElementsByTagName('a').length;
    const hasPasswordField = doc.querySelector('input[type="password"]') !== null;
    
    return [numForms, numInputs, numLinks, hasPasswordField ? 1 : 0];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request timed out:', url);
    } else {
      console.error('Error fetching website:', error);
    }
    return [0, 0, 0, 0];
  }
};