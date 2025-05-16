console.log('Connection URL:', process.env.DATABASE_URL);
const url = new URL(process.env.DATABASE_URL!);
console.log('Hostname:', url.hostname);
console.log('Port:', url.port);
console.log('Username:', url.username);
console.log('Password:', '[REDACTED]');
console.log('Pathname:', url.pathname);
