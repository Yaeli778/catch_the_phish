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
      if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
        resultDiv.textContent = "Cannot analyze this type of URL";
        resultDiv.className = "result error";
        urlInfo.textContent = `URL: ${url}`;
        lengthInfo.textContent = "Features: Not available for this URL type";
        return;
      }

      // Get stored analysis results
      chrome.storage.local.get([`analysis_${currentTab.id}`], (result) => {
        const analysis = result[`analysis_${currentTab.id}`];
        
        if (!analysis) {
          resultDiv.textContent = "Analysis not available";
          resultDiv.className = "result error";
          return;
        }

        const { urlAnalysis, websiteAnalysis, totalScore } = analysis;
        const isPhishing = totalScore >= 40;

        // Update UI with detailed analysis
        resultDiv.textContent = isPhishing ? 
          `Potential Phishing Website Detected! Risk Score: ${Math.round(totalScore)}%` : 
          `Website Appears Safe. Risk Score: ${Math.round(totalScore)}%`;
        resultDiv.className = `result ${isPhishing ? 'phishing' : 'safe'}`;
        
        urlInfo.textContent = `URL: ${url}`;
        
        // Show detailed features
        const urlFeatures = urlAnalysis.features;
        const webFeatures = websiteAnalysis.features;
        
        lengthInfo.innerHTML = `
          <strong>URL Analysis:</strong><br>
          - Length: ${urlFeatures.length}<br>
          - Dots: ${urlFeatures.dots}<br>
          - Special Characters: ${urlFeatures.specialChars}<br>
          - Suspicious Keywords: ${urlFeatures.hasSuspiciousKeywords ? 'Yes' : 'No'}<br>
          <br>
          <strong>Website Analysis:</strong><br>
          - Forms: ${webFeatures.formCount}<br>
          - Input Fields: ${webFeatures.inputCount}<br>
          - Links: ${webFeatures.linkCount}<br>
          - Password Field: ${webFeatures.hasPasswordField ? 'Yes' : 'No'}<br>
          - Hidden Forms: ${webFeatures.hasHiddenForms ? 'Yes' : 'No'}<br>
          - Sensitive Inputs: ${webFeatures.hasSensitiveInputs ? 'Yes' : 'No'}
        `;
      });
    } catch (error) {
      console.error('Error:', error);
      resultDiv.textContent = "Error analyzing website";
      resultDiv.className = "result error";
    }
  });
});