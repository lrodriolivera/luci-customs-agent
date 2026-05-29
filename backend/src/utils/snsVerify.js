const crypto = require('crypto');
const https = require('https');
const logger = require('../config/logger');

const certCache = new Map();
const CERT_TTL_MS = 60 * 60 * 1000;

function fetchCert(url) {
  const cached = certCache.get(url);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.cert);
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !/(^|\.)amazonaws\.com$/i.test(u.hostname)) {
      return reject(new Error(`Invalid SigningCertURL host: ${u.hostname}`));
    }
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Cert fetch ${res.statusCode}`));
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        certCache.set(url, { cert: data, expires: Date.now() + CERT_TTL_MS });
        resolve(data);
      });
    }).on('error', reject);
  });
}

function buildStringToSign(msg) {
  const fields = msg.Type === 'Notification'
    ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
    : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  let s = '';
  for (const f of fields) {
    if (msg[f] !== undefined && msg[f] !== null) s += `${f}\n${msg[f]}\n`;
  }
  return s;
}

async function verifySnsMessage(msg) {
  if (!msg || !msg.SigningCertURL || !msg.Signature) return false;
  try {
    const cert = await fetchCert(msg.SigningCertURL);
    const stringToSign = buildStringToSign(msg);
    const algo = msg.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
    const verifier = crypto.createVerify(algo);
    verifier.update(stringToSign, 'utf8');
    return verifier.verify(cert, msg.Signature, 'base64');
  } catch (err) {
    logger.warn('SNS verification error', { error: err.message });
    return false;
  }
}

module.exports = { verifySnsMessage };
