const fs = require('fs');

// Generate random weights for our model
function generateRandomWeights(shape) {
  const size = shape.reduce((a, b) => a * b, 1);
  const weights = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    weights[i] = (Math.random() - 0.5) * 0.1; // Small random values
  }
  return weights;
}

// Define model architecture
const layers = [
  { name: 'dense_1/kernel', shape: [7, 16] },
  { name: 'dense_1/bias', shape: [16] },
  { name: 'dense_2/kernel', shape: [16, 8] },
  { name: 'dense_2/bias', shape: [8] },
  { name: 'dense_3/kernel', shape: [8, 1] },
  { name: 'dense_3/bias', shape: [1] }
];

// Generate all weights
const allWeights = new Float32Array(
  layers.reduce((acc, layer) => acc + layer.shape.reduce((a, b) => a * b, 1), 0)
);

let offset = 0;
const weights = {};

for (const layer of layers) {
  const size = layer.shape.reduce((a, b) => a * b, 1);
  const layerWeights = generateRandomWeights(layer.shape);
  weights[layer.name] = layerWeights;
  allWeights.set(layerWeights, offset);
  offset += size;
}

// Write the combined weights to a single binary file
fs.writeFileSync('model/weights.bin', Buffer.from(allWeights.buffer));

console.log('Model weights generated successfully');