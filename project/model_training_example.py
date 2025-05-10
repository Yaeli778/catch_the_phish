import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib

# Example of how to train and save your model
def train_model():
    # Replace this with your actual training data
    # Example structure:
    data = {
        'url_length': [],
        'num_dots': [],
        'num_special_chars': [],
        'num_forms': [],
        'num_inputs': [],
        'num_links': [],
        'has_password_field': [],
        'is_phishing': []  # Your labels
    }
    
    df = pd.DataFrame(data)
    
    X = df.drop('is_phishing', axis=1)
    y = df['is_phishing']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Save the trained model
    joblib.dump(model, 'server/model.pkl')
    
    # Print model accuracy
    print(f"Model accuracy: {model.score(X_test, y_test)}")

if __name__ == "__main__":
    train_model()