let model = null;
let modelWeights = null;

// Load model and weights
// Modify your loadModel function to include more logging
async function loadModel() {
  try {
    console.log('Loading phishing detection model...');
    const [modelResponse, weightsResponse] = await Promise.all([
      fetch(chrome.runtime.getURL('model/model.json')),
      fetch(chrome.runtime.getURL('model/weights.bin'))
    ]);

    if (!modelResponse.ok) {
      throw new Error(`Failed to load model.json: ${modelResponse.status}`);
    }
    
    if (!weightsResponse.ok) {
      throw new Error(`Failed to load weights.bin: ${weightsResponse.status}`);
    }

    model = await modelResponse.json();
    const weightsBuffer = await weightsResponse.arrayBuffer();
    modelWeights = new Float32Array(weightsBuffer);
    
    console.log('Model structure:', model.modelTopology);
    console.log('Model weights length:', modelWeights.length);
    console.log('Model and weights loaded successfully');
  } catch (error) {
    console.error('Error loading model:', error);
    model = null;
    modelWeights = null;
  }
}

loadModel();

const extractUrlFeatures = (url) => {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
      return {
        features: {
          length: 0,
          dots: 0,
          specialChars: 0,
          hasSuspiciousKeywords: false,
          hasRandomChars: false,
          hasExcessiveDots: false
        },
        score: 0
      };
    }

    const length = url.length;
    const dots = (url.match(/\./g) || []).length;
    const specialChars = (url.match(/[^a-zA-Z0-9.]/g) || []).length;
    
    const hasExcessiveDots = dots > 3;
    const hasRandomChars = /[0-9]{4,}|[a-zA-Z0-9]{10,}/.test(url);
    const hasSuspiciousKeywords = /(secure|login|account|verify|update|password)/.test(url.toLowerCase());
    
    return {
      features: {
        length,
        dots,
        specialChars,
        hasSuspiciousKeywords,
        hasRandomChars,
        hasExcessiveDots
      },
      score: calculateUrlScore({
        length,
        dots,
        specialChars,
        hasSuspiciousKeywords,
        hasRandomChars,
        hasExcessiveDots
      })
    };
  } catch (error) {
    console.error('Error analyzing URL:', error);
    return { features: {}, score: 0 };
  }
};

const analyzeWebsite = async (url) => {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
      return {
        features: {
          formCount: 0,
          inputCount: 0,
          linkCount: 0,
          hasPasswordField: false,
          hasHiddenForms: false,
          hasSensitiveInputs: false
        },
        score: 0
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit'
    });
    
    clearTimeout(timeoutId);
    
    const html = await response.text();
    
    const formCount = (html.match(/<form[^>]*>/gi) || []).length;
    const inputCount = (html.match(/<input[^>]*>/gi) || []).length;
    const linkCount = (html.match(/<a[^>]*>/gi) || []).length;
    const hasPasswordField = /<input[^>]*type=["']password["'][^>]*>/i.test(html);
    const hasHiddenForms = (html.match(/<form[^>]*style=["'][^"']*display:\s*none/gi) || []).length > 0;
    const hasSensitiveInputs = (html.match(/<input[^>]*name=["'](card|cvv|ssn)["'][^>]*>/gi) || []).length > 0;

    const features = {
      formCount,
      inputCount,
      linkCount,
      hasPasswordField,
      hasHiddenForms,
      hasSensitiveInputs
    };
    
    return {
      features,
      score: calculateWebsiteScore(features)
    };
  } catch (error) {
    console.error('Error analyzing website:', error);
    return { features: {}, score: 0 };
  }
};

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function relu(x) {
  return Math.max(0, x);
}

function calculateUrlScore(features) {
  if (!model || !modelWeights) return 0;
  
  const input = [
    features.length,
    features.dots,
    features.specialChars,
    features.hasSuspiciousKeywords ? 1 : 0,
    features.hasRandomChars ? 1 : 0,
    features.hasExcessiveDots ? 1 : 0
  ];

  // Forward pass through the model
  let current = input;
  let weightsOffset = 0;
  
  // First dense layer
  const dense1 = model.modelTopology.config.layers[0];
  let output = new Array(dense1.config.units).fill(0);
  for (let i = 0; i < dense1.config.units; i++) {
    let sum = 0;
    for (let j = 0; j < input.length; j++) {
      sum += input[j] * modelWeights[weightsOffset + i * input.length + j];
    }
    sum += modelWeights[weightsOffset + dense1.config.units * input.length + i];
    output[i] = relu(sum);
  }
  weightsOffset += dense1.config.units * input.length + dense1.config.units;
  current = output;

  // Second dense layer
  const dense2 = model.modelTopology.config.layers[1];
  output = new Array(dense2.config.units).fill(0);
  for (let i = 0; i < dense2.config.units; i++) {
    let sum = 0;
    for (let j = 0; j < current.length; j++) {
      sum += current[j] * modelWeights[weightsOffset + i * current.length + j];
    }
    sum += modelWeights[weightsOffset + dense2.config.units * current.length + i];
    output[i] = relu(sum);
  }
  weightsOffset += dense2.config.units * current.length + dense2.config.units;
  current = output;

  // Output layer
  let finalOutput = 0;
  for (let i = 0; i < current.length; i++) {
    finalOutput += current[i] * modelWeights[weightsOffset + i];
  }
  finalOutput += modelWeights[weightsOffset + current.length];
  
  return sigmoid(finalOutput) * 100;
}

function calculateWebsiteScore(features) {
  if (!model || !modelWeights) return 0;
  
  const input = [
    features.formCount,
    features.inputCount,
    features.linkCount,
    features.hasPasswordField ? 1 : 0,
    features.hasHiddenForms ? 1 : 0,
    features.hasSensitiveInputs ? 1 : 0
  ];

  // Use the same weight offsets and calculation as URL score
  let current = input;
  let weightsOffset = 0;
  
  // First dense layer
  const dense1 = model.modelTopology.config.layers[0];
  let output = new Array(dense1.config.units).fill(0);
  for (let i = 0; i < dense1.config.units; i++) {
    let sum = 0;
    for (let j = 0; j < input.length; j++) {
      sum += input[j] * modelWeights[weightsOffset + i * input.length + j];
    }
    sum += modelWeights[weightsOffset + dense1.config.units * input.length + i];
    output[i] = relu(sum);
  }
  weightsOffset += dense1.config.units * input.length + dense1.config.units;
  current = output;

  // Second dense layer
  const dense2 = model.modelTopology.config.layers[1];
  output = new Array(dense2.config.units).fill(0);
  for (let i = 0; i < dense2.config.units; i++) {
    let sum = 0;
    for (let j = 0; j < current.length; j++) {
      sum += current[j] * modelWeights[weightsOffset + i * current.length + j];
    }
    sum += modelWeights[weightsOffset + dense2.config.units * current.length + i];
    output[i] = relu(sum);
  }
  weightsOffset += dense2.config.units * current.length + dense2.config.units;
  current = output;

  // Output layer
  let finalOutput = 0;
  for (let i = 0; i < current.length; i++) {
    finalOutput += current[i] * modelWeights[weightsOffset + i];
  }
  finalOutput += modelWeights[weightsOffset + current.length];
  
  return sigmoid(finalOutput) * 100;
}

function showNotification(url, score) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: 'Phishing Detection Alert',
    message: score >= 40 ? 
      `Warning: ${url} appears to be a phishing website! Risk Score: ${Math.round(score)}%` :
      `${url} appears to be safe. Risk Score: ${Math.round(score)}%`,
    priority: score >= 40 ? 2 : 0
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
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

      const urlAnalysis = extractUrlFeatures(tab.url);
      const websiteAnalysis = await analyzeWebsite(tab.url);
      
      // Combined risk score (weighted average)
      const totalScore = (urlAnalysis.score * 0.4) + (websiteAnalysis.score * 0.6);
      
      debugPhishingDetection(tabId, tab.url);

      // Store analysis results for popup
      chrome.storage.local.set({
        [`analysis_${tabId}`]: {
          urlAnalysis,
          websiteAnalysis,
          totalScore
        }
      });
      
      chrome.action.setBadgeText({
        text: totalScore >= 40 ? "RISK" : "SAFE",
        tabId: tabId
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: totalScore >= 40 ? "#FF0000" : "#00FF00",
        tabId: tabId
      });

      // Show notification for high-risk sites
      if (totalScore >= 40) {
        showNotification(tab.url, totalScore);
      }
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: injectSafetyOverlay,
        args: [totalScore < 40, totalScore]
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
})

// Add this debugging function to inspect what's happening
function debugPhishingDetection(tabId, url) {
  chrome.storage.local.get([`analysis_${tabId}`], (result) => {
    const analysis = result[`analysis_${tabId}`];
    if (analysis) {
      console.log('==== PHISHING DETECTION DEBUG ====');
      console.log('URL:', url);
      console.log('URL Analysis:', analysis.urlAnalysis);
      console.log('URL Features:', analysis.urlAnalysis.features);
      console.log('URL Score:', analysis.urlAnalysis.score);
      console.log('Website Analysis:', analysis.websiteAnalysis);
      console.log('Website Features:', analysis.websiteAnalysis.features);
      console.log('Website Score:', analysis.websiteAnalysis.score);
      console.log('Total Score:', analysis.totalScore);
      console.log('Model Loaded:', !!model && !!modelWeights);
      console.log('=================================');
    }
  });
}
function injectSafetyOverlay(isSafe, score) {
  // Create an overlay element
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '20px';
  overlay.style.right = '20px';
  overlay.style.zIndex = '9999';
  overlay.style.padding = '15px';
  overlay.style.borderRadius = '5px';
  overlay.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  overlay.style.transition = 'opacity 0.5s';
  overlay.style.fontSize = '14px';
  overlay.style.fontFamily = 'Arial, sans-serif';
  
  if (isSafe) {
    overlay.style.backgroundColor = '#dff0d8';
    overlay.style.color = '#3c763d';
    overlay.style.border = '1px solid #d6e9c6';
    overlay.innerHTML = `<strong>Safe Website</strong><br>Risk Score: ${Math.round(score)}%`;
  } else {
    overlay.style.backgroundColor = '#f2dede';
    overlay.style.color = '#a94442';
    overlay.style.border = '1px solid #ebccd1';
    overlay.style.fontWeight = 'bold';
    overlay.innerHTML = `<strong>WARNING: Potential Phishing Risk!</strong><br>Risk Score: ${Math.round(score)}%`;
  }
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.marginLeft = '10px';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.float = 'right';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.fontWeight = 'bold';
  closeBtn.onclick = function() {
    document.body.removeChild(overlay);
  };
  overlay.insertBefore(closeBtn, overlay.firstChild);
  
  // Add to page
  document.body.appendChild(overlay);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      }, 500);
    }
  }, 5000);
}
