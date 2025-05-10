let model = null;
let modelWeights = null;

// Load model and weights
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

// Listen for tab updates
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
      
      // Store analysis results for popup
      chrome.storage.local.set({
        [`analysis_${tabId}`]: {
          urlAnalysis,
          websiteAnalysis,
          totalScore
        }
      });
      
      // Update badge
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

      // Send message to content script to show overlay
      chrome.tabs.sendMessage(tabId, {
        action: 'showOverlay',
        isSafe: totalScore < 40,
        score: totalScore
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