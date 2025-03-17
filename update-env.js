// Script to update React environment variables based on the server port
const fs = require('fs');
const path = require('path');

// Read the .env file to get SERVER_PORT
try {
  const envPath = path.join(__dirname, '.env');
  const reactEnvPath = path.join(__dirname, '.env.development.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const serverPortMatch = envContent.match(/SERVER_PORT=(\d+)/);
  
  if (!serverPortMatch) {
    console.log('SERVER_PORT not found in .env file, using default port 8001');
    const reactEnvContent = `REACT_APP_SERVER_PORT=8001\n`;
    fs.writeFileSync(reactEnvPath, reactEnvContent);
    console.log(`Updated ${reactEnvPath} with default port 8001`);
  } else {
    const serverPort = serverPortMatch[1];
    const reactEnvContent = `REACT_APP_SERVER_PORT=${serverPort}\n`;
    fs.writeFileSync(reactEnvPath, reactEnvContent);
    console.log(`Updated ${reactEnvPath} with port ${serverPort}`);
  }
} catch (error) {
  console.error('Error updating environment variables:', error);
  process.exit(1);
} 