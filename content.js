// This script runs in the context of the web page
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

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showOverlay') {
    injectSafetyOverlay(message.isSafe, message.score);
  }
});