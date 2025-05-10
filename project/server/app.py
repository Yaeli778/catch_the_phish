from flask import Flask, request, jsonify
import joblib
import numpy as np
from urllib.parse import urlparse
import re
from bs4 import BeautifulSoup
import requests

app = Flask(__name__)

# Load your pre-trained model
try:
    model = joblib.load('server/model.pkl')
except:
    print("Warning: model.pkl not found. Please train and export your model first.")
    model = None

def extract_url_features(url):
    parsed = urlparse(url)
    length = len(url)
    dots = url.count('.')
    special_chars = len(re.findall(r'[^a-zA-Z0-9.]', url))
    
    return np.array([length, dots, special_chars]).reshape(1, -1)

def scrape_website(url):
    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract features from website content
        num_forms = len(soup.find_all('form'))
        num_inputs = len(soup.find_all('input'))
        num_links = len(soup.find_all('a'))
        has_password_field = bool(soup.find('input', {'type': 'password'}))
        
        return {
            'num_forms': num_forms,
            'num_inputs': num_inputs,
            'num_links': num_links,
            'has_password_field': has_password_field
        }
    except:
        return {
            'num_forms': 0,
            'num_inputs': 0,
            'num_links': 0,
            'has_password_field': False
        }

@app.route('/analyze', methods=['POST'])
def analyze_url():
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    # Extract features
    url_features = extract_url_features(url)
    website_features = scrape_website(url)
    
    # Combine all features
    features = np.array([
        url_features[0][0],  # URL length
        url_features[0][1],  # Number of dots
        url_features[0][2],  # Number of special chars
        website_features['num_forms'],
        website_features['num_inputs'],
        website_features['num_links'],
        website_features['has_password_field']
    ]).reshape(1, -1)
    
    # For now, using simple length-based logic
    # Replace this with your model's prediction when model.pkl is available
    if model is not None:
        is_phishing = bool(model.predict(features)[0])
    else:
        is_phishing = len(url) < 10  # Fallback logic
    
    return jsonify({
        'is_phishing': is_phishing,
        'confidence': 0.9 if is_phishing else 0.1,
        'features': {
            'url_features': {
                'length': int(features[0][0]),
                'dots': int(features[0][1]),
                'special_chars': int(features[0][2])
            },
            'website_features': website_features
        }
    })

if __name__ == '__main__':
    app.run(port=5000)